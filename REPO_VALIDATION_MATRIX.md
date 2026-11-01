# Repo Validation Matrix

The one validator registry is `data/system/validators.json` (name, what it protects, why, kind, when it runs).
`scripts/validate_all.js` runs exactly that list on every PR and push (`npm run preflight` in `.github/workflows/build.yml`),
and after every search-loop publish (`.github/scripts/search_loop_post_build.sh`).

Site-wide SEO / AEO / GEO standards are checked centrally (the search-loop engine gate and the weekly search-readiness audit), not here.
