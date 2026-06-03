# Cynthia Brown DDS Site

Static personal-professional website for Dr. Cynthia Brown, DDS, designed for GitHub + Cloudflare Pages.

## Live domain

`https://cynthiabrowndds.com`

## Important architecture notes

- This is a static site. There is no backend, no database, no patient intake, and no PHI collection.
- `/admin/` is a soft-gated static review dashboard. It is not real authentication and must never contain patient data, secrets, or private health information.
- Resource content is approval-gated. Drafts and ready-for-approval items render only under `/previews/` for review and are disallowed in `robots.txt` and excluded from `sitemap.xml`.
- Public resources render only when `status` is `published`, or when `status` is `approved` and `scheduledAt` is due at build time.
- Visible site copy intentionally does not foreground third-party/corporate practice branding. Booking buttons route through the approved external booking page.

## Commands

```bash
npm run build
npm run validate:all
```

## Admin approval workflow

1. Open `/admin/`.
2. Enter the soft gate password.
3. Preview the draft.
4. Click **Edit in GitHub**.
5. Edit wording or change `status` from `ready_for_approval` to `approved`.
6. Merge the change.
7. The publishing workflow rebuilds the static site and date-gates public resources.

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
- Dental resources must remain educational and reviewed before publication.

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

Unapproved resources stay out of the public resource archive, sitemap, and public answer records. They render only as preview pages for admin review.

## Query Intelligence + Month-13 Drafting

The query-intelligence workflow stores public question patterns only. It does not store raw posts, usernames, patient stories, private data, or PHI.

Current safe source lane:

- `manual-social-observations` enabled

API lanes exist but are disabled until keys and approval exist:

- Google Trends API
- YouTube Data API
- approved Reddit API/RSS access

After the first 12-month content calendar, the auto-draft workflow may create `ready_for_approval` draft candidates only. Auto-publish is forbidden by `data/system/automation_policy.json` and validator-enforced by `scripts/validate_auto_draft_contract.js`.
