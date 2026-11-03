'use strict';
/**
 * ONE VALIDATOR FOR THE MEASUREMENT LANE (Search Readiness e4, e5, i3, i6, i9, h4).
 *
 * It guards the BEHAVIOUR those items exist for, not the wording of anything:
 *
 *   1. The three daily Search Console files exist, parse, and carry a real instant - a 1970 or
 *      absent timestamp is the exact shape e4 was written to catch.
 *   2. index_coverage.json counts every sitemap URL once and its buckets sum to that total, so a
 *      page cannot fall out of the measurement unnoticed; a URL that was refused is recorded with a
 *      reason and never counted as "not indexed".
 *   3. Every model id in config/llm_routing.json ends in :free and max_cost_usd is 0, and the router
 *      refuses a paid id when one is put in front of it (proved by calling it, not by reading it).
 *   4. The scheduled workflows that write and report on all this exist, are parseable, carry the
 *      cron they claim, and never deploy.
 *   5. The weekly report's verdict passes its own self-check.
 *   6. The zero-paid rule is written where an agent entering the repo finds it (CLAUDE.md and
 *      docs/cost/zero-paid-llm.md), its file pointers all resolve, and the ceiling it states is the
 *      ceiling config/llm_routing.json actually allows (i10).
 *
 * It hard-fails on zero items: a run that found no sitemap URLs, no models or no workflows has not
 * proved anything and must not pass.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SI = path.join(ROOT, 'data/search_intelligence');
const problems = [];
let proved = 0;

const bad = (why) => problems.push(why);
const good = (what) => { proved++; console.log(`ok  ${what}`); };
const rel = (p) => path.relative(ROOT, p);

function json(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { bad(`${rel(file)} ${e.code === 'ENOENT' ? 'does not exist' : `does not parse: ${e.message}`}`); return null; }
}

function realInstant(v) {
  const t = Date.parse(v || '');
  return Number.isFinite(t) && t > Date.parse('2020-01-01') && t < Date.now() + 86400000;
}

// ─── 1. The three daily files ────────────────────────────────────────────────
const truth = json(path.join(SI, 'gsc_truth.json'));
const cover = json(path.join(SI, 'index_coverage.json'));
const smaps = json(path.join(SI, 'gsc_sitemaps.json'));
const history = json(path.join(SI, 'gsc_query_history.json'));

for (const [name, doc] of [['gsc_truth.json', truth], ['index_coverage.json', cover], ['gsc_sitemaps.json', smaps]]) {
  if (!doc) continue;
  if (!realInstant(doc.collected_at)) bad(`${name}: collected_at ${JSON.stringify(doc.collected_at)} is not a real instant`);
  else good(`${name} carries a real collected_at (${doc.collected_at.slice(0, 19)}Z)`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(doc.day))) bad(`${name}: day ${JSON.stringify(doc.day)} is not a date`);
}

if (truth) {
  if (!Array.isArray(truth.queries) || !Array.isArray(truth.pages)) bad('gsc_truth.json has no queries or pages array');
  else good(`gsc_truth.json carries ${truth.queries.length} queries and ${truth.pages.length} pages`);
  if (!truth.totals || typeof truth.totals.impressions !== 'number') bad('gsc_truth.json carries no numeric impressions total');
  const sum = (truth.queries || []).reduce((a, q) => a + (q.impressions || 0), 0);
  if (truth.totals && sum > truth.totals.impressions * 1.05 + 5) {
    bad(`gsc_truth.json: the query rows sum to ${sum} impressions but the window total is ${truth.totals.impressions}`);
  }
  if (!truth.window?.start || !truth.window?.end) bad('gsc_truth.json names no window');
}

if (history) {
  const known = Object.keys(history.queries || {}).length;
  const inWindow = (truth?.queries || []).length;
  if (known < inWindow) bad(`gsc_query_history.json knows ${known} queries but today's window has ${inWindow}: the history lost a query it had seen`);
  else good(`gsc_query_history.json keeps ${known} queries, never fewer than today's ${inWindow}`);
}

// ─── 2. Coverage counts every sitemap URL once ───────────────────────────────
if (cover) {
  const urls = Object.keys(cover.urls || {});
  if (!urls.length) bad('index_coverage.json records no URLs at all');
  else {
    if (urls.length !== cover.sitemap_total) bad(`index_coverage.json says sitemap_total ${cover.sitemap_total} but records ${urls.length} URLs`);
    const counts = cover.counts || {};
    const total = Object.values(counts).reduce((a, n) => a + Number(n || 0), 0);
    if (total !== urls.length) bad(`index_coverage.json buckets sum to ${total}, not the ${urls.length} URLs recorded`);
    else good(`index_coverage.json buckets sum to all ${urls.length} sitemap URLs`);
    const refusedAsNotIndexed = urls.filter((u) => cover.urls[u].not_read && cover.urls[u].state === 'crawled_not_indexed' && !cover.urls[u].stale);
    if (refusedAsNotIndexed.length) bad(`${refusedAsNotIndexed.length} refused URL(s) are counted as crawled-not-indexed, which reads as a quality problem that was never measured`);
    else good('no refused URL is counted as a quality problem');
    if (!cover.rotation || cover.rotation.per_day !== 150 || cover.rotation.parallel !== 8) {
      bad(`index_coverage.json rotation is ${JSON.stringify(cover.rotation)}, not 150 a day / 8 in parallel`);
    }
  }
}

// ─── 3. The LLM door refuses a paid id ──────────────────────────────────────
const routingPath = path.join(ROOT, 'config/llm_routing.json');
const routing = json(routingPath);
if (routing) {
  if (Number(routing.policy?.max_cost_usd) !== 0) bad(`config/llm_routing.json max_cost_usd is ${routing.policy?.max_cost_usd}, not 0`);
  const ids = Array.isArray(routing.models) ? routing.models : [];
  if (!ids.length) bad('config/llm_routing.json lists no models');
  const paid = ids.filter((m) => !/:free$/.test(String(m)));
  if (paid.length) bad(`config/llm_routing.json names non-free models: ${paid.join(', ')}`);
  else if (ids.length) good(`config/llm_routing.json: ${ids.length} model ids, all :free, max_cost_usd 0`);
  if (!routing.pricing_snapshot?.fetched_at) bad('config/llm_routing.json carries no pricing snapshot date');
  if (routing.router !== 'scripts/llm/router.js' || !fs.existsSync(path.join(ROOT, 'scripts/llm/router.js'))) {
    bad('config/llm_routing.json does not point at scripts/llm/router.js, or that file is missing');
  }

  // Prove the refusal by making it happen, with a paid id in a temporary copy.
  const backup = fs.readFileSync(routingPath, 'utf8');
  try {
    fs.writeFileSync(routingPath, JSON.stringify({ ...routing, models: ['anthropic/claude-opus-4'] }, null, 2));
    delete require.cache[require.resolve('./llm/router.js')];
    let refused = false;
    try { require('./llm/router.js').loadConfig(); } catch (e) { refused = /PAID_MODEL_IN_CONFIG/.test(e.message); }
    if (refused) good('the router refuses a paid model id put into its config');
    else bad('the router accepted a paid model id: the one door does not shut');
  } finally {
    fs.writeFileSync(routingPath, backup);
    delete require.cache[require.resolve('./llm/router.js')];
  }

  // --- i10: the rule is written where the next agent finds it, and it does not lie ---------------
  // Search Readiness i10 (3 Nov 2026): "a rule no code reads is a wish". The ceiling was enforced in
  // the router but written down nowhere, so the next agent in this repo had no way to find it before
  // adding a paid call. This proves the three things that can actually rot, and NOT any wording:
  //   - the cost doc and CLAUDE.md exist and carry the rule;
  //   - every repository file the doc points at still exists (a doc pointing at a deleted file is a
  //     wish again);
  //   - every dollar ceiling the doc states equals config/llm_routing.json's max_cost_usd. A doc
  //     that claims $0 while the config allows spending is worse than no doc.
  const costDoc = path.join(ROOT, 'docs/cost/zero-paid-llm.md');
  let doc = null;
  try { doc = fs.readFileSync(costDoc, 'utf8'); } catch { bad('docs/cost/zero-paid-llm.md does not exist: the $0 ceiling is enforced in the router but written down nowhere'); }
  let claude = null;
  try { claude = fs.readFileSync(path.join(ROOT, 'CLAUDE.md'), 'utf8'); } catch { bad('CLAUDE.md does not exist: an agent entering this repo is told nothing about the cost ceiling'); }
  if (claude !== null && !/nothing paid/i.test(claude)) bad('CLAUDE.md does not carry the "nothing paid" rule, so the ceiling is three files deep from where an agent starts');
  else if (claude !== null) good('CLAUDE.md carries the "nothing paid" rule where an agent starts reading');
  if (doc !== null) {
    const ceiling = Number(routing.policy && routing.policy.max_cost_usd);
    const stated = [...doc.matchAll(/\$([0-9]+(?:\.[0-9]+)?)/g)].map((m) => Number(m[1]));
    if (!stated.length) bad('docs/cost/zero-paid-llm.md states no dollar ceiling, so nothing in it can be compared with config/llm_routing.json');
    const wrong = stated.filter((n) => n !== ceiling);
    if (wrong.length) bad(`docs/cost/zero-paid-llm.md states a ceiling of $${wrong.join(', $')} while config/llm_routing.json allows $${ceiling}`);
    const linked = [...doc.matchAll(/\]\((\.{1,2}\/[^)#]+)\)/g)].map((m) => m[1]);
    const missing = linked.filter((l) => !fs.existsSync(path.resolve(path.dirname(costDoc), l)));
    if (missing.length) bad(`docs/cost/zero-paid-llm.md points at files that do not exist: ${missing.join(', ')}`);
    if (!linked.length) bad('docs/cost/zero-paid-llm.md points at no file, so it describes a rule rather than locating it');
    if (!wrong.length && !missing.length && stated.length && linked.length) {
      good(`docs/cost/zero-paid-llm.md states $${ceiling}, matches config/llm_routing.json, and its ${linked.length} file pointers all resolve`);
    }
  }

  // No script in this repository may name a provider model outside the router and its config.
  const offenders = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!/\.(js|mjs|cjs)$/.test(e.name)) continue;
      if (p === path.join(ROOT, 'scripts/llm/router.js') || p === __filename) continue;
      const src = fs.readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      if (/["'`](?:anthropic|openai|google|meta-llama|mistralai|cohere)\/[a-z0-9][^"'`]*["'`]/i.test(src) || /["'`]claude-[a-z0-9-]+["'`]/i.test(src)) offenders.push(rel(p));
    }
  };
  walk(path.join(ROOT, 'scripts'));
  if (offenders.length) bad(`these scripts name a provider model outside the router: ${offenders.join(', ')}`);
  else good('no script names a provider model outside scripts/llm/router.js');
}

// ─── 4. The scheduled workflows ─────────────────────────────────────────────
const WF = path.join(ROOT, '.github/workflows');
const wanted = [
  { file: 'search-intelligence.yml', cron: /cron:\s*'[0-9*\/ ]*\*\s*\*\s*\*'/, writes: /collect_gsc_truth\.js/, why: 'the daily Search Console files (e4, e5, i6)' },
  { file: 'weekly-outcome-report.yml', cron: /cron:\s*'[^']*\*\s*[0-6]'/, writes: /weekly_outcome_report\.js/, why: 'the weekly outcome report (i9)' },
  { file: 'post-deploy-live-check.yml', cron: null, writes: /live_check\.js/, why: 'the post-deploy live check (h4)' },
];
for (const w of wanted) {
  const p = path.join(WF, w.file);
  if (!fs.existsSync(p)) { bad(`.github/workflows/${w.file} is missing: nothing runs ${w.why}`); continue; }
  const text = fs.readFileSync(p, 'utf8');
  if (w.cron && !w.cron.test(text)) bad(`${w.file} does not carry the cron it needs for ${w.why}`);
  if (!w.writes.test(text)) bad(`${w.file} does not run the script that produces ${w.why}`);
  if (/wrangler[^\n]*\bdeploy\b|cloudflare\/(wrangler|pages)-action/.test(text)) bad(`${w.file} contains a deploy step; deploys belong to the Cloudflare Pages git integration alone`);
  else good(`${w.file} runs ${w.why} and never deploys`);
}

// ─── 5. The weekly verdict proves itself ────────────────────────────────────
try {
  execFileSync(process.execPath, [path.join(ROOT, 'scripts/weekly_outcome_report.js'), '--self-check'], { stdio: 'pipe' });
  good('the weekly report verdict passes its own self-check');
} catch (e) {
  bad(`scripts/weekly_outcome_report.js --self-check failed: ${String(e.stdout || e.message).split('\n').slice(-3).join(' ')}`);
}

// ─── 6. The CSP lets Cloudflare Web Analytics run ───────────────────────────
// Cloudflare injects the visit beacon at the edge; with a CSP that does not allow its two hosts
// the script is injected and then blocked, so no visit (AI-tool visits included) is recorded.
{
  const csp = (/^\s*Content-Security-Policy:\s*(.+)$/im.exec(fs.readFileSync(path.join(ROOT, '_headers'), 'utf8')) || [])[1] || '';
  const directive = (name) => ((new RegExp(`(?:^|;)\\s*${name}\\s+([^;]*)`).exec(csp) || [])[1] || '').split(/\s+/);
  if (!csp) bad('_headers carries no Content-Security-Policy to check');
  else if (!directive('script-src').includes('https://static.cloudflareinsights.com') || !directive('connect-src').includes('https://cloudflareinsights.com')) {
    bad('_headers CSP blocks the Cloudflare Web Analytics beacon (needs script-src https://static.cloudflareinsights.com and connect-src https://cloudflareinsights.com)');
  } else good('_headers CSP allows the Cloudflare Web Analytics beacon');
}

// ─── Verdict ────────────────────────────────────────────────────────────────
if (proved < 14) bad(`NAMED STOP [TOO_FEW_PROOFS] only ${proved} things were proved; this validator cannot have run over the real tree`);
if (problems.length) {
  console.error(`\nFAIL: ${problems.length} problem(s) in the measurement lane`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(`\n[validate:search-measurement] OK: ${proved} proofs`);
