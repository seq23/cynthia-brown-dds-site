'use strict';
/**
 * i6, third file — WHAT SEARCH CONSOLE SAYS ABOUT OUR SITEMAP.
 *
 * The sitemap is how 40 pages get found. If Google stopped downloading it, or started counting
 * errors in it, nothing else in this repository would notice: the build would still pass and the
 * pages would still be there. This writes data/search_intelligence/gsc_sitemaps.json so a drop in
 * `last_downloaded` is visible the day after it happens.
 */
const fs = require('fs');
const path = require('path');
const g = require('./lib/gsc');

const OUT = path.resolve(__dirname, '../../data/search_intelligence/gsc_sitemaps.json');

async function main() {
  const site = g.siteUrl();
  const token = await g.accessToken();
  const list = await g.sitemaps(token, site);
  if (!list.length) {
    g.stop('NO_SITEMAP_SUBMITTED',
      `Search Console has no sitemap for ${site}. Submit https://cynthiabrowndds.com/sitemap.xml; `
      + 'docs/HOSTING_AND_SEARCH_CONSOLE.md records that it was submitted on 3 November 2026, so this means it was removed.');
  }
  const out = {
    schema: 'cbdds-gsc-sitemaps-v1',
    site,
    collected_at: new Date().toISOString(),
    day: g.centralDate(),
    sitemaps: list.map((s) => ({
      path: s.path,
      last_submitted: s.lastSubmitted || null,
      last_downloaded: s.lastDownloaded || null,
      errors: Number(s.errors || 0),
      warnings: Number(s.warnings || 0),
      is_pending: !!s.isPending,
      submitted_urls: Number(s.contents?.[0]?.submitted || 0),
    })),
  };
  fs.writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
  for (const s of out.sitemaps) {
    console.log(`gsc_sitemaps: ${s.path} - ${s.errors} errors, ${s.warnings} warnings, last read ${String(s.last_downloaded).slice(0, 10)}`);
  }
}

main().catch((e) => g.stop('GSC_SITEMAPS_FAILED', e && e.stack ? e.stack.split('\n')[0] : String(e)));
