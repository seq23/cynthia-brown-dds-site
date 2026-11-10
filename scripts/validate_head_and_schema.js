// Search Readiness c3 claims rules, checked against what the build actually wrote (trimmed
// 10 Nov 2026 to its risk rules; the title/description/og/schema-shape rules are the central
// Boss OS search audit's job):
//   - no priced Offer anywhere: dental copy carries no prices (risk brain R-ADV-08 / R-CLI-07);
//   - every telephone and street address in the published schema comes from the one verified
//     file, data/system/locations.json.
const fs = require('fs');
const path = require('path');
const { root, fail } = require('./validator_utils');
const errs = [];
const dist = path.join(root, 'dist');
const config = JSON.parse(fs.readFileSync(path.join(root, 'data/system/site_config.json'), 'utf8'));
const SITE = config.siteUrl.replace(/\/$/, '');

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

const pages = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name === 'index.html') pages.push(p);
  }
})(dist);

let checked = 0;
for (const file of pages) {
  const rel = path.relative(dist, path.dirname(file)).replace(/\\/g, '/');
  const route = rel === '' ? '/' : `/${rel}/`;
  if (route.startsWith('/previews/') || route.startsWith('/admin')) continue;
  checked++;
  const nodes = jsonLdNodes(fs.readFileSync(file, 'utf8'));
  for (const o of deepNodes(nodes, /^(Offer|AggregateOffer)$/)) {
    const priced = ['price', 'lowPrice', 'highPrice', 'priceSpecification'].filter((k) => o[k] !== undefined);
    if (priced.length) errs.push(`c3: ${route} publishes an Offer with ${priced.join(', ')}; the practice publishes no prices`);
  }
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
if (!errs.length) console.log(`checked ${checked} published pages: no priced Offer, every schema phone and address from locations.json`);
fail(errs);
