'use strict';
/**
 * k1, k2, k3 — THE PUBLISHED IDENTITY IS entity.json, ON EVERY PAGE.
 *
 * Search Readiness 3 Nov 2026. The identity used to be typed into scripts/post_build_aeo_geo.js, so
 * the repository held no statement of who this site is at all (k1 read "no entity.json in the repo
 * holds cynthiabrowndds.com"), and the one external profile that did reach the page got there as a
 * side effect of the booking link rather than as a decision anyone had written down.
 *
 * This proves BEHAVIOUR, not wording:
 *   - entity.json parses, and names this site's own host in its url (it is about THIS site);
 *   - it carries a name and a non-empty sameAs list (k1);
 *   - no sameAs URL is on this site's own host — a self-reference proves nothing (k2);
 *   - at least one sameAs URL is on a third-party host (k3);
 *   - every sameAs URL carries an evidence record saying what it is and when it was read, so a
 *     profile can never be added on a hunch;
 *   - EVERY built page's first JSON-LD node is the practice, and its name, logo and sameAs are
 *     exactly entity.json's — the published form may not drift from the source;
 *   - the Dentist/LocalBusiness @id is the one entity.json gives, so the WebPage isPartOf on every
 *     page resolves to a node that exists.
 *
 * Rule 0: zero built pages examined, or zero sameAs URLs read, FAILS. It cannot pass having looked
 * at nothing.
 */
const fs = require('fs');
const path = require('path');
const { root, fail } = require('./validator_utils');

const errs = [];
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return null; } };

let entity;
try { entity = JSON.parse(fs.readFileSync(path.join(root, 'entity.json'), 'utf8')); }
catch (e) { fail([`NAMED STOP [ENTITY_FILE_UNREADABLE] entity.json is missing or not JSON: ${e.message}`]); }

const site = JSON.parse(fs.readFileSync(path.join(root, 'data/system/site_config.json'), 'utf8'));
const SITE = site.siteUrl.replace(/\/$/, '');
const ownHosts = new Set([...(entity.own_hosts || []), hostOf(SITE)].filter(Boolean));

// ── The source file itself ──────────────────────────────────────────────────────────────────────
if (!entity.name) errs.push('k1: entity.json has no name');
if (!hostOf(entity.url) || !ownHosts.has(hostOf(entity.url))) errs.push(`k1: entity.json url ${entity.url} is not on this site's own host`);
const logo = typeof entity.logo === 'string' ? entity.logo : entity.logo && entity.logo.url;
if (!logo) errs.push('k1: entity.json has no logo url');
else if (!fs.existsSync(path.join(root, 'dist', logo.replace(`${SITE}/`, '')))) errs.push(`k1: entity.json logo ${logo} is not a file the build writes`);

const sameAs = Array.isArray(entity.sameAs) ? entity.sameAs : null;
if (!sameAs) errs.push('k1: entity.json has no sameAs list');
else if (!sameAs.length) errs.push('k1: entity.json sameAs is empty; the identity has nothing outside the site to be reconciled against');
else {
  const self = sameAs.filter((u) => ownHosts.has(hostOf(u)));
  if (self.length) errs.push(`k2: entity.json sameAs points at this site's own host: ${self.join(', ')}`);
  const external = sameAs.filter((u) => hostOf(u) && !ownHosts.has(hostOf(u)));
  if (!external.length) errs.push('k3: entity.json sameAs holds no third-party profile');
  for (const u of sameAs) {
    if (!hostOf(u)) { errs.push(`k1: entity.json sameAs entry ${JSON.stringify(u)} is not a URL`); continue; }
    const ev = (entity.sameAs_evidence || {})[u];
    if (!ev) errs.push(`k3: entity.json sameAs ${u} carries no sameAs_evidence record (what it is and when it was read)`);
    else if (!ev.what || !ev.probed) errs.push(`k3: entity.json sameAs_evidence for ${u} must say both "what" it is and when it was "probed"`);
  }
}
for (const item of entity.profiles_pending || []) {
  const u = typeof item === 'string' ? item : item && item.url;
  if (!hostOf(u)) errs.push(`k3: entity.json profiles_pending holds ${JSON.stringify(item)}, which is not a URL`);
  else if (ownHosts.has(hostOf(u))) errs.push(`k2: entity.json profiles_pending holds this site's own host: ${u}`);
}

// ── The published form, on every page ───────────────────────────────────────────────────────────
const dist = path.join(root, 'dist');
const pages = [];
(function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (ent.name === 'index.html') pages.push(p);
  }
})(dist);

if (!pages.length) errs.push('NAMED STOP [NOTHING_CHECKED] no built pages in dist/ (run the build first)');

const firstNode = (html) => {
  const m = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  let parsed;
  try { parsed = JSON.parse(m[1]); } catch { return null; }
  const graph = parsed && parsed['@graph'];
  return Array.isArray(graph) ? graph[0] : (Array.isArray(parsed) ? parsed[0] : parsed);
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

let checked = 0;
for (const file of pages) {
  const route = `/${path.relative(dist, path.dirname(file)).replace(/\\/g, '/')}`.replace(/\/$/, '') || '/';
  const html = fs.readFileSync(file, 'utf8');
  const node = firstNode(html);
  if (!node) { errs.push(`k1: ${route} has no parseable JSON-LD as its first ld+json block`); continue; }
  checked += 1;
  if (node.name !== entity.name) errs.push(`k1: ${route} first node name ${JSON.stringify(node.name)} is not entity.json's ${JSON.stringify(entity.name)}`);
  if (node['@id'] !== entity['@id']) errs.push(`k1: ${route} first node @id ${node['@id']} is not entity.json's ${entity['@id']}`);
  if (node.logo !== logo) errs.push(`k1: ${route} first node logo ${node.logo} is not entity.json's ${logo}`);
  if (!same(node.sameAs, sameAs)) errs.push(`k3: ${route} published sameAs ${JSON.stringify(node.sameAs)} is not entity.json's ${JSON.stringify(sameAs)}`);
}
if (pages.length && !checked) errs.push('NAMED STOP [NOTHING_CHECKED] no built page carried a readable identity node');

fail(errs);
