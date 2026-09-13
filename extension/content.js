/**
 * The in-page Queue button, placed in the posting card's top-right corner.
 *
 * Three things shape this file. The button lives inside the card rather than
 * floating over the window, so the card's own box positions it — it scrolls and
 * reflows with the posting, and no scroll or resize handling is needed. Nothing
 * keys off a class name — LinkedIn ships hashed ones (`_946488c0 …`) — so the
 * card is found by measurement and the Apply link by its `/safety/go/` href,
 * both of which outlive a redesign. And LinkedIn is a SPA that swaps the detail
 * pane without navigating, so the button is re-mounted whenever the job id
 * changes or the card is rebuilt underneath it.
 */

const PANEL_ID = 'jobtracker-queue-panel';

/** The posting on screen: `?currentJobId=` in search, or `/jobs/view/<id>/`. */
function currentJobId() {
  const fromParam = new URL(location.href).searchParams.get('currentJobId');
  if (fromParam) return fromParam;
  const m = location.pathname.match(/\/jobs\/view\/(\d+)/);
  return m ? m[1] : null;
}

/**
 * The employer's application page, unwrapped from LinkedIn's redirect.
 *
 * Off-site postings render an <a> whose href is
 * `/safety/go/?url=<encoded employer url>`; `searchParams` decodes it for us.
 * Easy Apply renders a <button> instead and has no off-site URL, so null.
 */
function applyUrl() {
  const a = document.querySelector('a[href*="/safety/go/?url="]');
  if (!a) return null;
  try {
    return new URL(a.href).searchParams.get('url');
  } catch {
    return null;
  }
}

/**
 * The visible job title and company.
 *
 * Best-effort only: the background enriches from the posting's own page, whose
 * <title> is "Position | Company | LinkedIn" and is far steadier than anything
 * in this DOM. This just gives the panel something to show immediately.
 */
function visibleHeading() {
  const a = document.querySelector('a[href*="/safety/go/?url="]');
  // Walk up from Apply to the card that contains it, then take its first
  // heading — structural, so it survives the class names changing.
  let card = a?.closest('section, div[class]');
  for (let i = 0; i < 6 && card; i++) {
    const h = card.querySelector('h1, h2');
    if (h && h.innerText.trim()) return h.innerText.trim().slice(0, 200);
    card = card.parentElement;
  }
  const h1 = document.querySelector('h1');
  return h1 ? h1.innerText.trim().slice(0, 200) : '';
}

/**
 * The posting's card — the widest block containing the Apply link.
 *
 * Found by walking up from Apply until the box is wide enough to be the detail
 * column rather than a button row. Measured, not matched, because every class
 * name on the page is hashed and changes between deploys.
 */
function detailCard() {
  let el = document.querySelector('a[href*="/safety/go/?url="]')?.parentElement;
  // The detail column is wide, but the page wrapper around it is wider still.
  // Climbing to the first merely-wide ancestor overshoots to that wrapper,
  // whose top sits at the top of the document — which is how the panel ended up
  // pinned to the top of the window instead of beside the posting.
  const maxWidth = window.innerWidth * 0.7;
  let card = null;

  for (let i = 0; i < 14 && el; i++) {
    const r = el.getBoundingClientRect();
    if (r.width > maxWidth) break;
    if (r.width >= 380) card = el;
    el = el.parentElement;
  }
  return card;
}

/** How deep an element sits, used to prefer the tightest block over its wrappers. */
function depthOf(el) {
  let d = 0;
  for (let p = el.parentElement; p; p = p.parentElement) d++;
  return d;
}

/**
 * The job description, read from the pane.
 *
 * The posting's own page carries no ld+json — confirmed against a real capture,
 * which came back with an empty description — so this DOM is the only source.
 * The block is found by measurement rather than by selector: the deepest
 * element holding a substantial amount of text is the description body, and
 * depth is what stops an outer wrapper (which contains it, plus the whole rest
 * of the page) from winning on length alone.
 */
function visibleDescription() {
  let best = null;
  let bestScore = 0;

  // Scored over the whole page rather than a container: the Apply button lives
  // in the header, so anything anchored to it excludes the description sitting
  // below. Link density does the separating instead — a description is a long
  // run of prose with few links, while the results column beside it is equally
  // long but almost entirely links. Depth breaks ties toward the tightest
  // wrapper, so an outer layout div never wins over the body it contains.
  for (const el of document.querySelectorAll('div, section, article')) {
    const len = (el.textContent || '').trim().length;
    if (len < 600) continue;
    const links = el.querySelectorAll('a').length;
    const score = len / (1 + links * 60) + depthOf(el);
    if (score > bestScore) {
      best = el;
      bestScore = score;
    }
  }
  if (!best) return '';

  // innerText first, since it keeps the line breaks a description depends on;
  // textContent covers the case where the block is collapsed behind "see more".
  const text = best.innerText?.trim() || best.textContent?.trim() || '';
  return text
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .slice(0, 20000);
}

/** "Chaska, MN" or "Remote", taken from the card's own header line. */
function visibleLocation() {
  const head = (detailCard()?.innerText || '').slice(0, 600);
  const city = head.match(/\b([A-Z][A-Za-z.\-']+(?:[ \t][A-Z][A-Za-z.\-']+){0,2},\s*[A-Z]{2})\b/);
  if (city) return city[1];
  return /\bremote\b/i.test(head) ? 'Remote' : '';
}

/**
 * LinkedIn's overflow (…) menu, which sits in the corner we want.
 *
 * Matched on its aria-label rather than a class, since the labels are real
 * words and the classes are hashes.
 */
function overflowMenu(card) {
  return (
    [...card.querySelectorAll('button')].find((b) =>
      /more|option/i.test(b.getAttribute('aria-label') || ''),
    ) ?? null
  );
}

/**
 * Put the button in the posting card's top-right corner.
 *
 * Anchored to the card itself rather than to the viewport: absolute positioning
 * inside it means the card's own box does the work, so the button scrolls and
 * reflows with the posting and needs no scroll or resize handling. The card is
 * given a positioning context only if it lacks one.
 *
 * Returns the shadow root, or null when the card isn't on screen yet — the
 * detail pane renders after the results list, so early calls simply miss.
 */
function mountPanel() {
  const card = detailCard();
  if (!card) return null;

  const existing = document.getElementById(PANEL_ID);
  // Still in the right place: reuse it rather than rebuild and lose its state.
  if (existing && existing.parentElement === card) return existing.shadowRoot;
  existing?.remove();

  if (getComputedStyle(card).position === 'static') card.style.position = 'relative';

  // The … menu owns this corner, so move it down to make room. A transform
  // rather than a margin: it shifts what you see without disturbing the
  // surrounding layout, and it undoes itself when LinkedIn rebuilds the card.
  const menu = overflowMenu(card);
  if (menu) menu.style.transform = 'translateY(46px)';

  const host = document.createElement('div');
  host.id = PANEL_ID;
  host.style.position = 'absolute';
  host.style.top = '12px';
  host.style.right = '16px';
  host.style.zIndex = '2';

  // Shadow DOM: LinkedIn's stylesheet cannot reach in, and ours cannot leak out.
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `
    <style>
      .btn {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 150px;
        height: 46px;
        padding: 0 6px 0 16px;
        /* A pale tint of the portfolio accent, so the pill is pink at rest
           without shouting on someone else's page. */
        background: #f0e2e9;
        border: none;
        border-radius: 50px;
        color: #a53860;
        font: 700 13.5px/1 system-ui, sans-serif;
        letter-spacing: .01em;
        outline: none;
        cursor: pointer;
        /* Neumorphic: shadow one way, highlight the other, so the pill is
           extruded from the card rather than floating over it. */
        box-shadow:
          4px 4px 9px rgba(74, 20, 45, 0.22),
          -4px -4px 9px #ffffff;
        transition: box-shadow .17s cubic-bezier(.22,.8,.3,1);
      }

      /* The raised knob, lit from the same angle as the pill it sits in. */
      .knob {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: none;
        width: 34px;
        height: 34px;
        border-radius: 50%;
        background: #f0e2e9;
        font-size: 16px;
        line-height: 1;
        color: #a53860;
        box-shadow:
          3px 3px 6px rgba(74, 20, 45, 0.24),
          -3px -3px 6px #ffffff;
        transition: box-shadow .17s cubic-bezier(.22,.8,.3,1),
                    transform .17s cubic-bezier(.22,.8,.3,1);
      }

      /* Hover presses the pill into the surface: the shadows invert from raised
         to recessed, which is the whole neumorphic trick. No hue change — the
         feedback is physical, so the colour stays put and only the light moves.
         Snappy easing, because a real button doesn't ease in over a third of a
         second; it gives way. */
      .btn:hover:not([disabled]) {
        box-shadow:
          inset 4px 4px 7px rgba(74, 20, 45, 0.30),
          inset -4px -4px 7px #ffffff;
      }
      /* The knob sinks with it, a step shallower so the glyph stays readable. */
      .btn:hover:not([disabled]) .knob {
        box-shadow:
          inset 2px 2px 4px rgba(74, 20, 45, 0.26),
          inset -2px -2px 4px #ffffff;
      }
      /* Label and knob ride down with the surface they sit on. */
      .btn:hover:not([disabled]) #label,
      .btn:hover:not([disabled]) .knob { transform: translateY(1px); }

      /* Active bottoms out — deeper still, so a click reads past the hover. */
      .btn:active:not([disabled]) {
        box-shadow:
          inset 5px 5px 9px rgba(74, 20, 45, 0.38),
          inset -4px -4px 8px #ffffff;
      }
      .btn:active:not([disabled]) .knob {
        box-shadow: inset 2px 2px 5px rgba(74, 20, 45, 0.32);
        transform: translateY(2px);
      }

      /* Settled states keep the soft surface, only the hue changes. */
      .btn[disabled] { cursor: default; }
      .btn.done { background: #dfeee4; color: #2f6b45; }
      .btn.done .knob { background: #dfeee4; color: #2f6b45; }
      .btn.err { background: #f6e0da; color: #a35242; }
      .btn.err .knob { background: #f6e0da; color: #a35242; }

      /* Three signals read off the posting, filling the pill's width evenly. */
      .bento {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 6px;
        width: 150px;
        margin-top: 8px;
      }
      .cell {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 3px;
        height: 42px;
        border-radius: 10px;
        background: #f0e2e9;
        color: #a53860;
        font: 700 9px/1 system-ui, sans-serif;
        letter-spacing: -.01em;
        /* Lit from the same angle as the pill, so the set reads as one object. */
        box-shadow:
          3px 3px 6px rgba(74, 20, 45, 0.20),
          -3px -3px 6px #ffffff;
      }
      #label { transition: transform .17s cubic-bezier(.22,.8,.3,1); }

      .cell svg { width: 12px; height: 12px; }
      .cell .v { white-space: nowrap; }
      /* Unstated in the posting — not the same as a negative answer. */
      .cell.off {
        background: #f4f4f6;
        color: #b9bcc4;
        box-shadow:
          2px 2px 5px rgba(0, 0, 0, 0.05),
          -2px -2px 5px #ffffff;
      }
      /* An explicit refusal to sponsor is worth seeing at a glance. */
      .cell.warn { background: #fdecea; color: #b23c2a; }

      .note {
        width: 150px;
        margin-top: 6px;
        font: 11px/1.45 system-ui, sans-serif;
        color: #5f6a75;
        text-align: center;
      }
    </style>
    <button class="btn" id="go" type="button">
      <span id="label">Queue</span>
      <span class="knob" id="knob">+</span>
    </button>
    <div class="bento" id="bento">
      <div class="cell off" id="c-visa" title="Visa sponsorship">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18" />
        </svg>
        <span class="v">—</span>
      </div>
      <div class="cell off" id="c-exp" title="Years of experience">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
        </svg>
        <span class="v">—</span>
      </div>
      <div class="cell off" id="c-pay" title="Pay range">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 2v20M17 6.5C17 4.6 14.8 3.5 12 3.5S7 4.6 7 6.5s2.2 3 5 3.5 5 1.6 5 3.5-2.2 3-5 3-5-1.1-5-3" />
        </svg>
        <span class="v">—</span>
      </div>
    </div>
    <div class="note" id="note"></div>
  `;

  card.appendChild(host);
  return root;
}

let lastJobId = null;

/**
 * Fill the three signal cells from the posting's text.
 *
 * Run once per posting rather than on every tick: reading the description walks
 * the whole document, which is far too costly to repeat on a timer.
 */
function renderSignals(root, text) {
  const set = (id, value, cls) => {
    const cell = root.getElementById(id);
    cell.className = 'cell' + (value ? (cls ? ` ${cls}` : '') : ' off');
    cell.querySelector('.v').textContent = value ?? '—';
  };

  const visa = detectSponsorship(text);
  set(
    'c-visa',
    visa === 'no' ? 'No H1B' : visa === 'yes' ? 'H1B' : null,
    visa === 'no' ? 'warn' : '',
  );
  set('c-exp', detectYears(text), '');
  set('c-pay', detectPay(text), '');
}

function setState(state, text) {
  const root = document.getElementById(PANEL_ID)?.shadowRoot;
  if (!root) return;

  const btn = root.getElementById('go');
  btn.className = 'btn' + (state === 'done' ? ' done' : state === 'err' ? ' err' : '');
  btn.disabled = state === 'saving' || state === 'done';

  // Label and knob are written separately, so the knob keeps its own shape.
  root.getElementById('label').textContent =
    state === 'saving' ? 'Queuing…' : state === 'done' ? 'Queued' : 'Queue';
  root.getElementById('knob').textContent =
    state === 'done' ? '✓' : state === 'err' ? '!' : '+';
  root.getElementById('note').textContent = text ?? '';
}

async function queue() {
  const externalId = currentJobId();
  if (!externalId) return setState('err', 'No job selected.');

  setState('saving');
  const job = {
    source: 'linkedin',
    externalId,
    jobUrl: `https://www.linkedin.com/jobs/view/${externalId}/`,
    applyUrl: applyUrl(),
    position: visibleHeading(),
    company: '',
    location: visibleLocation(),
    description: visibleDescription(),
  };

  console.info('[job-tracker] capturing', {
    jobId: externalId,
    descriptionChars: job.description.length,
    location: job.location,
    applyUrl: job.applyUrl ? 'found' : 'none (Easy Apply?)',
  });

  chrome.runtime.sendMessage({ type: 'queue-job', job }, (res) => {
    if (chrome.runtime.lastError) return setState('err', 'Extension reloaded — refresh.');
    if (!res?.ok) {
      const e = res?.error ?? 'Failed.';
      return setState('err', /not signed in/i.test(e) ? 'Sign in from the toolbar.' : e.slice(0, 90));
    }
    setState('done', job.applyUrl ? '' : 'Easy Apply — no employer link');
  });
}

function sync() {
  const id = currentJobId();

  // Off the jobs pages entirely: take the button away rather than leave it.
  if (!id) {
    document.getElementById(PANEL_ID)?.remove();
    lastJobId = null;
    return;
  }

  const host = document.getElementById(PANEL_ID);
  const mounted = host && host.parentElement === detailCard();
  // Nothing to do while the same posting is shown and the button is still in
  // place; LinkedIn rebuilding the card underneath it counts as not in place.
  if (id === lastJobId && mounted) return;

  const root = mountPanel();
  if (!root) return; // Detail pane not rendered yet; the next tick will catch it.

  lastJobId = id;
  root.getElementById('go').onclick = queue;
  setState('idle');
  renderSignals(root, visibleDescription());
}

// The SPA swaps postings without navigating, and rebuilds the action row when
// it does, so poll rather than assume a page load per posting. Cheap, and it
// covers history changes, in-pane clicks, and back/forward alike.
setInterval(sync, 600);
sync();

// So this script is identifiable in a console full of other extensions.
console.info('[job-tracker] content script ready, job id:', currentJobId());
