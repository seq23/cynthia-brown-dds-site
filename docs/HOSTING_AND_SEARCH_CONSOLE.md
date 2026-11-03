# Hosting and Search Console: the settings that are not in this repo

Two things this site depends on live outside the repository, so nothing here can prove them and
nothing here will restore them. They are written down because the weekly Search Readiness audit
measures both, and because the last person to look should not have to rediscover them.

Both were applied on **3 November 2026** (Search Readiness briefs `a1`, `e1`, `e2`).

## 1. `www` 301s to the apex — a Cloudflare redirect rule, not `_redirects`

`https://www.cynthiabrowndds.com/` answered **200**, serving the same pages as the apex. Google
treats `www` and apex as two sites unless one redirects to the other, and split signals rank
nothing.

This **cannot** be fixed in `_redirects`. Cloudflare Pages matches `_redirects` on the path only —
there is no way to express "this host" there — and both hosts are custom domains on the same Pages
project, so Pages answers both itself.

The fix is a zone-level Single Redirect, which runs at the edge before Pages sees the request:

- Zone: `cynthiabrowndds.com` (`dd834aed2643d347fd927222b029ef29`)
- Phase: `http_request_dynamic_redirect`, ruleset **Canonical host**
- Rule ref: `canonical_host_www_to_apex`
- Expression: `(http.host eq "www.cynthiabrowndds.com")`
- Action: redirect **301** to `concat("https://cynthiabrowndds.com", http.request.uri.path)`,
  `preserve_query_string: true`

Proved live after applying: `/`, a deep `/questions/…` path, a URL with a query string, and plain
`http://` all 301 to the apex with path and query intact; the apex itself still answers 200.

**If `www` starts answering 200 again**, that rule was deleted or the zone was moved. Recreate it
with `PUT /zones/<zone>/rulesets/phases/http_request_dynamic_redirect/entrypoint`. Do not try to
solve it in `_redirects`; it will not work.

## 2. Search Console: a verified domain property, with the service account on it

There was **no** Search Console property for this domain at all, so no sitemap was registered and
every search number for this site was a guess.

- Property: `sc-domain:cynthiabrowndds.com`
- Verified by: **DNS TXT** on the apex (`google-site-verification=…`, TTL 300), published through
  the Cloudflare API. That TXT record is what holds the verification — **deleting it unverifies the
  property and the site goes dark in Search Console.** It is commented in Cloudflare so it is not
  mistaken for a stray record.
- Owner: the `gsc-bot` service account, so the automated readers can read it without anyone logging
  in.
- Sitemap submitted: `https://cynthiabrowndds.com/sitemap.xml` — 0 errors, 0 warnings at submission.

Re-read both of these as the service account rather than assuming: `sites.list` should contain
`sc-domain:cynthiabrowndds.com`, and its `sitemaps` list should show the sitemap with a recent
download. The credential is `GSC_SERVICE_ACCOUNT_JSON` in the Boss OS vault; nothing here needs a
human to sign in.
