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
