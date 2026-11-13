# Schedule

Every scheduled GitHub Actions job in this repo. Times are Central (America/Chicago): each
`schedule:` entry carries `timezone: America/Chicago`, which GitHub Actions honours, so the clock
change in March and November no longer moves a job. Rebalanced 1 Nov 2026 (owner-approved weekly
schedule); see the notes below for what moved.

| Job | Workflow | When | Cron |
|---|---|---|---|
| Content Publish (releases due resources to main) | `content-publish.yml` | Thu 04:10 CT | `10 4 * * 4` |
| Search Loop (seq23/search-loop@v1) | `search-loop.yml` | daily 06:17 CT (+ engine stagger 0–39 min) | `17 6 * * *` |
| Search Intelligence (Search Console truth, index coverage, sitemap status) | `search-intelligence.yml` | daily 06:40 CT | `40 6 * * *` |
| Weekly Outcome Report (week over week, one self-closing issue) | `weekly-outcome-report.yml` | Mon 06:49 CT | `49 6 * * 1` |
| Entity Backlink Watch (refetch every sameAs profile, self-heal `entity.json`) | `entity-backlink-watch.yml` | Wed 05:25 CT | `25 5 * * 3` |

## Notes

- Added 3 Nov 2026 (Search Readiness e4, e5, i6, i9): Search Intelligence runs at 06:40 CT, after
  the 06:17 search loop and before the 06:49 weekly report, so the report always reads that
  morning's numbers. Search Intelligence shares the `main-automation` concurrency group with the
  search loop, because both commit to `main` and a race would lose one of them. The Monday
  06:49 CT report is deliberately inside the otherwise-clear Monday window: it only reads files and
  opens an issue, and it has to land before her Monday morning.
- Added 3 Nov 2026 (Search Readiness k6): Entity Backlink Watch runs Wednesdays 05:25 CT - clear of
  Thursday's content publish, of the 06:17 search loop and 06:40 search intelligence, and of the
  Monday window. It also runs on any push to `main` that touches `entity.json` or its own script, so
  a profile added in a PR is proved the moment it lands rather than up to a week later. It opens a PR
  when it heals the file and one self-closing issue when a profile stops naming the site; it never
  commits to `main` and never deploys.
- `post-deploy-live-check.yml` has no cron. It runs on every push to `main`, waits for the
  Cloudflare Pages check run on that commit, then looks at the live host.
- Monday 04:00–08:00 CT is kept clear: this repo's Monday jobs moved to quiet early-morning
  slots Tuesday–Saturday on 1 Nov 2026.

## Moved on 1 Nov 2026
- Content Publish: Monday → Thursday 04:10 CT.
- Monthly Query Intelligence: the 1st → the 3rd, 06:23 CT (monthly jobs no longer pile onto the 1st).
- Retired 1 Nov 2026: Monthly Auto Draft and Monthly Query Intelligence (both pushed to automation branches nobody merged; the search loop now finds and drafts). Search Loop added.

- Search Intelligence also collects aggregate AI referrals and AI-bot requests (f11), using the
  read-only `SEARCH_LOOP_ANALYTICS_TOKEN` Actions secret. It does not run the writer or checkpoint
  repair. Weekly Outcome Report uploads the shared `search-loop-week` schema from this ledger;
  unread days remain unread and a stale measurement fails the report instead of publishing zero.

- f11 repair, 4 Nov 2026: AI measurement runs as an independent job in Search Intelligence, so a refused Search Console read cannot suppress Cloudflare measurement. It uploads `search-loop-week` directly on each successful daily read; the readiness audit consumes Actions artifacts, not the committed report. Both jobs rebase before pushing their disjoint measurement files.
