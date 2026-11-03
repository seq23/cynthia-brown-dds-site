'use strict';
/**
 * i9 — THE WEEKLY OUTCOME REPORT, AND ONE SELF-CLOSING ISSUE WHEN THE SITE GOES RED.
 *
 * Without a report nobody notices a drop for a month. Without an issue that closes itself, the list
 * of problems rots into a list nobody reads.
 *
 * Reads only what this repository already records - the daily Search Console files written by
 * .github/workflows/search-intelligence.yml - and writes weekly-outcome-report.json for the
 * workflow to upload as an artifact. Boss OS words it into her weekly email; nothing is emailed or
 * deployed from here.
 *
 * EVERY NUMBER THAT CANNOT BE READ IS SAID AS "not read: <reason>", NEVER AS 0. A zero means Google
 * showed the site to nobody; "not read" means we did not look. Confusing the two is how a dead
 * measurement reads as a healthy week.
 *
 * RED, and what the issue says, is decided here:
 *   - impressions fell by more than half week on week      (Google stopped showing the site)
 *   - the sitemap carries errors, or was last downloaded over 14 days ago
 *   - more pages are crawled-not-indexed than indexed      (a quality problem, not a discovery one)
 * The issue closes itself on the first week none of those is true.
 *
 * `--self-check` proves the verdict with made-up weeks and touches nothing: Rule 0's shape, so a
 * broken report cannot pass as a quiet week.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'data/search_intelligence');
const OUT = path.join(ROOT, 'weekly-outcome-report.json');
const SELF = process.argv.includes('--self-check');

const notRead = (why) => `not read: ${why}`;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return { __why: `${path.basename(file)} ${e.code === 'ENOENT' ? 'has not been written yet' : `does not parse: ${e.message}`}` }; }
}

/** The same file as it stood `days` days ago, out of git history, for the week-on-week line. */
function gitShowDaysAgo(rel, days) {
  try {
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const sha = execFileSync('git', ['-C', ROOT, 'rev-list', '-1', `--before=${since}`, 'HEAD', '--', rel], { encoding: 'utf8' }).trim();
    if (!sha) return { __why: `no commit of ${rel} older than ${days} days` };
    return JSON.parse(execFileSync('git', ['-C', ROOT, 'show', `${sha}:${rel}`], { encoding: 'utf8' }));
  } catch (e) { return { __why: `${rel} could not be read from git history: ${String(e.message).split('\n')[0]}` }; }
}

/** The verdict. Pure, so --self-check can prove it. */
function judge({ impressions, impressionsPrev, sitemapErrors, sitemapAgeDays, indexed, crawledNotIndexed }) {
  const reasons = [];
  if (isNum(impressions) && isNum(impressionsPrev) && impressionsPrev >= 10 && impressions * 2 < impressionsPrev) {
    reasons.push(`impressions fell from ${impressionsPrev} to ${impressions}, more than half, week on week`);
  }
  if (isNum(sitemapErrors) && sitemapErrors > 0) reasons.push(`the sitemap carries ${sitemapErrors} error(s) in Search Console`);
  if (isNum(sitemapAgeDays) && sitemapAgeDays > 14) reasons.push(`Search Console last downloaded the sitemap ${sitemapAgeDays} days ago`);
  if (isNum(indexed) && isNum(crawledNotIndexed) && crawledNotIndexed > indexed) {
    reasons.push(`${crawledNotIndexed} pages are crawled and not indexed against ${indexed} indexed: a quality problem, not a discovery one`);
  }
  return { red: reasons.length > 0, reasons };
}

function selfCheck() {
  const cases = [
    ['a halved week is red', judge({ impressions: 4, impressionsPrev: 100 }).red === true],
    ['a small week is not red on noise', judge({ impressions: 2, impressionsPrev: 8 }).red === false],
    ['a steady week is green', judge({ impressions: 100, impressionsPrev: 110 }).red === false],
    ['sitemap errors are red', judge({ sitemapErrors: 3 }).red === true],
    ['a stale sitemap is red', judge({ sitemapAgeDays: 30 }).red === true],
    ['more declined than indexed is red', judge({ indexed: 2, crawledNotIndexed: 9 }).red === true],
    ['numbers that were not read are never red', judge({ impressions: notRead('x'), impressionsPrev: notRead('x'), sitemapErrors: notRead('x'), indexed: notRead('x') }).red === false],
  ];
  const bad = cases.filter(([, pass]) => !pass);
  for (const [name, pass] of cases) console.log(`${pass ? 'ok  ' : 'FAIL'} ${name}`);
  if (bad.length) { console.error(`NAMED STOP [SELF_CHECK_FAILED] ${bad.length} of ${cases.length} cases`); process.exit(1); }
  console.log(`\nself-check passed: ${cases.length} cases`);
}

function main() {
  if (SELF) return selfCheck();

  const truth = readJson(path.join(DIR, 'gsc_truth.json'));
  const cover = readJson(path.join(DIR, 'index_coverage.json'));
  const smaps = readJson(path.join(DIR, 'gsc_sitemaps.json'));
  const truthPrev = gitShowDaysAgo('data/search_intelligence/gsc_truth.json', 7);

  if (truth.__why && cover.__why && smaps.__why) {
    console.error(`NAMED STOP [NOTHING_TO_REPORT] none of the three daily files could be read (${truth.__why}; ${cover.__why}; ${smaps.__why}). `
      + 'The report is not written, so no empty week is published.');
    process.exit(1);
  }

  const impressions = isNum(truth.totals?.impressions) ? truth.totals.impressions : notRead(truth.__why || 'gsc_truth.json carries no totals');
  const clicks = isNum(truth.totals?.clicks) ? truth.totals.clicks : notRead(truth.__why || 'gsc_truth.json carries no totals');
  const impressionsPrev = isNum(truthPrev.totals?.impressions) ? truthPrev.totals.impressions : notRead(truthPrev.__why || 'last week\'s gsc_truth.json carries no totals');
  const counts = cover.counts || {};
  const indexed = isNum(counts.indexed) ? counts.indexed : notRead(cover.__why || 'index_coverage.json carries no counts');
  const crawledNotIndexed = isNum(counts.crawled_not_indexed) ? counts.crawled_not_indexed : notRead(cover.__why || 'index_coverage.json carries no counts');
  const discovered = isNum(counts.discovered) ? counts.discovered : notRead(cover.__why || 'index_coverage.json carries no counts');
  const sm = (smaps.sitemaps || [])[0] || {};
  const sitemapErrors = isNum(sm.errors) ? sm.errors : notRead(smaps.__why || 'gsc_sitemaps.json carries no sitemap');
  const sitemapAgeDays = sm.last_downloaded ? Math.floor((Date.now() - Date.parse(sm.last_downloaded)) / 86400000) : notRead(smaps.__why || 'the sitemap has no last_downloaded');

  const verdict = judge({ impressions, impressionsPrev, sitemapErrors, sitemapAgeDays, indexed, crawledNotIndexed });

  const report = {
    schema: 'cbdds-weekly-outcome-v1',
    site: 'cynthiabrowndds.com',
    generated_at: new Date().toISOString(),
    window: truth.window || notRead(truth.__why || 'no window'),
    search: { clicks, impressions, impressions_last_week: impressionsPrev, queries_in_window: Array.isArray(truth.queries) ? truth.queries.length : notRead('no queries array') },
    coverage: { sitemap_total: isNum(cover.sitemap_total) ? cover.sitemap_total : notRead('no sitemap_total'), indexed, crawled_not_indexed: crawledNotIndexed, discovered },
    sitemap: { errors: sitemapErrors, last_downloaded_days_ago: sitemapAgeDays },
    verdict: verdict.red ? 'red' : 'green',
    reasons: verdict.reasons,
    run_url: process.env.RUN_URL || null,
  };
  fs.writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`weekly outcome: ${report.verdict.toUpperCase()}`);
  for (const r of verdict.reasons) console.log(`  red: ${r}`);
  console.log(`  clicks ${clicks} · impressions ${impressions} (last week ${impressionsPrev}) · indexed ${indexed} · crawled-not-indexed ${crawledNotIndexed} · sitemap errors ${sitemapErrors}`);
}

main();
module.exports = { judge };
