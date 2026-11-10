# Working in this repository

The operating authority for this repo is [`AGENTS.md`](AGENTS.md) (source of authority, entry
points, operating law) and [`REPO_IDENTITY.md`](REPO_IDENTITY.md) (what this site is, and the brand
rules that bind its copy). Read those first. This file carries the few rules an agent needs before
it writes a single line, so they are where a reader looks rather than three files deep.

## Cost: nothing paid

**Nothing paid.** This repository spends $0 on a language model. Every model id must end in `:free`,
there is no paid fallback, and [`scripts/llm/router.js`](scripts/llm/router.js) is the only door to a
model — it refuses a paid id before a request is made. The full rule, and what is paid for elsewhere
and is not a model, is [`docs/cost/zero-paid-llm.md`](docs/cost/zero-paid-llm.md).
`scripts/validate_search_measurement.js` fails the build if that doc or this line disappears, or if
the doc and `config/llm_routing.json` stop agreeing.

## This is a client's site, and it is a health site

- The repository is **public**. Nothing confidential, no patient data, no email addresses, no
  secrets, ever — including in `/admin/`, which is a review dashboard, not a place for real data.
- **No dental claims.** No guarantees, no "best" or "top" dentist, no pain-free or painless, no
  before-and-after promises, no cures. `scripts/validate_dental_compliance.js` is the gate.
- **No page collects patient health information** (`scripts/validate_no_phi_forms.js`).
- Patients are only ever sent to the approved booking page in
  `data/system/booking_links.json` (`scripts/validate_booking_links.js`).
- Do not foreground the practice group in visible site copy (`REPO_IDENTITY.md`).

## Who this site is

[`entity.json`](entity.json) is the one statement of the site's identity — name, logo, description
and the external profiles that are the same real-world practitioner. The published JSON-LD is built
from it, the central search audit (Boss OS) flags a page where the two disagree, and
`.github/workflows/entity-backlink-watch.yml` rechecks the profiles every week. Never type a name,
logo or profile URL into a template; change `entity.json`.

Its `author` block is the one statement of who reviewed the words. The templates render it as the
visible `rel="author"` byline on every indexable page and `scripts/post_build_aeo_geo.js` publishes
it as that page's JSON-LD author; the central search audit flags a page whose byline,
JSON-LD author and this file disagree. A byline carries a name and a credential and never a date: a
"last reviewed" line would be a freshness claim the build cannot prove.

## Proving a change

- `npm run preflight` — build, then every validator in the one registry,
  `data/system/validators.json`. That is the merge gate (`.github/workflows/build.yml`).
- Never edit `dist/`; it is generated. Fix the generator, the template or the data file.
- A new rule gets a validator where the behaviour lives, listed in the registry and in
  `REPO_VALIDATION_MATRIX.md`. Never a validator over wording.
- Scheduled jobs are listed in [`docs/SCHEDULE.md`](docs/SCHEDULE.md); add a row when you add one.
