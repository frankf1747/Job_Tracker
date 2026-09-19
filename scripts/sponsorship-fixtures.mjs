/**
 * Work-authorisation phrasings, and what each one means.
 *
 * Shared by the extension's detector and the triage gate, which are separate
 * implementations for separate runtimes — a content script and a node script —
 * and had already drifted: a Beghou posting that refuses sponsorship in two
 * sentences was read by one as *offering* it and by the other as silent.
 *
 * `sponsors` is what detectSponsorship should return.
 * `gate` is what gateFor should fire, or null.
 */
export const SPONSORSHIP_FIXTURES = [
  {
    name: 'a refusal written as an exclusion of candidates',
    // Verbatim from the posting that was misread as sponsoring.
    text:
      'We are currently unable to consider candidates who require, or will require in the ' +
      'future, sponsorship for work authorization . Applicants must be authorized to work in ' +
      'the US on a permanent and ongoing basis without the need for current or future ' +
      'employer-sponsored work authorization.',
    sponsors: 'no',
    gate: 'authorization',
  },
  {
    name: 'the plainest refusal',
    text: 'We do not sponsor employment visas at this time.',
    sponsors: 'no',
    gate: 'authorization',
  },
  {
    name: 'a refusal phrased as ineligibility',
    text: 'This position is not eligible for visa sponsorship.',
    sponsors: 'no',
    gate: 'authorization',
  },
  {
    name: 'a refusal phrased as a requirement on the applicant',
    text: 'Applicants must be authorized to work in the U.S. without sponsorship.',
    sponsors: 'no',
    gate: 'authorization',
  },
  {
    name: 'the long corporate refusal',
    text:
      'We are unable to sponsor or take over sponsorship of an employment visa at this time, ' +
      'and cannot consider applicants requiring such support.',
    sponsors: 'no',
    gate: 'authorization',
  },
  {
    name: 'citizenship, which answers the same question',
    text: 'Must be a US citizen. This role supports federal contracts.',
    sponsors: 'no',
    gate: 'clearance',
  },
  {
    name: 'an offer',
    text: 'We are happy to sponsor H1B visas for exceptional candidates.',
    sponsors: 'yes',
    gate: null,
  },
  {
    name: 'an offer stated about the sponsorship rather than the employer',
    text: 'Visa sponsorship is available for this role.',
    sponsors: 'yes',
    gate: null,
  },
  {
    name: 'silence, which is not a no',
    text: 'We are looking for a data analyst with strong SQL skills and a growth mindset.',
    sponsors: null,
    gate: null,
  },
];
