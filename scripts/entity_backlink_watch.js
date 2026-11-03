'use strict';
/**
 * k6 — THE WEEKLY LINK-BACK WATCH. Do the profiles in entity.json still exist?
 *
 * Search Readiness k6 (authority audit, 30 Oct 2026): profiles die, get renamed or stop linking
 * back, and nothing notices. Run weekly by .github/workflows/entity-backlink-watch.yml (cron,
 * workflow_dispatch, and a push to main that touches the entity files so a new profile is proved
 * the moment it lands), or by hand:
 *
 *   node scripts/entity_backlink_watch.js            # fetch, classify, self-heal entity.json
 *   node scripts/entity_backlink_watch.js --dry-run  # fetch and classify, write nothing
 *   node scripts/entity_backlink_watch.js --self-test # prove the classifier and the self-heal
 *
 * Every sameAs and profiles_pending URL is fetched with a desktop browser user agent (three tries)
 * and given exactly ONE named state:
 *   linked        2xx, the page is the profile, and it names this site's host.
 *   resolves      2xx, the page is the profile, and entity.json records linkback_expected: false
 *                 for it - a third-party directory page nobody here can edit. A named state, not a
 *                 silent pass, and never raised as a problem.
 *   no_linkback   2xx, the profile page, but this site's host is nowhere on it, and a link back WAS
 *                 expected.  -> NAMED STOP, the workflow files it as one issue.
 *   unverifiable  2xx but the platform renders client-side, or what was served was an interstitial
 *                 rather than the profile. A named state, never a pass.
 *   dead          404 or 410 on every try.
 *   unreachable   anything else (5xx, 429, a refused robot, a network error) on every try. NOT
 *                 removed: a bad week is not a dead page.
 *
 * Self-heal (writes entity.json; the workflow turns the diff into a PR):
 *   - a dead sameAs URL is removed and parked in profiles_pending with the date and the status;
 *   - a pending profile that is now `linked` is promoted into sameAs. Only on a verified link-back:
 *     a 200 alone proves nothing on platforms that answer 200 for handles that do not exist.
 *
 * Rule 0: zero URLs examined exits 1. This job cannot pass having looked at nothing.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const CLIENT_RENDERED = /(^|\.)(instagram\.com|gumroad\.com|tiktok\.com|maps\.google\.com|maps\.app\.goo\.gl|g\.page)$/;

/** Where a missing link-back is fixed, per platform. Named so a stop says what to do, not just what broke. */
const LINK_FIELD = {
  'github.com': "GitHub > the repository's About panel > Website",
  'facebook.com': 'Facebook Page > Edit Page info > Website',
  'youtube.com': 'YouTube Studio > Customization > Basic info > Links',
  'linkedin.com': 'LinkedIn page > Edit page > Website URL',
  'healthgrades.com': 'Healthgrades > claim the profile > Practice website',
};

const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return null; } };
const urlOf = (item) => (typeof item === 'string' ? item : item && item.url);

/** The handle or path that must be on a page for it to be that profile and not an interstitial. */
function identityOf(url) {
  const segment = new URL(url).pathname.split('/').filter(Boolean).pop();
  return segment ? decodeURIComponent(segment).toLowerCase() : null;
}

/** entity.json says a link back is not expected from this URL (a directory page we do not edit). */
function linkbackExpected(entity, url) {
  const ev = (entity.sameAs_evidence || {})[url];
  return !(ev && ev.linkback_expected === false);
}

async function classify(url, ownHost, entity, fetchImpl = fetch, tries = 3) {
  let last = { status: 0, error: '' };
  for (let attempt = 0; attempt < tries; attempt += 1) {
    try {
      const res = await fetchImpl(url, { redirect: 'follow', headers: { 'user-agent': UA, 'accept-language': 'en-US,en' } });
      const body = res.ok ? await res.text() : '';
      last = { status: res.status, error: '' };
      if (res.ok) {
        if (CLIENT_RENDERED.test(hostOf(res.url || url))) return { url, state: 'unverifiable', status: res.status, why: 'client-rendered platform' };
        const lower = body.toLowerCase();
        const identity = identityOf(url);
        if (identity && !lower.includes(identity)) {
          return { url, state: 'unverifiable', status: res.status, why: `the page served does not carry "${identity}" (interstitial or consent page)` };
        }
        if (lower.includes(ownHost)) return { url, state: 'linked', status: res.status };
        return linkbackExpected(entity, url)
          ? { url, state: 'no_linkback', status: res.status }
          : { url, state: 'resolves', status: res.status, why: 'entity.json records linkback_expected: false for this page' };
      }
    } catch (e) {
      last = { status: 0, error: String((e && e.message) || e) };
    }
  }
  if (last.status === 404 || last.status === 410) return { url, state: 'dead', status: last.status };
  return { url, state: 'unreachable', status: last.status, why: last.error || `HTTP ${last.status}` };
}

/** Pure: given entity.json and the classified results, the healed entity and what changed. */
function heal(entity, results, today) {
  const byUrl = new Map(results.map((r) => [r.url, r]));
  const next = JSON.parse(JSON.stringify(entity));
  next.profiles_pending = next.profiles_pending || [];
  const changes = [];
  next.sameAs = (entity.sameAs || []).filter((url) => {
    const r = byUrl.get(url);
    if (!r || r.state !== 'dead') return true;
    changes.push(`removed dead sameAs ${url} (HTTP ${r.status})`);
    next.profiles_pending.push({ url, note: `removed from sameAs ${today}: HTTP ${r.status}. Promoted back when it resolves with a link-back.` });
    return false;
  });
  next.profiles_pending = next.profiles_pending.filter((item) => {
    const url = urlOf(item);
    const r = byUrl.get(url);
    if (!r || r.state !== 'linked' || next.sameAs.includes(url)) return true;
    changes.push(`promoted ${url} from profiles_pending into sameAs (resolves and links back)`);
    next.sameAs.push(url);
    return false;
  });
  if (changes.length) next.updated_at = today;
  const ownHost = hostOf(entity.url);
  const stops = results
    .filter((r) => r.state === 'no_linkback' && (entity.sameAs || []).includes(r.url))
    .map((r) => {
      const field = Object.entries(LINK_FIELD).find(([h]) => String(hostOf(r.url)).endsWith(h));
      return `NAMED STOP [ENTITY_LINKBACK_MISSING] ${r.url} does not name https://${ownHost}. Edit: ${field ? field[1] : "the profile's website field"}. Clears on the next weekly run once the link is there.`;
    });
  return { next, changes, stops };
}

// ── --self-test: the classifier and the self-heal are proved without the network ────────────────
async function selfTest() {
  const fail = (m) => { console.error(`SELF-TEST FAIL: ${m}`); process.exitCode = 1; };
  const entity = {
    url: 'https://cynthiabrowndds.com',
    sameAs: ['https://example.org/profiles/brown', 'https://example.net/dir/brown'],
    sameAs_evidence: { 'https://example.net/dir/brown': { what: 'a directory', probed: 'today', linkback_expected: false } },
    profiles_pending: [{ url: 'https://example.com/pending/brown', note: 'waiting' }],
  };
  const reply = (status, body) => (url) => ({ ok: status >= 200 && status < 300, status, url, text: async () => body });
  const cases = [
    ['linked', 'https://example.org/profiles/brown', reply(200, 'Dr Brown — see cynthiabrowndds.com — brown'), 'linked'],
    ['no_linkback', 'https://example.org/profiles/brown', reply(200, 'a page about brown and nothing else'), 'no_linkback'],
    ['resolves when no link-back is expected', 'https://example.net/dir/brown', reply(200, 'directory entry for brown'), 'resolves'],
    ['dead', 'https://example.org/profiles/brown', reply(404, ''), 'dead'],
    ['unreachable on 503', 'https://example.org/profiles/brown', reply(503, ''), 'unreachable'],
    ['unverifiable interstitial', 'https://example.org/profiles/brown', reply(200, 'are you a robot?'), 'unverifiable'],
    ['unverifiable client-rendered', 'https://www.instagram.com/brown', reply(200, 'brown'), 'unverifiable'],
  ];
  for (const [name, url, impl, want] of cases) {
    const r = await classify(url, 'cynthiabrowndds.com', entity, impl, 1);
    if (r.state !== want) fail(`${name}: got ${r.state}, wanted ${want}`);
  }
  // A dead profile leaves sameAs and is parked; a linked pending profile is promoted.
  const { next, changes, stops } = heal(entity, [
    { url: 'https://example.org/profiles/brown', state: 'dead', status: 410 },
    { url: 'https://example.net/dir/brown', state: 'resolves', status: 200 },
    { url: 'https://example.com/pending/brown', state: 'linked', status: 200 },
  ], '2026-11-03');
  if (next.sameAs.includes('https://example.org/profiles/brown')) fail('a dead sameAs was not removed');
  if (!next.sameAs.includes('https://example.com/pending/brown')) fail('a linked pending profile was not promoted');
  if (next.profiles_pending.some((i) => urlOf(i) === 'https://example.com/pending/brown')) fail('a promoted profile is still pending');
  if (!next.profiles_pending.some((i) => urlOf(i) === 'https://example.org/profiles/brown')) fail('a removed profile was not parked in profiles_pending');
  if (changes.length !== 2) fail(`expected 2 self-heal changes, got ${changes.length}`);
  if (stops.length) fail(`a run with no no_linkback raised ${stops.length} stops`);
  // A no_linkback that WAS expected raises exactly one named stop.
  const s2 = heal(entity, [{ url: 'https://example.org/profiles/brown', state: 'no_linkback', status: 200 }], '2026-11-03').stops;
  if (s2.length !== 1 || !s2[0].includes('ENTITY_LINKBACK_MISSING')) fail('an expected-but-missing link-back raised no named stop');
  // One not expected raises none.
  const s3 = heal(entity, [{ url: 'https://example.net/dir/brown', state: 'resolves', status: 200 }], '2026-11-03').stops;
  if (s3.length) fail('a linkback_expected:false page raised a stop');
  if (!process.exitCode) console.log(`entity-backlink-watch self-test: ${cases.length} classifier cases and 3 self-heal proofs passed.`);
}

async function main() {
  if (process.argv.includes('--self-test')) return selfTest();
  const dryRun = process.argv.includes('--dry-run');
  const file = path.join(ROOT, process.env.ENTITY_FILE || 'entity.json');
  const entity = JSON.parse(fs.readFileSync(file, 'utf8'));
  const ownHost = hostOf(entity.url);
  if (!ownHost) throw new Error('NAMED STOP [ENTITY_URL_MISSING] entity.json has no url, so nothing can be checked for a link back');
  const urls = [...(entity.sameAs || []), ...(entity.profiles_pending || []).map(urlOf)].filter(Boolean);
  if (!urls.length) {
    console.error('NAMED STOP [NOTHING_CHECKED] entity-backlink-watch examined zero profiles: entity.json has no sameAs and nothing pending');
    process.exit(1);
  }
  const results = [];
  for (const url of urls) results.push(await classify(url, ownHost, entity));
  const today = new Date().toISOString().slice(0, 10);
  const { next, changes, stops } = heal(entity, results, today);

  for (const r of results) console.log(`${r.state.padEnd(12)} ${r.url}${r.why ? ` (${r.why})` : ''}`);
  for (const c of changes) console.log(`SELF-HEAL ${c}`);
  for (const s of stops) console.log(s);
  if (!next.sameAs.length) {
    console.log('NAMED STOP [ENTITY_SAMEAS_EMPTY] every sameAs profile is dead; scripts/validate_entity_graph.js and the build will refuse until one resolves.');
  }
  if (process.env.WATCH_REPORT) {
    fs.writeFileSync(process.env.WATCH_REPORT, `${JSON.stringify({ checked_at: new Date().toISOString(), results, changes, stops }, null, 2)}\n`);
  }
  if (changes.length && !dryRun) fs.writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`);
  console.log(`entity-backlink-watch: ${results.length} profiles examined, ${changes.length} self-heal changes, ${stops.length} named stops.`);
}

if (require.main === module) main().catch((e) => { console.error(String((e && e.message) || e)); process.exit(1); });
module.exports = { classify, heal, UA };
