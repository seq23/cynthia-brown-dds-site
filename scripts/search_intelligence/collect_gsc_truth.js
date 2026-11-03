'use strict';
/**
 * e4 — THE DAILY SEARCH CONSOLE TRUTH, PLUS A QUERY HISTORY THAT NEVER FORGETS.
 *
 * Search Console's window is a rolling 28 days. A query that falls out of it has not stopped
 * existing, and a job that only ever sees the window will quietly drop a target and call the site
 * healthy. So two files are written:
 *
 *   data/search_intelligence/gsc_truth.json         the window as it stands today (queries + pages)
 *   data/search_intelligence/gsc_query_history.json every query ever seen, with first/last seen
 *                                                   and its best position - append-only
 *
 * The totals line is the API's own un-dimensioned total for the same window, so a later reader can
 * check the rows against it instead of trusting a sum. Timestamps are real ISO instants: a 1970 date
 * is the shape this item was written to catch.
 */
const fs = require('fs');
const path = require('path');
const g = require('./lib/gsc');

const ROOT = path.resolve(__dirname, '../..');
const DIR = path.join(ROOT, 'data/search_intelligence');
const TRUTH = path.join(DIR, 'gsc_truth.json');
const HISTORY = path.join(DIR, 'gsc_query_history.json');
const WINDOW_DAYS = 28;
/** Search Console finalises data ~2 days late; asking for today returns an empty day, not news. */
const LAG_DAYS = 2;

const readJson = (f, fallback) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return fallback; } };
const writeJson = (f, v) => fs.writeFileSync(f, `${JSON.stringify(v, null, 2)}\n`);
const round = (n) => Math.round(Number(n || 0) * 100) / 100;

async function main() {
  const site = g.siteUrl();
  const token = await g.accessToken();

  const owned = await g.sites(token);
  const mine = owned.find((s) => s.siteUrl === site);
  if (!mine) {
    g.stop('GSC_PROPERTY_NOT_SHARED',
      `${site} is not among the ${owned.length} properties this service account can see, so there is `
      + 'no data to collect. docs/HOSTING_AND_SEARCH_CONSOLE.md records how the property was made and verified.');
  }

  const startDate = g.daysAgo(LAG_DAYS + WINDOW_DAYS);
  const endDate = g.daysAgo(LAG_DAYS);
  const range = { startDate, endDate };

  const [totalRows, queryRows, pageRows, dateRows] = await Promise.all([
    g.searchAnalytics(token, site, { ...range, dimensions: [], type: 'web' }),
    g.searchAnalytics(token, site, { ...range, dimensions: ['query'], rowLimit: 1000, type: 'web' }),
    g.searchAnalytics(token, site, { ...range, dimensions: ['page'], rowLimit: 1000, type: 'web' }),
    g.searchAnalytics(token, site, { ...range, dimensions: ['date'], rowLimit: 100, type: 'web' }),
  ]);

  const t = totalRows[0] || {};
  const shape = (rows, key) => rows.map((r) => ({
    [key]: r.keys[0], clicks: r.clicks || 0, impressions: r.impressions || 0,
    ctr: round((r.ctr || 0) * 100), position: round(r.position || 0),
  }));

  const collectedAt = new Date().toISOString();
  const truth = {
    schema: 'cbdds-gsc-truth-v1',
    site,
    collected_at: collectedAt,
    day: g.centralDate(),
    window: { start: startDate, end: endDate, days: WINDOW_DAYS, lag_days: LAG_DAYS },
    totals: {
      clicks: t.clicks || 0,
      impressions: t.impressions || 0,
      ctr: round((t.ctr || 0) * 100),
      position: round(t.position || 0),
      source: 'searchAnalytics with no dimensions, the same window as the rows below',
    },
    queries: shape(queryRows, 'query'),
    pages: shape(pageRows, 'page'),
    days: dateRows.map((r) => ({ date: r.keys[0], clicks: r.clicks || 0, impressions: r.impressions || 0 })),
  };
  writeJson(TRUTH, truth);

  // The history: append-only, so a query leaving the window keeps its record.
  const history = readJson(HISTORY, null) || {
    schema: 'cbdds-gsc-query-history-v1', site,
    why: 'Search Console forgets a query after 28 days. This file does not: every query ever seen, with when it was first and last in the window and the best position it reached.',
    queries: {},
  };
  history.updated_at = collectedAt;
  history.site = site;
  let fresh = 0;
  for (const q of truth.queries) {
    const prev = history.queries[q.query];
    if (!prev) {
      fresh++;
      history.queries[q.query] = {
        first_seen: truth.day, last_seen: truth.day, days_seen: 1,
        best_position: q.position, clicks_total: q.clicks, impressions_total: q.impressions,
      };
      continue;
    }
    if (prev.last_seen !== truth.day) { prev.days_seen = (prev.days_seen || 0) + 1; prev.last_seen = truth.day; }
    if (q.position && (!prev.best_position || q.position < prev.best_position)) prev.best_position = q.position;
    prev.clicks_total = Math.max(prev.clicks_total || 0, q.clicks);
    prev.impressions_total = Math.max(prev.impressions_total || 0, q.impressions);
  }
  const known = Object.keys(history.queries).length;
  history.counts = { known, in_window_today: truth.queries.length, new_today: fresh };
  writeJson(HISTORY, history);

  console.log(
    `gsc_truth: ${truth.queries.length} queries, ${truth.pages.length} pages, `
    + `${truth.totals.clicks} clicks / ${truth.totals.impressions} impressions over ${startDate}..${endDate}; `
    + `history knows ${known} queries (${fresh} new today)`);
}

main().catch((e) => g.stop('GSC_TRUTH_FAILED', e && e.stack ? e.stack.split('\n')[0] : String(e)));
