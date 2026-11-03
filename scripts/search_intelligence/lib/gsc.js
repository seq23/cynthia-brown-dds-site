'use strict';
/**
 * THE ONE DOOR TO SEARCH CONSOLE (Search Readiness e4, e5, i6).
 *
 * Free, read-only, and credential-shaped so no human ever signs in: the `gsc-bot` service account
 * owns `sc-domain:cynthiabrowndds.com` (docs/HOSTING_AND_SEARCH_CONSOLE.md), its JSON key is the
 * `GSC_SERVICE_ACCOUNT_JSON` Actions secret, and everything here is a GET or a read-only POST.
 *
 * No dependencies on purpose: this repository ships no node_modules, so the JWT is signed with
 * node:crypto and every call is plain fetch. Node 20+ has both.
 *
 * RULE 0: a missing or refused credential is a NAMED STOP that exits non-zero. A collector that
 * wrote an empty file and exited 0 would turn "Google told us nothing" into "nothing is wrong",
 * which is the exact failure these items exist to catch.
 */
const crypto = require('crypto');

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
const API = 'https://www.googleapis.com/webmasters/v3';
const INSPECT = 'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect';

function stop(code, why) {
  console.error(`NAMED STOP [${code}] ${why}`);
  process.exit(1);
}

function serviceAccount() {
  const raw = process.env.GSC_SERVICE_ACCOUNT_JSON;
  if (!raw || !raw.trim()) {
    stop('GSC_SERVICE_ACCOUNT_JSON_MISSING',
      'the Search Console service account key is not in the environment; nothing can be read. '
      + 'It is the GSC_SERVICE_ACCOUNT_JSON Actions secret, and the Boss OS vault key of the same name locally.');
  }
  let key;
  try { key = JSON.parse(raw); } catch (e) { stop('GSC_SERVICE_ACCOUNT_JSON_UNPARSEABLE', `the key is not JSON: ${e.message}`); }
  if (!key.client_email || !key.private_key) stop('GSC_SERVICE_ACCOUNT_JSON_INCOMPLETE', 'the key has no client_email or private_key');
  return key;
}

/** The site URL this repo reads. GSC_SITE_URL may override it; the property is a domain property. */
function siteUrl() {
  return (process.env.GSC_SITE_URL || 'sc-domain:cynthiabrowndds.com').trim();
}

async function accessToken() {
  const key = serviceAccount();
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
    iss: key.client_email, scope: SCOPE, aud: TOKEN_URL, exp: now + 3600, iat: now,
  })}`;
  const assertion = `${unsigned}.${crypto.sign('RSA-SHA256', Buffer.from(unsigned), key.private_key).toString('base64url')}`;
  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  const j = await r.json().catch(() => ({}));
  if (!j.access_token) {
    stop('GSC_CREDENTIAL_REFUSED',
      `Google refused the service account (HTTP ${r.status} ${j.error || ''} ${j.error_description || ''}). `
      + 'A 401 is a bad or rotated key; a 403 is a key that is fine but not on the property.');
  }
  return j.access_token;
}

async function call(token, url, body) {
  const r = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json = null;
  try { json = text ? JSON.parse(text) : {}; } catch { /* reported with the status below */ }
  return { status: r.status, json, text };
}

/** Every property this account can see — used to prove the property exists before blaming the data. */
async function sites(token) {
  const r = await call(token, `${API}/sites`);
  if (r.status !== 200) stop('GSC_SITES_REFUSED', `sites.list answered ${r.status}: ${r.text.slice(0, 200)}`);
  return (r.json.siteEntry || []).map((s) => ({ siteUrl: s.siteUrl, permissionLevel: s.permissionLevel }));
}

async function searchAnalytics(token, site, body) {
  const r = await call(token, `${API}/sites/${encodeURIComponent(site)}/searchAnalytics/query`, body);
  if (r.status !== 200) stop('GSC_QUERY_REFUSED', `searchAnalytics answered ${r.status} for ${site}: ${r.text.slice(0, 200)}`);
  return r.json.rows || [];
}

async function sitemaps(token, site) {
  const r = await call(token, `${API}/sites/${encodeURIComponent(site)}/sitemaps`);
  if (r.status !== 200) stop('GSC_SITEMAPS_REFUSED', `sitemaps.list answered ${r.status} for ${site}: ${r.text.slice(0, 200)}`);
  return r.json.sitemap || [];
}

/**
 * URL Inspection for one page. A quota refusal (429) or a per-URL error is returned, never fatal and
 * never silently a zero: the caller records it as a reason on that URL.
 */
async function inspect(token, site, url) {
  const r = await call(token, INSPECT, { inspectionUrl: url, siteUrl: site });
  if (r.status === 200) {
    const idx = r.json.inspectionResult?.indexStatusResult || {};
    return { ok: true, verdict: idx.verdict || null, coverageState: idx.coverageState || null, lastCrawlTime: idx.lastCrawlTime || null, robotsTxtState: idx.robotsTxtState || null };
  }
  const why = `HTTP ${r.status}${r.json?.error?.message ? `: ${String(r.json.error.message).slice(0, 120)}` : ''}`;
  return { ok: false, why, quota: r.status === 429 };
}

/** Run `jobs` with at most `width` in flight. The quota is per day, not per second; 8 is the checklist's. */
async function pool(items, width, worker) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(width, items.length) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await worker(items[i], i);
    }
  }));
  return out;
}

/** Central-time YYYY-MM-DD, the clock every job in this portfolio is defined in. */
function centralDate(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

const daysAgo = (n) => centralDate(new Date(Date.now() - n * 86400000));

module.exports = { stop, serviceAccount, siteUrl, accessToken, sites, searchAnalytics, sitemaps, inspect, pool, centralDate, daysAgo };
