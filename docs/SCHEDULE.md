# Schedule

Every scheduled GitHub Actions job in this repo. Times are Central (America/Chicago): each
`schedule:` entry carries `timezone: America/Chicago`, which GitHub Actions honours, so the clock
change in March and November no longer moves a job. Rebalanced 1 Nov 2026 (owner-approved weekly
schedule); see the notes below for what moved.

| Job | Workflow | When | Cron |
|---|---|---|---|
| Content Publish (releases due resources to main) | `content-publish.yml` | Thu 04:10 CT | `10 4 * * 4` |
| Search Loop (seq23/search-loop@v1) | `search-loop.yml` | daily 06:17 CT (+ engine stagger 0–39 min) | `17 6 * * *` |

## Notes

- Monday 04:00–08:00 CT is kept clear: this repo's Monday jobs moved to quiet early-morning
  slots Tuesday–Saturday on 1 Nov 2026.

## Moved on 1 Nov 2026
- Content Publish: Monday → Thursday 04:10 CT.
- Monthly Query Intelligence: the 1st → the 3rd, 06:23 CT (monthly jobs no longer pile onto the 1st).
- Retired 1 Nov 2026: Monthly Auto Draft and Monthly Query Intelligence (both pushed to automation branches nobody merged; the search loop now finds and drafts). Search Loop added.
