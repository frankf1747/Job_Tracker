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
 * The posting's primary action: the off-site Apply link, or the Easy Apply
 * button. Everything that needs to locate the card hangs off this, so both
 * kinds of posting are found the same way.
 */
function applyAnchor() {
  // Both kinds of control, in one list. Order does not decide the winner —
  // visibility does — because a posting is only ever one of the two.
  const candidates = [
    ...document.querySelectorAll('a[href*="/safety/go/?url="]'),
    ...document.querySelectorAll(
      'a[aria-label^="Easy Apply" i], button[aria-label^="Easy Apply" i]',
    ),
  ];

  // Only a control that is actually rendered counts. The SPA keeps previously
  // viewed postings in the DOM, so a stale off-site Apply link from an earlier
  // job is still matchable — and taking it would label an Easy Apply posting as
  // off-site and file it under another company's application URL.
  return (
    candidates.find((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }) ?? null
  );
}

/**
 * The employer's application page, unwrapped from LinkedIn's redirect.
 *
 * Read from the same anchor the card was found by, so the answer can never
 * describe a different posting than the one on screen. Null for Easy Apply,
 * which is handled inside LinkedIn and has no off-site URL.
 */
function applyUrl() {
  const a = applyAnchor();
  const href = a?.getAttribute('href') ?? '';
  if (!href.includes('/safety/go/?url=')) return null;
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
  const a = applyAnchor();
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
  let el = applyAnchor()?.parentElement;
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
/** "Chaska, MN" or "Remote", taken from the card's own header line. */
function visibleLocation() {
  const head = (detailCard()?.innerText || '').slice(0, 600);
  const city = head.match(/\b([A-Z][A-Za-z.\-']+(?:[ \t][A-Z][A-Za-z.\-']+){0,2},\s*[A-Z]{2})\b/);
  if (city) return city[1];
  return /\bremote\b/i.test(head) ? 'Remote' : '';
}

/**
 * LinkedIn's overflow (…) menu, which shares the corner we want.
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

  // Left in place and simply covered. Hiding it changed the header's height,
  // which moved the very edge the scroll fade measures against; overlaying it
  // keeps LinkedIn's layout exactly as it was. Earlier builds moved or hid it,
  // so undo both for tabs that are still open.
  const menu = overflowMenu(card);
  if (menu) {
    if (menu.style.transform) menu.style.transform = '';
    if (menu.style.display === 'none') menu.style.display = '';
  }

  const host = document.createElement('div');
  host.id = PANEL_ID;
  host.style.position = 'absolute';
  host.style.top = '12px';
  // Flush to the corner: the … menu is hidden, so nothing to clear.
  host.style.right = '16px';
  // Above LinkedIn's corner controls, which stay in the DOM underneath.
  host.style.zIndex = '20';
  host.style.transition = 'opacity .15s ease';

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

/**
 * LinkedIn's pinned chrome, cached per posting.
 *
 * Scanning every element is far too costly to repeat on scroll, but the set of
 * sticky containers only changes when the page rebuilds — so it is collected
 * once and only the rects are measured afterwards.
 */
let stickyEls = [];

function findSticky() {
  stickyEls = [...document.querySelectorAll('div, header, section, nav')].filter((el) => {
    const pos = getComputedStyle(el).position;
    return pos === 'sticky' || pos === 'fixed';
  });
}

/**
 * How far down the viewport that chrome currently reaches.
 *
 * Measured rather than assumed: the header is one height with LinkedIn's …
 * menu present and another once it is hidden, so any constant is wrong in one
 * of the two states. Only wide, short bands pinned near the top count — that
 * rules out full-height sticky sidebars and floating message widgets.
 */
function headerBottom() {
  let bottom = 0;
  for (const el of stickyEls) {
    const r = el.getBoundingClientRect();
    if (r.width > 320 && r.height > 0 && r.height < 240 && r.top < 60) {
      bottom = Math.max(bottom, r.bottom);
    }
  }
  return bottom;
}

/**
 * Hide the panel once it scrolls up behind that chrome.
 *
 * It sits inside the card, so it scrolls with the posting and slides under the
 * pinned header — leaving a sliver of the pill showing, which reads as a
 * rendering bug. Nothing can clip it (no ancestor owns its overflow), so it
 * fades instead, and stops taking clicks while out of sight.
 */
function updateVisibility() {
  const host = document.getElementById(PANEL_ID);
  if (!host) return;

  const behind = host.getBoundingClientRect().top < headerBottom() + 8;
  host.style.opacity = behind ? '0' : '1';
  host.style.pointerEvents = behind ? 'none' : 'auto';
}

/** Scroll fires far faster than paint; coalesce to one measure per frame. */
let queued = false;
function onScroll() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    updateVisibility();
  });
}

let lastJobId = null;

/**
 * What the button does for the posting on screen.
 *
 * Easy Apply postings are applied to inside LinkedIn and have no off-site URL,
 * so there is nothing useful to queue — the description is the only thing worth
 * taking away. The panel keeps its signal cells either way.
 */
let mode = 'queue';

const WORDING = {
  queue: { idle: 'Queue', busy: 'Queuing…', done: 'Queued', glyph: '+' },
  copy: { idle: 'Copy JD', busy: 'Copying…', done: 'Copied', glyph: '⧉' },
};

/**
 * Copy text, falling back to a selection when the async API is unavailable.
 *
 * navigator.clipboard needs a focused document and a user gesture; a click
 * satisfies both, but the older path covers the cases where it is still denied.
 */
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

async function copyDescription() {
  const text = readDescription();
  if (!text) return setState('err', 'No description found.');

  setState('saving');
  const ok = await copyText(text);
  if (!ok) return setState('err', 'Clipboard blocked.');

  setState('done', `${text.length.toLocaleString()} chars`);
  // Unlike queueing, copying is repeatable — settle back so it can be pressed
  // again rather than staying spent.
  setTimeout(() => setState('idle'), 1800);
}

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
  const words = WORDING[mode];
  root.getElementById('label').textContent =
    state === 'saving' ? words.busy : state === 'done' ? words.done : words.idle;
  root.getElementById('knob').textContent =
    state === 'done' ? '✓' : state === 'err' ? '!' : words.glyph;
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
    description: readDescription(),
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
      return setState(
        'err',
        /not signed in/i.test(e) ? 'Sign in from the toolbar.' : e.slice(0, 90),
      );
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
  // No off-site URL means Easy Apply: offer the description instead.
  mode = applyUrl() ? 'queue' : 'copy';
  console.info('[job-tracker] mounted', { jobId: id, mode });
  root.getElementById('go').onclick = mode === 'copy' ? copyDescription : queue;
  setState('idle');
  renderSignals(root, readDescription());
  findSticky();
  updateVisibility();
}

// The SPA swaps postings without navigating, and rebuilds the action row when
// it does, so poll rather than assume a page load per posting. Cheap, and it
// covers history changes, in-pane clicks, and back/forward alike.
setInterval(sync, 600);
addEventListener('scroll', onScroll, { passive: true, capture: true });
sync();

// So this script is identifiable in a console full of other extensions.
console.info('[job-tracker] content script ready, job id:', currentJobId());
