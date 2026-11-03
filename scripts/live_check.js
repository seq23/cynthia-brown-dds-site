'use strict';
/**
 * h4 — WHAT THE EDGE ACTUALLY SERVES, AFTER THE DEPLOY.
 *
 * Every other check in this repository reads `dist/`. Between `dist/` and a patient there is a
 * Cloudflare Pages project, a zone-level redirect rule, a Pages Function middleware on /admin and
 * Cloudflare's cache - four things that can serve something the build never contained, and three of
 * them are configured outside this repository. This is the only check that looks at the live host.
 *
 * It fails the job on a miss, which is the point: a 200 on a path that must 404, a crawl file that
 * went missing, a key file that stopped answering or an /admin that opened are all silent otherwise.
 *
 * Read-only and credential-free: every request is an unauthenticated GET or HEAD.
 *
 * RULE 0: the URL list is built from the built sitemap and the repo's own key file, and the run
 * fails if that list comes out empty. A live check that checked nothing must never pass.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const HOST = 'https://cynthiabrowndds.com';
const WWW = 'https://www.cynthiabrowndds.com';
const UA = 'cynthia-brown-dds-site live-check (+https://github.com/seq23/cynthia-brown-dds-site)';
const TIMEOUT_MS = 20000;
/** Measured URLs: the whole sitemap when it is small, a bounded sample if it ever grows. */
const SAMPLE = 60;

const failures = [];
const notes = [];
let checks = 0;

function fail(why) { failures.push(why); }
function ok(what) { checks++; notes.push(`ok  ${what}`); }

async function get(url, { method = 'GET', redirect = 'manual' } = {}) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { method, redirect, headers: { 'user-agent': UA, 'cache-control': 'no-cache' }, signal: ac.signal });
    const body = method === 'GET' ? await r.text() : '';
    return { status: r.status, location: r.headers.get('location'), type: r.headers.get('content-type') || '', body };
  } catch (e) {
    return { status: 0, error: e.name === 'AbortError' ? `no answer in ${TIMEOUT_MS / 1000}s` : e.message, body: '', type: '' };
  } finally { clearTimeout(t); }
}

function sitemapUrls() {
  const f = path.join(ROOT, 'dist/sitemap.xml');
  if (!fs.existsSync(f)) return [];
  return [...new Set([...fs.readFileSync(f, 'utf8').matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]))];
}

function indexnowKey() {
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'search-loop.config.json'), 'utf8'));
  return cfg.indexnow?.key || null;
}

async function expect200(url, what, { contains = [], type = null } = {}) {
  const r = await get(url, { redirect: 'follow' });
  if (r.status !== 200) return fail(`${what}: ${url} answered ${r.status || r.error}`);
  if (type && !r.type.includes(type)) return fail(`${what}: ${url} is ${r.type || 'typeless'}, expected ${type}`);
  for (const s of contains) if (!r.body.includes(s)) return fail(`${what}: ${url} does not contain ${JSON.stringify(s).slice(0, 60)}`);
  ok(`${what} (${url.replace(HOST, '')})`);
  return r;
}

async function main() {
  // 1. Crawl files.
  await expect200(`${HOST}/robots.txt`, 'robots.txt', { contains: ['Sitemap:'] });
  await expect200(`${HOST}/sitemap.xml`, 'sitemap.xml', { contains: ['<urlset'] });
  await expect200(`${HOST}/llms.txt`, 'llms.txt');

  // 2. Icons, manifest and the share card - the four root files a9 put there.
  await expect200(`${HOST}/favicon.ico`, 'favicon.ico');
  await expect200(`${HOST}/apple-touch-icon.png`, 'apple-touch-icon.png');
  await expect200(`${HOST}/site.webmanifest`, 'site.webmanifest', { contains: ['"icons"'] });
  const og = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/system/site_config.json'), 'utf8')).defaultOgImage;
  await expect200(`${HOST}${og}`, 'og image', { type: 'image/' });

  // 3. The homepage's structured-data frame, as the edge serves it.
  const home = await get(`${HOST}/`, { redirect: 'follow' });
  if (home.status !== 200) fail(`homepage answered ${home.status || home.error}`);
  else {
    const blocks = [...home.body.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)];
    if (!blocks.length) fail('homepage serves no JSON-LD');
    const types = new Set();
    for (const b of blocks) {
      let json;
      try { json = JSON.parse(b[1]); } catch { fail('a JSON-LD block on the homepage does not parse as the edge serves it'); continue; }
      const walk = (x) => {
        if (Array.isArray(x)) return x.forEach(walk);
        if (!x || typeof x !== 'object') return;
        for (const t of [].concat(x['@type'] || [])) types.add(t);
        Object.values(x).forEach(walk);
      };
      walk(json);
    }
    for (const want of ['WebSite', 'WebPage', 'Dentist']) {
      if (types.has(want)) ok(`homepage schema has ${want}`);
      else fail(`homepage schema has no ${want} (served types: ${[...types].join(', ') || 'none'})`);
    }
    if (/og:site_name/.test(home.body)) ok('homepage serves og:site_name');
    else fail('homepage serves no og:site_name');
  }

  // 4. A real 404. Pages answered 200 with the homepage for every unknown path before a9.
  const miss = await get(`${HOST}/this-path-does-not-exist-live-check/`, { redirect: 'follow' });
  if (miss.status === 404) ok('an unknown path answers 404');
  else fail(`an unknown path answered ${miss.status || miss.error}, not 404`);

  // 5. www still 301s to the apex - a zone rule outside this repo (docs/HOSTING_AND_SEARCH_CONSOLE.md).
  const w = await get(`${WWW}/`);
  if (w.status === 301 && String(w.location || '').startsWith(HOST)) ok('www 301s to the apex');
  else fail(`${WWW}/ answered ${w.status || w.error}${w.location ? ` -> ${w.location}` : ''}, not a 301 to the apex`);

  // 6. Measured URLs answer 200 on the FIRST hop. A redirect here spends the crawl budget twice.
  const urls = sitemapUrls();
  if (!urls.length) fail('NAMED STOP [NO_MEASURED_URLS] dist/sitemap.xml listed no URLs, so no live page was measured');
  const sample = urls.slice(0, SAMPLE);
  const results = [];
  for (let i = 0; i < sample.length; i += 6) {
    results.push(...await Promise.all(sample.slice(i, i + 6).map(async (u) => ({ u, r: await get(u, { method: 'HEAD' }) }))));
  }
  const bad = results.filter(({ r }) => r.status !== 200);
  if (bad.length) for (const { u, r } of bad.slice(0, 10)) fail(`sitemap URL ${u} answered ${r.status || r.error}${r.location ? ` -> ${r.location}` : ''} on the first hop`);
  else ok(`all ${sample.length} measured sitemap URLs answer 200 on the first hop`);

  // 7. The IndexNow key file, and that it contains its own key.
  const key = indexnowKey();
  if (!key) fail('search-loop.config.json names no IndexNow key');
  else {
    const r = await get(`${HOST}/${key}.txt`, { redirect: 'follow' });
    if (r.status === 200 && r.body.trim() === key) ok('the IndexNow key file answers with its own key');
    else fail(`/${key}.txt answered ${r.status || r.error} with ${JSON.stringify(r.body.trim().slice(0, 24))}`);
  }

  // 8. /admin stays shut to a stranger (the Pages Function middleware runs only at the edge).
  const admin = await get(`${HOST}/admin/`, { redirect: 'manual' });
  if ([401, 403, 404, 503].includes(admin.status)) ok(`/admin/ answers ${admin.status} without a session`);
  else fail(`/admin/ answered ${admin.status || admin.error} to an unauthenticated request`);

  if (checks < 10) fail(`NAMED STOP [TOO_FEW_LIVE_CHECKS] only ${checks} live checks ran; the list cannot have been built`);

  for (const n of notes) console.log(n);
  if (failures.length) {
    console.error(`\nLive check FAILED on ${HOST}: ${failures.length} problem(s)`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log(`\nLive check passed: ${checks} checks against ${HOST}`);
}

main().catch((e) => { console.error(`NAMED STOP [LIVE_CHECK_CRASHED] ${e && e.stack ? e.stack.split('\n')[0] : e}`); process.exit(1); });
