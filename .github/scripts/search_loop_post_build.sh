#!/usr/bin/env bash
# Runs after the engine published pages, before the commit step.
# Builds the site (folds /questions/ into dist, the sitemap and the questions hub)
# and runs the repo's validators. Any failure fails this step, so the engine's
# commit step is skipped and nothing unsafe reaches main.
set -euo pipefail
node scripts/build_site.js
if ! node scripts/validate_all.js; then
  echo "NAMED STOP [SITE_VALIDATORS_FAILED] a published page failed this repo's validators (see above); nothing was committed, the next run retries" >&2
  exit 1
fi
