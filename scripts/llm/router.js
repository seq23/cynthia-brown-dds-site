'use strict';
/**
 * i3 — THE ONE DOOR TO A LANGUAGE MODEL IN THIS REPOSITORY.
 *
 * Nothing here calls a model today (the writing is the shared search-loop engine's job). This exists
 * so that the first script that needs one cannot open its own door: a script that names its own model
 * is a script that will one day name a paid one, and the bill arrives a month later.
 *
 * The rules, read from config/llm_routing.json and enforced here rather than described:
 *   - max_cost_usd is 0, so every model id must end in `:free`. An id that does not is REFUSED
 *     before any request is made - not logged, not downgraded, refused.
 *   - the models are tried in order; a rate-limited or empty answer falls through to the next.
 *   - when none of them answers, that is the named stop NO_FREE_MODEL_ANSWERED. Never a paid model,
 *     and never a quiet empty string that a caller would publish.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const CONFIG = path.join(ROOT, 'config/llm_routing.json');

function loadConfig() {
  const cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
  if (Number(cfg.policy?.max_cost_usd) !== 0) {
    throw new Error(`NAMED STOP [PAID_ROUTING_CONFIG] config/llm_routing.json sets max_cost_usd ${cfg.policy?.max_cost_usd}; this repository spends nothing`);
  }
  const ids = Array.isArray(cfg.models) ? cfg.models : [];
  if (!ids.length) throw new Error('NAMED STOP [NO_MODELS_CONFIGURED] config/llm_routing.json lists no models');
  const paid = ids.filter((m) => !/:free$/.test(String(m)));
  if (paid.length) throw new Error(`NAMED STOP [PAID_MODEL_IN_CONFIG] ${paid.join(', ')} do not end in :free`);
  return cfg;
}

/**
 * Ask the free lane one question. Returns { text, model } or throws a named stop.
 * `messages` is the OpenAI chat shape: [{ role, content }].
 */
async function ask(messages, { maxTokens = 1200, temperature = 0.3, fetchImpl = fetch } = {}) {
  const cfg = loadConfig();
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('NAMED STOP [OPENROUTER_KEY_MISSING] OPENROUTER_API_KEY is not set; no free lane can be reached');
  const tried = [];
  for (const model of cfg.models) {
    let r;
    try {
      r = await fetchImpl(cfg.endpoint, {
        method: 'POST',
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature }),
      });
    } catch (e) { tried.push(`${model}: ${e.message}`); continue; }
    if (r.status === 401 || r.status === 403) {
      throw new Error(`NAMED STOP [OPENROUTER_KEY_DISABLED_OR_INVALID] ${model} answered ${r.status}`);
    }
    const j = await r.json().catch(() => ({}));
    const text = j.choices?.[0]?.message?.content;
    const cost = Number(j.usage?.cost ?? 0);
    if (cost > 0) throw new Error(`NAMED STOP [PAID_ANSWER] ${model} billed ${cost}; the free lane is not free and nothing is used from it`);
    if (text && text.trim()) return { text: text.trim(), model, cost: 0 };
    tried.push(`${model}: HTTP ${r.status}${j.error?.message ? ` ${String(j.error.message).slice(0, 80)}` : ' empty answer'}`);
  }
  throw new Error(`NAMED STOP [NO_FREE_MODEL_ANSWERED] every free model refused or answered empty: ${tried.join('; ')}`);
}

module.exports = { ask, loadConfig, CONFIG };
