# Repo Validation Matrix

The one validator registry is `data/system/validators.json` (name, what it protects, why, kind, when it runs).
`scripts/validate_all.js` runs exactly that list on every PR and push (`npm run preflight` in `.github/workflows/build.yml`),
and after every search-loop publish (`.github/scripts/search_loop_post_build.sh`).

Site-wide SEO / AEO / GEO standards are set centrally (the search-loop engine gate and the weekly
search-readiness audit). The parts of that contract this repo's own build can break on its own are
also a merge gate here, in `validate_head_and_schema.js`: titles, meta descriptions, og tags, the
Organization / WebPage / BreadcrumbList / LocalBusiness nodes, and the root files a crawler asks for
by a fixed path. A central audit runs weekly and is not a merge gate, so between two runs this repo
could ship — and did, on 3 Nov 2026 — 139-character titles, a soft 404 on every unknown path, and
pages that named no business. Anything the central audit measures that the build cannot decide
(indexing, Search Console, live hosts) is still checked only centrally.

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
site is, and `validate_entity_graph.js` is a merge gate over it - the file is about this host, names
at least one third-party profile with an evidence record, never names this site's own host, and every
built page publishes exactly that identity as the first JSON-LD a reader meets. The build itself stops
with a named stop rather than publishing an identity with no external profile. What a merge gate
cannot decide is whether those profiles are still alive out in the world, so that is the weekly
`entity-backlink-watch.yml`: it refetches each one, parks a dead profile and promotes a verified
pending one as a PR, and opens one self-closing issue when a profile that is supposed to link back
stops doing so. Its classifier and self-heal are proved by `--self-test` before the job trusts them.
