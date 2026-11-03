// Server-side gate over the admin dashboard (owner's call, 3 Nov 2026: /admin/ must not be open).
// Covers /admin, /admin/*, /admin.html, /data/admin/* (the manifest only admin.js reads) and
// /assets/js/admin.js. Everything else passes straight through.
//
// The password is Dr. Brown's EXISTING one: the server hashes what she types (SHA-256, the scheme
// the old browser gate used) and compares it in constant time with the Pages secret
// ADMIN_PASSWORD_SHA256. A right password sets an HttpOnly session cookie signed with
// ADMIN_SESSION_KEY (8 hours). Five wrong tries from one address lock it out for 15 minutes.
// Either secret missing: the admin answers 503 and nothing opens (fail closed).

const COOKIE = 'cbd_admin';
const SESSION_SECONDS = 8 * 3600;
const MAX_FAILS = 5;
const LOCK_SECONDS = 15 * 60;

export function isProtected(pathname) {
  return pathname === '/admin' || pathname.startsWith('/admin/') || pathname === '/admin.html'
    || pathname.startsWith('/data/admin/') || pathname === '/assets/js/admin.js';
}

const enc = new TextEncoder();
const hex = (buf) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');

function sameText(a, b) {
  const x = enc.encode(String(a)); const y = enc.encode(String(b));
  let diff = x.length === y.length ? 0 : 1;
  for (let i = 0; i < Math.max(x.length, y.length); i += 1) diff |= (x[i] || 0) ^ (y[i] || 0);
  return diff === 0;
}

async function hmac(key, data) {
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', k, enc.encode(data)));
}

async function makeSession(env, now) {
  const exp = String(Math.floor(now / 1000) + SESSION_SECONDS);
  return `${exp}.${await hmac(env.ADMIN_SESSION_KEY, exp)}`;
}

async function sessionOk(request, env, now) {
  const m = (request.headers.get('cookie') || '').match(/(?:^|;\s*)cbd_admin=([0-9]+)\.([0-9a-f]{64})/);
  if (!m) return false;
  if (Number(m[1]) * 1000 <= now) return false;
  return sameText(m[2], await hmac(env.ADMIN_SESSION_KEY, m[1]));
}

function lockKey(ip) { return new Request(`https://admin-lock.invalid/${encodeURIComponent(ip)}`); }
async function failCount(ip) {
  const cache = globalThis.caches?.default; if (!cache || !ip) return 0;
  try { const hit = await cache.match(lockKey(ip)); return hit ? Number(await hit.text()) || 0 : 0; } catch { return 0; }
}
async function recordFail(ip, n) {
  const cache = globalThis.caches?.default; if (!cache || !ip) return;
  try { await cache.put(lockKey(ip), new Response(String(n), { headers: { 'cache-control': `max-age=${LOCK_SECONDS}` } })); } catch { /* best effort */ }
}

function page(status, message) {
  const body = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow, noarchive"><title>Admin sign-in | Dr. Cynthia Brown DDS</title><link rel="stylesheet" href="/assets/css/styles.css"></head><body class="admin-shell"><div class="admin-login"><h1 class="section-title">Content Admin</h1>${message ? `<p style="color:#b00020;font-weight:800">${message}</p>` : ''}<form method="post" action="/admin/login"><label>Password<input name="password" type="password" autocomplete="current-password" required></label><button class="btn" type="submit">Enter Admin</button></form></div></body></html>`;
  return new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow, noarchive' } });
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  if (!isProtected(url.pathname)) return next();
  const now = Date.now();
  const noStore = { 'cache-control': 'no-store' };

  if (!env.ADMIN_PASSWORD_SHA256 || !env.ADMIN_SESSION_KEY) {
    return new Response('Admin is not configured.', { status: 503, headers: noStore });
  }

  if (url.pathname === '/admin/login' && request.method === 'POST') {
    const ip = request.headers.get('cf-connecting-ip') || '';
    const fails = await failCount(ip);
    if (fails >= MAX_FAILS) return page(429, 'Too many tries. Please wait 15 minutes and try again.');
    let typed = '';
    try { typed = String((await request.formData()).get('password') || ''); } catch { typed = ''; }
    const typedHash = hex(await crypto.subtle.digest('SHA-256', enc.encode(typed)));
    if (!typed || !sameText(typedHash, String(env.ADMIN_PASSWORD_SHA256).trim().toLowerCase())) {
      await recordFail(ip, fails + 1);
      return page(401, 'Incorrect password.');
    }
    const cookie = `${COOKIE}=${await makeSession(env, now)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}`;
    return new Response(null, { status: 303, headers: { location: '/admin/', 'set-cookie': cookie, ...noStore } });
  }

  if (await sessionOk(request, env, now)) {
    const res = await next();
    const out = new Response(res.body, res);
    out.headers.set('cache-control', 'no-store');
    return out;
  }
  const wantsHtml = url.pathname.startsWith('/admin') && !url.pathname.endsWith('.js');
  return wantsHtml ? page(401, '') : new Response('Sign in at /admin/.', { status: 401, headers: noStore });
}
