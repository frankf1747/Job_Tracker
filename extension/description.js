/**
 * Finding the job description on a LinkedIn posting.
 *
 * Split out of content.js so it can be evaluated and tested without a browser.
 * Nothing here runs at load, and a manifest content script cannot be an ES
 * module, so there is nothing to export — a content script shares one isolated
 * world across its files, the same arrangement detect.js uses.
 *
 * The description is identified by LinkedIn's own section heading, not by
 * measurement. Measurement was the original approach and it failed on 10 of 48
 * captures: it scored every block on "long run of prose with few links", which
 * is true of the description and equally true of the employer-branding panels
 * beside it. Because it was a relative contest, a short posting lost to a long
 * panel, and the queue silently stored a company's recruiting blurb as a job.
 */

/** LinkedIn's own heading, rendered directly above the description body. */
const DESCRIPTION_HEADING = /^about the job$/i;

/** A block has to be at least this long to be a description body. */
const MIN_BODY = 600;

/**
 * Blocks that are long, link-poor prose and are not the description.
 *
 * Every pattern here was captured and stored in place of a real posting:
 * employer branding, Premium company insights, a company profile card, and a
 * video player's accessible text. This list is a backstop for the fallback
 * path, not the mechanism — the heading anchor is what actually fixes this.
 *
 * Anchored to the start deliberately. A posting is free to talk about career
 * growth or inclusion in its own body; only a block that *opens* with one of
 * these headings is the panel rather than the job.
 */
const NOT_DESCRIPTION = [
  /^career growth and learning\b/i,
  /^hiring & headcount\b/i,
  /^video player is loading\b/i,
  /^diversity,? equity,? and inclusion\b/i,
  // The company profile card: a name, then a follower count.
  /^\S[^\n]{0,80}\n[\d,]+ followers\b/i,
];

function isBoilerplate(text) {
  const t = (text || '').trim();
  if (!t) return false;
  return NOT_DESCRIPTION.some((re) => re.test(t));
}

function isVisible(el) {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

function textIn(el) {
  // innerText first, since it keeps the line breaks a description depends on;
  // textContent covers a block collapsed behind "see more".
  return (el.innerText || el.textContent || '').trim();
}

function tidy(text) {
  return text
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .slice(0, 20000);
}

function depthOf(el) {
  let d = 0;
  for (let p = el.parentElement; p; p = p.parentElement) d++;
  return d;
}

/**
 * The description section, located by its heading.
 *
 * Matched on the heading's own exact text so an ancestor — whose textContent
 * includes the whole body — cannot match instead. From there, the first
 * ancestor large enough to hold a body is the section: the tightest wrapper
 * containing both the heading and the prose under it.
 *
 * Only visible headings count. This page is a single-page app that keeps
 * previously-viewed postings in the DOM, so an offscreen heading belongs to a
 * job the user has already scrolled past — the same trap that once made the
 * extension read another company's apply URL.
 */
function descriptionSection() {
  for (const el of document.querySelectorAll('h1, h2, h3, h4, h5, div, span, p')) {
    // Leaves only. Reading textContent on a container concatenates its whole
    // subtree, and on this page that is thousands of large subtrees; the
    // element actually holding the heading text has no element children of its
    // own, whether LinkedIn writes it as <h2>About the job</h2> or wraps it in
    // a span.
    if (el.childElementCount > 0) continue;
    if (!DESCRIPTION_HEADING.test((el.textContent || '').trim())) continue;
    if (!isVisible(el)) continue;
    for (let p = el.parentElement; p; p = p.parentElement) {
      if (textIn(p).length >= MIN_BODY) return p;
    }
  }
  return null;
}

/**
 * The longest, least link-dense block on the page.
 *
 * The original approach, kept only for the case where the heading is absent —
 * a redesign, a locale that words it differently, or a layout that has not
 * loaded. Depth breaks ties toward the tightest wrapper, so an outer layout div
 * never wins over the body it contains.
 */
function bestScoringBlock() {
  let best = null;
  let bestScore = 0;
  for (const el of document.querySelectorAll('div, section, article')) {
    const len = (el.textContent || '').trim().length;
    if (len < MIN_BODY) continue;
    const links = el.querySelectorAll('a').length;
    const score = len / (1 + links * 60) + depthOf(el);
    if (score > bestScore) {
      best = el;
      bestScore = score;
    }
  }
  return best;
}

/**
 * The posting's description, or '' when it cannot be found.
 *
 * Returning '' rather than a best guess is the point. A wrong description is
 * invisible once stored — it reads as a real capture, and anything scoring the
 * queue later will score the recruiting blurb with complete confidence. An
 * empty one surfaces immediately as "No description found", which is a state
 * the user can act on.
 */
function readDescription() {
  const section = descriptionSection();
  const el = section || bestScoringBlock();
  if (!el) return '';
  const text = tidy(textIn(el));
  // A heading-anchored section is the description by construction; only the
  // fallback can land on a panel, so only the fallback is screened.
  if (!section && isBoilerplate(text)) return '';
  return text;
}
