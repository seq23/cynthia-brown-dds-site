import assert from 'node:assert/strict';
import { recordDay } from './collect_ai_analytics.mjs';
const day = '2026-11-03';
const old = { schema: 'search-loop-ai-daily-v1', days: { '2026-11-02': { not_read: 'not collected' } } };
const result = { ai_visitors: { total: 0 }, ai_bot_hits: { total: 130 }, window: { since: '2026-11-02', until: day } };
const got = recordDay(old, day, result);
assert.equal(got.days[day].ai_visitors.total, 0);
assert.equal(got.days[day].ai_bot_hits.total, 130);
assert.deepEqual(got.days['2026-11-02'], old.days['2026-11-02']);
assert.equal(old.days[day], undefined);
for (const bad of [{ notRead: '403 refused' }, { ai_visitors: { total: 0 }, botsNotRead: 'refused' }, { ai_visitors: { total: -1 }, ai_bot_hits: { total: 0 } }]) {
  assert.throws(() => recordDay(old, day, bad), /AI_MEASUREMENT_NOT_READ/);
}
console.log('AI measurement: 7 proofs passed (real zero, bot count, history, immutability, refused and partial sources, invalid counts)');
