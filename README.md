# Cynthia Brown DDS Site

Static personal-professional website for Dr. Cynthia Brown, DDS, designed for GitHub + Cloudflare Pages.

## Live domain

`https://cynthiabrowndds.com`

## Important architecture notes

- This is a static site. There is no backend, no database, no patient intake, and no PHI collection.
- `/admin/` is a soft-gated static review dashboard. It is not real authentication and must never contain patient data, secrets, or private health information.
- No approval step (owner ruling, 1 Nov 2026): resources release on their `scheduledAt` date. Items in `draft` or `needs_revision` render only under `/previews/`, which is disallowed in `robots.txt` and excluded from `sitemap.xml`.
- Public resources render only when `status` is `published`, or when `status` is `approved` and `scheduledAt` is due at build time.
- Visible site copy intentionally does not foreground third-party/corporate practice branding. Booking buttons route through the approved external booking page.

## Commands

```bash
npm run build
npm run validate:all
```

## Search loop (patient questions)

The shared engine `seq23/search-loop@v1` runs daily (`.github/workflows/search-loop.yml`, config `search-loop.config.json`):
it finds easy patient searches, writes gated pages to `questions/<slug>/index.html`, and publishes them straight away.
Every page ends in the one action (Book a visit, `/book/`). The engine's dental gate applies (no outcome claims, never
painless/pain-free, no medical advice, no invented reviews or credentials); before anything is pushed,
`.github/scripts/search_loop_post_build.sh` rebuilds the site and runs `scripts/validate_all.js`
(incl. `validate_dental_compliance.js`, which also blocks "best/top dentist", guarantees and before/after promises on question pages).
`scripts/build_site.js` folds the pages into `dist/`, the `/questions/` hub and the sitemap. The ledger and the weekly
`search-loop-week` report live in `data/search-loop/` and the Actions artifacts of this repo only.

## Content status rules

- `draft`: not public
- `ready_for_approval`: preview only
- `needs_revision`: preview only
- `approved`: public only after `scheduledAt` is due
- `published`: public
- `revoked`: not public

## Safety rules

- No diagnosis through the site.
- No treatment guarantees.
- No cost promises.
- No patient symptom submissions.
- No private health information.
- Dental resources must remain educational; the dental-claims check runs on every build.

## SEO / AEO / GEO System

This repo includes a static authority system for `https://cynthiabrowndds.com`:

- `dist/sitemap.xml` and `dist/robots.txt`
- per-page canonical URLs
- Open Graph metadata
- JSON-LD schema for the homepage, pages, resources, breadcrumbs, and FAQs
- `dist/answers.json` for answer-engine extraction
- `dist/llms.txt` for AI crawler orientation
- `data/aeo/citation_targets.json` for AI citation targets
- `data/geo/query_matrix.json` for query-to-content mapping

Resources that are not yet due stay out of the public resource archive, sitemap, and public answer records. They render only as preview pages for admin review.

## Query intelligence (retired 1 Nov 2026)

The monthly query-intelligence and auto-draft workflows were retired; the search loop now does finding and drafting.
Their data stays in `data/intake/` and `data/geo/` as history (`post_build_aeo_geo.js` still reads it for the admin summary).
Validators live in one registry, `data/system/validators.json`, which `scripts/validate_all.js` runs.
