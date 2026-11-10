# Repo Validation Matrix

The one validator registry is `data/system/validators.json` (name, what it protects, why, kind, when it runs).
`scripts/validate_all.js` runs exactly that list on every PR and push (`npm run preflight` in `.github/workflows/build.yml`),
and after every search-loop publish (`.github/scripts/search_loop_post_build.sh`).

Site-wide SEO / AEO / GEO standards (titles, descriptions, schema, sitemap, entity identity,
bylines) are checked centrally: the search-loop engine gate and the Boss OS weekly search audit.
Per-repo copies of those checks were removed on 10 Nov 2026 (owner: only important checks stay).

Added 3 Nov 2026 (Search Readiness e4, e5, h4, i3, i6, i9): `validate_search_measurement.js` is a
merge gate over the measurement lane — the daily Search Console files, the index-coverage arithmetic,
the query history that may never shrink, the `:free`-only LLM router, and the three workflows that
write and report on all of it. It proves behaviour by making it happen (a paid model id is actually
put into the router's config and refused), and it hard-fails under twelve proofs so it cannot pass
having looked at nothing.

What is still only central: whether Google indexes a page, the Search Console numbers themselves,
and anything about the live host between two deploys. `scripts/live_check.js` narrows that last one —
it is the repo's own look at the live edge after every deploy of `main` — but it is a fault detector
after the fact, not a merge gate, because the thing it checks does not exist until the deploy does.

Added 3 Nov 2026 (Search Readiness k1, k2, k3, k6): `entity.json` is the one statement of who this
site is. Whether its outside profiles are still alive is the weekly `entity-backlink-watch.yml`: it
refetches each one, parks a dead profile and promotes a verified pending one as a PR. Its classifier
and self-heal are proved by `--self-test` before the job trusts them.

Added 3 Nov 2026 (Search Readiness i10): the $0 language-model ceiling was enforced in
`scripts/llm/router.js` but written down nowhere, so the next agent in the repo had no way to find it
before adding a paid call. `CLAUDE.md` now carries the rule where an agent starts reading and
`docs/cost/zero-paid-llm.md` holds it in full. `validate_search_measurement.js` guards the three
things that can rot - the rule line is there, every file the doc points at still exists, and the
ceiling the doc states is the ceiling `config/llm_routing.json` actually allows. It does not pin any
wording: a doc that claims $0 while the config allows spending is the defect, not a phrasing change.

Added 3 Nov 2026 (Search Readiness f11): `validate_ai_measurement.mjs` guards the daily AI
measurement boundary: real zero is accepted, missing/partial/refused sources cannot overwrite a day,
and old days are preserved. `scripts/collect_ai_analytics.mjs` uses the shared engine's hostname-only
Cloudflare reader and report builder, independently of content writing. Search Intelligence commits
the daily ledger and weekly snapshot; Weekly Outcome Report uploads `search-loop-week` from those
measurements. The report states its measured-day coverage, so a first day is never called a full week.

The head/schema validator also checks every built local img src exists and is at most 1 MB, including picture fallbacks (5 Nov live audit).
