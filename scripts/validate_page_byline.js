'use strict';
/**
 * c6 — EVERY INDEXABLE PAGE NAMES THE PERSON WHO REVIEWED IT, AND THE NODE AGREES WITH THE LINE.
 *
 * Search Readiness brief so-cynthiabrowndds.com-quality (3 Nov 2026). The Monday quality sample read
 * https://cynthiabrowndds.com/smile-philosophy/ and found "no named author or reviewer is visible";
 * a crawl of all forty sitemap URLs showed the same gap on every page the templates build — the ten
 * hand-built pages carried no author at all, and the resource and question pages passed only because
 * the brand name in the navigation happened to match their schema author. On a health site that is
 * the one E-E-A-T signal an answer engine weighs most.
 *
 * This proves BEHAVIOUR, not wording:
 *   - entity.json carries an author with a name and a URL on this site (the one statement of it);
 *   - every built page that search engines may index carries a visible byline naming exactly that
 *     person, with a rel="author" link to a page that exists in dist/;
 *   - the published JSON-LD names the same person as author, so the node and the line agree;
 *   - noindex pages (previews, /admin/), the 404 and the utility pages (privacy, disclaimer) are
 *     exempt: nothing indexable, and a legal notice is not an editorial page with a reviewer.
 *
 * Rule 0: zero indexable pages examined FAILS. It cannot pass having looked at nothing.
 */
const fs = require('fs');
const path = require('path');
const { root, fail } = require('./validator_utils');

const errs = [];
const dist = path.join(root, 'dist');

let entity;
try { entity = JSON.parse(fs.readFileSync(path.join(root, 'entity.json'), 'utf8')); }
catch (e) { fail([`NAMED STOP [ENTITY_FILE_UNREADABLE] entity.json is missing or not JSON: ${e.message}`]); }

const author = entity.author;
if (!author || !author.name) errs.push('c6: entity.json has no author.name, so no page can name a reviewer');
if (author && !author.url) errs.push('c6: entity.json author has no url, so the byline would name a reviewer with no page behind them');
if (errs.length) fail(errs);

const site = JSON.parse(fs.readFileSync(path.join(root, 'data/system/site_config.json'), 'utf8'));
const SITE = site.siteUrl.replace(/\/$/, '');
const authorPath = author.url.replace(SITE, '') || '/about/';
if (!fs.existsSync(path.join(dist, authorPath.replace(/^\/|\/$/g, ''), 'index.html'))) {
  errs.push(`c6: entity.json author url ${author.url} is not a page this build writes (${authorPath})`);
}

// Not editorial pages with a reviewer, and never indexed: no byline is required on these.
const EXEMPT = [/^\/privacy\/$/, /^\/disclaimer\/$/, /^\/admin\/$/, /^\/404/, /^\/previews\//];

const pages = [];
(function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (ent.name === 'index.html' || ent.name === '404.html') pages.push(p);
  }
})(dist);
if (!pages.length) errs.push('NAMED STOP [NOTHING_CHECKED] no built pages in dist/ (run the build first)');

const visibleText = (html) => html
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&#039;/g, "'").replace(/&quot;/g, '"')
  .replace(/\s+/g, ' ');

// Every author name anywhere in the page's JSON-LD, however deep.
function schemaAuthorNames(html) {
  const names = [];
  const seen = new Set();
  for (const m of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
    let parsed;
    try { parsed = JSON.parse(m[1]); } catch { continue; }
    (function walk(node) {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) { node.forEach(walk); return; }
      if (seen.has(node)) return;
      seen.add(node);
      // An author given by reference resolves against the node that carries that @id.
      if (node.author) {
        for (const a of [].concat(node.author)) {
          if (typeof a === 'string') names.push(a);
          else if (a && a.name) names.push(a.name);
          else if (a && a['@id']) names.push(`@id:${a['@id']}`);
        }
      }
      if (node['@type'] === 'Person' && node.name) names.push(`person:${node.name}|${node['@id'] || ''}`);
      for (const v of Object.values(node)) walk(v);
    })(parsed);
  }
  return names;
}

let checked = 0;
for (const file of pages) {
  const rel = path.relative(dist, file).replace(/\\/g, '/');
  const route = rel === 'index.html' ? '/' : `/${rel.replace(/index\.html$/, '')}`;
  const html = fs.readFileSync(file, 'utf8');
  if (/<meta[^>]+name="robots"[^>]+noindex/i.test(html)) continue;
  if (EXEMPT.some((re) => re.test(route))) continue;
  checked += 1;

  const vis = visibleText(html);
  if (!vis.includes(author.name)) errs.push(`c6: ${route} does not name ${author.name} in its visible text`);
  const bylineMatch = html.match(/<p class="page-byline">([\s\S]*?)<\/p>/i);
  if (!bylineMatch) errs.push(`c6: ${route} carries no visible reviewer byline (p.page-byline)`);
  else {
    const line = bylineMatch[1];
    if (!/rel=["']author["']/i.test(line)) errs.push(`c6: ${route} byline has no rel="author" link`);
    if (!line.includes(`href="${authorPath}"`)) errs.push(`c6: ${route} byline does not link the reviewer to ${authorPath}`);
    if (!visibleText(line).includes(author.name)) errs.push(`c6: ${route} byline does not read ${author.name}`);
  }

  const names = schemaAuthorNames(html);
  const direct = names.includes(author.name);
  const byRef = author['@id'] && names.includes(`@id:${author['@id']}`)
    && names.some((n) => n.startsWith(`person:${author.name}|${author['@id']}`));
  if (!direct && !byRef) {
    errs.push(`c6: ${route} publishes no JSON-LD author resolving to ${author.name} (found ${names.length ? names.join(', ') : 'no author at all'})`);
  }
}
if (pages.length && !checked) errs.push('NAMED STOP [NOTHING_CHECKED] no indexable built page was examined for a reviewer byline');
else if (checked && checked < 5) errs.push(`NAMED STOP [TOO_FEW_CHECKED] only ${checked} indexable pages examined; this site serves the home page, seven content pages and the question and resource pages`);

fail(errs);
