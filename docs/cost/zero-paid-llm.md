# This repository spends nothing on a language model

**Nothing paid.** The ceiling is $0, it is not a preference, and it is enforced in code rather than
remembered.

Owner's instruction, 11 October 2026: *"nothing should be paid … cut the probes and make them free."*
Applied in this repository on 3 November 2026.

## The rule

| | |
|---|---|
| Maximum spend on a model, per call and per month | **$0** |
| Paid fallback when the free lane is empty | **none** — a named stop instead |
| Model ids this repository may use | only ids ending in `:free` |
| Where the rule lives as data | [`config/llm_routing.json`](../../config/llm_routing.json) (`policy.max_cost_usd: 0`, `policy.paid_fallback: false`) |
| Where it is enforced | [`scripts/llm/router.js`](../../scripts/llm/router.js) — the only door to a model |
| Where it is proved | `scripts/validate_search_measurement.js`, a merge gate on every PR |

## Why one door

If any script may name its own model, one of them will one day name a paid one, and the bill arrives
a month later. So no script in this repository calls a provider endpoint directly. `scripts/llm/router.js`
loads the policy, refuses a model id that does not end in `:free` **before a request is made**, tries
the free models in order, and refuses the answer outright if the provider reports a non-zero cost
(`NAMED STOP [PAID_ANSWER]`). When no free model answers, that is
`NAMED STOP [NO_FREE_MODEL_ANSWERED]` — never a paid model, and never a quiet empty string a caller
would publish.

Nothing in this repository calls a model *today*: the patient-question pages are written by the
shared search-loop engine (`seq23/search-loop`), which runs its own $0 lanes and has no paid
fallback, and every collector here reads Search Console, which is not a model. The router exists so
that the first script which does need one cannot open its own door.

## What is paid for elsewhere, and is not a model

- **Cloudflare Pages** hosts the static site. No model runs at the edge.
- **`BRAVE_SEARCH_API_KEY`** is passed to the search loop for its can-be-#1 lane, on the free credit
  tier only (`.github/workflows/search-loop.yml`). It is a search API, not a model, and it has no
  paid tier enabled here.
- **Google Search Console** is read with a service account. Free.

## If this ever has to change

It does not change here. The ceiling is the owner's standing ruling, so a repository that needs a
paid model is a decision she makes, not a line edited in `config/llm_routing.json`. Raising
`max_cost_usd` above 0 makes `scripts/llm/router.js` throw
`NAMED STOP [PAID_ROUTING_CONFIG]` on load, so the change cannot pass quietly: every script that
asks for a model stops until the stop is dealt with.

## What reads this file

- `scripts/validate_search_measurement.js` fails the build if this file or the `nothing paid` line in
  [`CLAUDE.md`](../../CLAUDE.md) is gone, or if the ceiling stated here stops matching
  `config/llm_routing.json`. A rule a doc claims and the config contradicts is worse than no doc.
- The weekly Search Readiness audit (item **i10**) reads it from outside the repository, so a later
  agent cannot quietly drop it.
