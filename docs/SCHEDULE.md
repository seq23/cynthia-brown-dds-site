# Schedule

Every scheduled GitHub Actions job in this repo. Times are Central (America/Chicago): each
`schedule:` entry carries `timezone: America/Chicago`, which GitHub Actions honours, so the clock
change in March and November no longer moves a job. Rebalanced 1 Nov 2026 (owner-approved weekly
schedule); see the notes below for what moved.

| Job | Workflow | When | Cron |
|---|---|---|---|
| Content Publish | `content-publish.yml` | Thu 04:10 CT | `10 4 * * 4` |
| Monthly Auto Draft | `monthly-auto-draft.yml` | day 15 of every month 07:41 CT | `41 7 15 * *` |
| Monthly Query Intelligence | `monthly-query-intelligence.yml` | day 3 of every month 06:23 CT | `23 6 3 * *` |

## Notes

- Monday 04:00–08:00 CT is kept clear: this repo's Monday jobs moved to quiet early-morning
  slots Tuesday–Saturday on 1 Nov 2026.

## Moved on 1 Nov 2026
- Content Publish: Monday → Thursday 04:10 CT.
- Monthly Query Intelligence: the 1st → the 3rd, 06:23 CT (monthly jobs no longer pile onto the 1st).
