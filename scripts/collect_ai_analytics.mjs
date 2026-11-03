// Measurement only: never run FIND/BUILD/CHECK or touch a published page.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function recordDay(daily, day, result) {
  for (const key of ['ai_visitors', 'ai_bot_hits']) {
    if (!Number.isFinite(result[key]?.total) || result[key].total < 0) {
      throw new Error(`AI_MEASUREMENT_NOT_READ: ${result.notRead || result[key === 'ai_visitors' ? 'visitorsNotRead' : 'botsNotRead'] || key}`);
    }
  }
  // Partial reads never overwrite a real day; zero is valid only after both sources answered.
  return { ...daily, days: { ...daily.days, [day]: {
    ai_visitors: result.ai_visitors, ai_bot_hits: result.ai_bot_hits, window: result.window,
  } } };
}

async function main() {
  const engine = path.resolve(process.env.SEARCH_LOOP_ENGINE_DIR || path.join(root, '.search-loop-engine'));
  const mod = async (name) => import(pathToFileURL(path.join(engine, 'src', `${name}.mjs`)));
  const [{ cloudflareDay }, { loadConfig }, { buildReport, checkReport }, { centralDate }] = await Promise.all([
    mod('analytics'), mod('config'), mod('report'), mod('util'),
  ]);
  const { cfg, problems } = loadConfig('search-loop.config.json', root);
  if (problems.length) throw new Error(`INVALID_CONFIG: ${problems.join('; ')}`);
  const now = new Date();
  const dailyPath = path.join(root, cfg.ledger_dir, 'ai-daily.json');
  const daily = JSON.parse(fs.readFileSync(dailyPath, 'utf8'));
  if (!process.argv.includes('--report-only')) {
    const result = await cloudflareDay({ zoneName: cfg.analytics.zone, now });
    const next = recordDay(daily, centralDate(now), result);
    fs.writeFileSync(dailyPath, JSON.stringify(next, null, 2) + '\n');
  }
  const report = buildReport(cfg, { mode: cfg.mode, effectivePace: cfg.pace.start_per_day, now });
  const errors = checkReport(report);
  if (errors.length) throw new Error(`INVALID_REPORT: ${errors.join('; ')}`);
  const measuredDays = Object.entries(JSON.parse(fs.readFileSync(dailyPath)).days)
    .filter(([day, v]) => now - new Date(day + 'T12:00:00Z') < 7 * 86400000 && v.ai_visitors && v.ai_bot_hits)
    .map(([day]) => day).sort();
  if (!measuredDays.length || !measuredDays.includes(centralDate(now))) throw new Error('AI_MEASUREMENT_STALE: collect today before reporting');
  report.notes.push(`AI totals cover ${measuredDays.length} measured day(s): ${measuredDays.join(', ')}. Unread days are excluded, never zero-filled. Bot counts are requests, not people; referrals come from aggregate hostname-only analytics.`);
  const out = path.join(root, cfg.ledger_dir, 'reports', `search-loop-week-${report.week}.json`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
  fs.writeFileSync(path.join(root, 'search-loop-week.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`AI measurement: ${report.ai_visitors} referral visits; ${report.ai_bot_hits} bot requests; ${measuredDays.length} measured day(s)`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(e => { console.error(`NAMED STOP [AI_MEASUREMENT] ${e.message}`); process.exitCode = 1; });
}
