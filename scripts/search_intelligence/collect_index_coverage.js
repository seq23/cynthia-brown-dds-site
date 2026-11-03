'use strict';
/**
 * e5 — IS GOOGLE DECLINING THESE PAGES, OR HAS IT NOT FOUND THEM?
 *
 * URL Inspection answers that per page, free, and the answer decides what to do next: pages
 * crawled-and-not-indexed are a quality problem, pages merely discovered are a discovery problem,
 * and the two want opposite work. Without this file both look the same - "not ranking".
 *
 * Writes data/search_intelligence/index_coverage.json: a verdict per sitemap URL, rotating 150 URLs
 * a day oldest-checked-first, 8 inspections in flight (the checklist's shape; the API quota is
 * 2,000 inspections a day across every property). Today's sitemap is the full target list, so a URL
 * that leaves the sitemap leaves this file.
 *
 * A URL the API refused is recorded with its reason and keeps its previous verdict marked stale -
 * never counted as "not indexed", which would read as a quality problem that does not exist.
 */
const fs = require('fs');
const path = require('path');
const g = require('./lib/gsc');

const ROOT = path.resolve(__dirname, '../..');
const DIR = path.join(ROOT, 'data/search_intelligence');
const OUT = path.join(DIR, 'index_coverage.json');
const SITEMAP = path.join(ROOT, 'dist/sitemap.xml');
const PER_DAY = 150;
const WIDTH = 8;

const readJson = (f, fallback) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return fallback; } };

function sitemapUrls() {
  if (!fs.existsSync(SITEMAP)) {
    g.stop('SITEMAP_NOT_BUILT', `${path.relative(ROOT, SITEMAP)} does not exist; run \`npm run build\` before collecting coverage`);
  }
  const xml = fs.readFileSync(SITEMAP, 'utf8');
  const urls = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
  if (!urls.length) g.stop('SITEMAP_EMPTY', 'the built sitemap lists no URLs, so there is nothing to inspect');
  return [...new Set(urls)];
}

/** indexStatusResult.coverageState, bucketed the way the item asks: the four answers that differ. */
function bucket(r) {
  if (!r.ok) return 'unknown';
  const state = String(r.coverageState || '').toLowerCase();
  if (r.verdict === 'PASS' || /^submitted and indexed|^indexed/.test(state)) return 'indexed';
  if (/crawled - currently not indexed|crawled but not indexed/.test(state)) return 'crawled_not_indexed';
  if (/discovered - currently not indexed|discovered/.test(state)) return 'discovered';
  if (/excluded|duplicate|alternate|redirect|noindex|blocked|not found|soft 404|error/.test(state)) return 'excluded';
  return 'unknown';
}

async function main() {
  const site = g.siteUrl();
  const urls = sitemapUrls();
  const prev = readJson(OUT, null);
  const seen = new Map(Object.entries(prev?.urls || {}));

  // Oldest inspection first, never-inspected before that: every URL comes round within days.
  const order = [...urls].sort((a, b) => {
    const ta = seen.get(a)?.inspected_at || '';
    const tb = seen.get(b)?.inspected_at || '';
    return ta === tb ? a.localeCompare(b) : ta.localeCompare(tb);
  });
  const batch = order.slice(0, PER_DAY);

  const token = await g.accessToken();
  const day = g.centralDate();
  const results = await g.pool(batch, WIDTH, (u) => g.inspect(token, site, u));

  const next = {};
  let refused = 0; let quota = false;
  for (const u of urls) next[u] = seen.get(u) ? { ...seen.get(u) } : null;
  batch.forEach((u, i) => {
    const r = results[i];
    if (!r.ok) {
      refused++;
      quota = quota || !!r.quota;
      const before = seen.get(u);
      next[u] = before
        ? { ...before, stale: true, not_read: r.why }
        : { state: 'unknown', not_read: r.why, inspected_at: null };
      return;
    }
    next[u] = {
      state: bucket(r), verdict: r.verdict, coverage_state: r.coverageState,
      last_crawl: r.lastCrawlTime || null, robots: r.robotsTxtState || null, inspected_at: day,
    };
  });
  for (const u of urls) if (!next[u]) next[u] = { state: 'unknown', not_read: 'not inspected yet; it is in the rotation', inspected_at: null };

  const counts = { indexed: 0, crawled_not_indexed: 0, discovered: 0, excluded: 0, unknown: 0 };
  for (const u of urls) counts[next[u].state in counts ? next[u].state : 'unknown']++;

  if (refused === batch.length) {
    g.stop(quota ? 'URL_INSPECTION_QUOTA' : 'URL_INSPECTION_REFUSED',
      `every one of the ${batch.length} inspections was refused (${results[0]?.why || 'no reason given'}); `
      + 'nothing was written, so yesterday\'s file stays the newest honest answer');
  }

  const out = {
    schema: 'cbdds-index-coverage-v1',
    site,
    collected_at: new Date().toISOString(),
    day,
    sitemap_total: urls.length,
    inspected_today: batch.length - refused,
    refused_today: refused,
    rotation: { per_day: PER_DAY, parallel: WIDTH, order: 'oldest inspection first' },
    counts,
    urls: Object.fromEntries(urls.map((u) => [u, next[u]])),
  };
  fs.writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
  console.log(
    `index_coverage: ${out.inspected_today}/${batch.length} inspected today of ${urls.length} sitemap URLs; `
    + Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ')
    + (refused ? ` (${refused} refused)` : ''));
}

main().catch((e) => g.stop('INDEX_COVERAGE_FAILED', e && e.stack ? e.stack.split('\n')[0] : String(e)));
