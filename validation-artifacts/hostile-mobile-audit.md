# Hostile Mobile / Architecture Review

Status: Remediated in this pass.

## Issues found and fixed

- Homepage hero image was lazy-loaded despite being the LCP image. Fixed with `loading="eager"`, `fetchpriority="high"`, and hero preload.
- Images lacked explicit dimensions. Fixed with width/height attributes on generated portrait images to reduce CLS.
- Font loading used CSS `@import`. Moved to document-level preconnect + stylesheet links.
- Mobile nav had basic open behavior but did not close on link click or Escape and did not update its aria label. Fixed.
- CSS used an undefined `--green` variable. Fixed to `--hunter` and added a validator to catch undefined variables.
- Admin and preview pages were robots-disallowed but lacked page-level noindex. Added `noindex, nofollow, noarchive` meta and Cloudflare X-Robots-Tag headers.
- Cache headers did not distinguish optimized immutable portraits from normal assets. Added cache-control rules.
- Mobile typography and spacing were functional but not tuned enough. Added 640px breakpoint refinements, touch-target rules, overflow protection, reduced-motion support, focus-visible states, and tighter mobile hero/card/article spacing.
- SEO metadata lacked `og:url` and Twitter/X card fields. Added.

## Validation performed

- `npm run ingest:queries` passed.
- `npm run build` passed.
- `npm run validate:all` passed.
- New validator added: `scripts/validate_mobile_performance_contract.js`.

## Browser screenshot status

Browser screenshot capture was attempted with system Chromium and Playwright using `/usr/bin/chromium`, but this container blocked navigation with `ERR_BLOCKED_BY_ADMINISTRATOR` and previous direct Chromium screenshot attempts timed out. Visual screenshot review is therefore not proven in-container. Mobile optimization is covered by static contracts and should still receive deployed/mobile device review after Cloudflare deploy.
