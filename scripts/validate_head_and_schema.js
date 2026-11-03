// Search Readiness a9, b1, b2, b6, c1, c2, c3, checked against what the build actually wrote.
//
// Every rule here is a behaviour the live audit measures on the built pages, so it is checked on
// dist/, not on a template. Previews and /admin/ are excluded: they are noindex and never in the
// sitemap, so they are never sampled, and two previews of one resource legitimately share a title.
//
// The reader is deliberately written the way boss-os/src/shared/boss/searchReadiness/audit.mjs
// reads a page (attribute order in a <meta> tag is not fixed, and /questions/ pages come from the
// shared search loop with name= and content= the other way round), so a page that passes here is a
// page that passes there.
const fs = require('fs');
const path = require('path');
const { root, fail } = require('./validator_utils');
const errs = [];
const dist = path.join(root, 'dist');
const config = JSON.parse(fs.readFileSync(path.join(root, 'data/system/site_config.json'), 'utf8'));
const SITE = config.siteUrl.replace(/\/$/, '');

function metaContent(html, key) {
  const out = [];
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const k = /(?:name|property)\s*=\s*["']([^"']+)["']/i.exec(m[0]);
    const v = /content\s*=\s*["']([^"']*)["']/i.exec(m[0]);
    if (k && v && k[1].toLowerCase() === key.toLowerCase()) out.push(v[1]);
  }
  return out;
}
function jsonLdNodes(html) {
  const nodes = [];
  for (const m of html.matchAll(/<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let v;
    try { v = JSON.parse(m[1]); } catch (e) { errs.push(`unparseable JSON-LD: ${String(e.message).slice(0, 80)}`); continue; }
    (function walk(x) {
      if (Array.isArray(x)) return x.forEach(walk);
      if (x && typeof x === 'object') { if (x['@graph']) walk(x['@graph']); if (x['@type']) nodes.push(x); }
    })(v);
  }
  return nodes;
}
const typesOf = (n) => [].concat(n?.['@type'] ?? []).map(String);
function deepNodes(nodes, re) {
  const out = [], seen = new Set();
  (function walk(x) {
    if (!x || typeof x !== 'object' || seen.has(x)) return;
    seen.add(x);
    if (Array.isArray(x)) return x.forEach(walk);
    if (typesOf(x).some((t) => re.test(t))) out.push(x);
    for (const v of Object.values(x)) if (v && typeof v === 'object') walk(v);
  })(nodes);
  return out;
}

// ── a9: the root files a browser and a crawler ask for by a fixed path ──────────────────────────
// Without dist/404.html, Cloudflare Pages answers 200 with the homepage for EVERY unmatched path,
// so these four files and every typo'd URL become soft 404s.
for (const f of ['404.html', 'favicon.ico', 'apple-touch-icon.png', 'site.webmanifest']) {
  const p = path.join(dist, f);
  if (!fs.existsSync(p)) { errs.push(`a9: dist/${f} is missing (without 404.html Pages serves the homepage with a 200 for every unknown path)`); continue; }
  if (!fs.statSync(p).size) errs.push(`a9: dist/${f} is empty`);
}
if (fs.existsSync(path.join(dist, 'site.webmanifest'))) {
  let mf;
  try { mf = JSON.parse(fs.readFileSync(path.join(dist, 'site.webmanifest'), 'utf8')); } catch { errs.push('a9: site.webmanifest is not valid JSON'); }
  for (const icon of mf?.icons ?? []) {
    if (!fs.existsSync(path.join(dist, icon.src.replace(/^\//, '')))) errs.push(`a9: site.webmanifest points at ${icon.src}, which the build does not write`);
  }
  if (mf && !(mf.icons ?? []).length) errs.push('a9: site.webmanifest lists no icons');
}
if (fs.existsSync(path.join(dist, '404.html'))) {
  const h = fs.readFileSync(path.join(dist, '404.html'), 'utf8');
  if (!/noindex/.test(h)) errs.push('a9: the 404 page must be noindex');
}

// ── Every page the site actually publishes ──────────────────────────────────────────────────────
const pages = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name === 'index.html') pages.push(p);
  }
})(dist);

const OG = ['og:title', 'og:description', 'og:type', 'og:url', 'og:site_name', 'og:image', 'og:image:width', 'og:image:height'];
const titles = new Map();
let checked = 0;
for (const file of pages) {
  const rel = path.relative(dist, path.dirname(file)).replace(/\\/g, '/');
  const route = rel === '' ? '/' : `/${rel}/`;
  if (route.startsWith('/previews/') || route.startsWith('/admin')) continue;
  checked++;
  const html = fs.readFileSync(file, 'utf8');

  // b1: title 30–65 characters, and no two published pages share one.
  const title = (/<title>([\s\S]*?)<\/title>/i.exec(html) ?? [, ''])[1];
  if (title.length < 30 || title.length > 65) errs.push(`b1: ${route} title is ${title.length} chars (needs 30-65): ${JSON.stringify(title)}`);
  if (!titles.has(title)) titles.set(title, []);
  titles.get(title).push(route);

  // b2: exactly one meta description, 120–160 characters.
  const desc = metaContent(html, 'description');
  if (desc.length !== 1) errs.push(`b2: ${route} has ${desc.length} meta descriptions, needs exactly 1`);
  else if (desc[0].length < 120 || desc[0].length > 160) errs.push(`b2: ${route} description is ${desc[0].length} chars (needs 120-160)`);

  // b6: complete social tags, og:image on our own host and actually built.
  const missing = OG.filter((k) => !metaContent(html, k).some(Boolean));
  if (missing.length) errs.push(`b6: ${route} lacks ${missing.join(', ')}`);
  if (!metaContent(html, 'twitter:card').includes('summary_large_image')) errs.push(`b6: ${route} has no twitter:card summary_large_image`);
  for (const img of metaContent(html, 'og:image')) {
    if (!img.startsWith(`${SITE}/`)) { errs.push(`b6: ${route} og:image ${img} is not on the site's own host`); continue; }
    const asset = path.join(dist, img.slice(SITE.length + 1));
    if (!fs.existsSync(asset)) errs.push(`b6: ${route} og:image ${img} is not a file the build writes`);
  }

  const nodes = jsonLdNodes(html);

  // c1: an Organization with name, url, logo and sameAs — and it must be the FIRST one a reader
  // meets, because that is the one the live audit reads. /questions/ pages carry the shared search
  // loop's own author/publisher Organization, which has only a name and a url.
  const org = deepNodes(nodes, /Organization|LocalBusiness|Corporation|NewsMediaOrganization|ProfessionalService/)[0];
  if (!org) errs.push(`c1: ${route} has no Organization`);
  else {
    const miss = ['name', 'url', 'logo', 'sameAs'].filter((k) => !org[k] || (Array.isArray(org[k]) && !org[k].length));
    if (miss.length) errs.push(`c1: ${route} first Organization lacks ${miss.join(', ')}`);
  }

  // c2: WebPage on every page, WebSite on the homepage, BreadcrumbList on inner pages.
  if (!deepNodes(nodes, /WebPage$|^AboutPage$|^ContactPage$|^FAQPage$|^CollectionPage$|^ItemPage$|^ProfilePage$|^SearchResultsPage$|^MedicalWebPage$|^QAPage$/).length) errs.push(`c2: ${route} has no WebPage`);
  if (route === '/' && !nodes.some((n) => typesOf(n).includes('WebSite'))) errs.push('c2: the homepage has no WebSite');
  if (route !== '/' && !deepNodes(nodes, /^BreadcrumbList$/).length) errs.push(`c2: ${route} has no BreadcrumbList`);

  // c3: a business node that fits, fully filled. No priced Offer: dental copy carries no prices
  // (validate_dental_compliance.js, risk brain R-ADV-08 / R-CLI-07), so the filled LocalBusiness is
  // the only honest shape here. Its telephone and address must match data/system/locations.json.
  const lb = deepNodes(nodes, /LocalBusiness|Dentist|ProfessionalService/).find((n) => n.telephone && n.address && n.areaServed);
  if (!lb) errs.push(`c3: ${route} has no LocalBusiness with telephone, address and areaServed`);
}

for (const [title, routes] of titles) {
  if (routes.length > 1) errs.push(`b1: ${routes.length} published pages share the title ${JSON.stringify(title)}: ${routes.slice(0, 4).join(', ')}`);
}

// Every phone and address in the published schema must come from the one verified file.
const locations = JSON.parse(fs.readFileSync(path.join(root, 'data/system/locations.json'), 'utf8'));
const knownPhones = new Set(locations.locations.map((l) => l.telephone));
const knownStreets = new Set(locations.locations.map((l) => l.streetAddress));
for (const file of pages) {
  const rel = path.relative(dist, path.dirname(file)).replace(/\\/g, '/');
  const route = rel === '' ? '/' : `/${rel}/`;
  if (route.startsWith('/previews/') || route.startsWith('/admin')) continue;
  for (const n of deepNodes(jsonLdNodes(fs.readFileSync(file, 'utf8')), /LocalBusiness|Dentist|ProfessionalService/)) {
    if (n.telephone && !knownPhones.has(n.telephone)) errs.push(`c3: ${route} publishes telephone ${n.telephone}, which is not in data/system/locations.json`);
    if (n.address?.streetAddress && !knownStreets.has(n.address.streetAddress)) errs.push(`c3: ${route} publishes street address ${n.address.streetAddress}, which is not in data/system/locations.json`);
  }
}

// Rule 0: this validator must never pass by looking at nothing.
if (checked < 10) errs.push(`NAMED STOP [NOTHING_CHECKED] only ${checked} published pages found in dist/ (run the build first); this validator must never pass on an empty site`);
if (!errs.length) console.log(`checked ${checked} published pages: titles 30-65 and unique, one 120-160 description each, complete social tags, Organization + WebPage + BreadcrumbList + a filled LocalBusiness on every page, and the four root files`);
fail(errs);
