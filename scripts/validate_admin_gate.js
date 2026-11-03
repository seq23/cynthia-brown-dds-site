// The admin gate is server-side (functions/_middleware.js, 3 Nov 2026). Executed, not read:
// no session -> 401 on every admin path; secrets missing -> 503; wrong password -> 401 and five
// of them lock the address out; the right password -> a session cookie that opens the dashboard.
// The password here is a test-only value; the real hash lives only in the Pages secret.
const fs=require('fs');const path=require('path');const crypto=require('crypto');const {root,fail}=require('./validator_utils');
(async()=>{
const errs=[];
const src=fs.readFileSync(path.join(root,'functions/_middleware.js'),'utf8');
const mw=await import('data:text/javascript,'+encodeURIComponent(src));
const store=new Map();
globalThis.caches={default:{match:async(r)=>store.has(r.url)?new Response(store.get(r.url)):undefined,put:async(r,res)=>{store.set(r.url,await res.text());}}};
const TEST_PASSWORD='test-only-password';
const env={ADMIN_PASSWORD_SHA256:crypto.createHash('sha256').update(TEST_PASSWORD).digest('hex'),ADMIN_SESSION_KEY:'test-only-session-key-0123456789abcdef'};
let opened=0;const next=async()=>{opened+=1;return new Response('dashboard',{status:200});};
const call=(p,{method='GET',headers={},body,e=env}={})=>mw.onRequest({request:new Request('https://cynthiabrowndds.com'+p,{method,headers,body}),env:e,next});
const paths=['/admin','/admin/','/admin/index.html','/admin.html','/data/admin/content_manifest.json','/assets/js/admin.js',
  // Encoded, mixed-case, double-slash and double-encoded spellings the asset server resolves to the same files (audit, 3 Nov 2026).
  '/%61dmin/','/%64ata/admin/content_manifest.json','/assets/js/%61dmin.js','/ADMIN/','/Data/Admin/content_manifest.json','/assets/JS/Admin.js',
  '//admin/','/data//admin/content_manifest.json','/assets//js/admin.js','/%2561dmin/','/%2564ata/admin/content_manifest.json','/assets/js/%2561dmin.js','/admin%2Findex.html'];
for(const p of paths){const r=await call(p);if(r.status!==401)errs.push(`no session ${p} -> ${r.status}, want 401`);}
if(opened!==0)errs.push(`an admin path was served without a session (${opened})`);
const badEnc=await call('/%E0%A4%A');if(badEnc.status!==400)errs.push(`an undecodable path -> ${badEnc.status}, want 400`);
const pub=await call('/');if(pub.status!==200)errs.push('a public page must pass straight through');opened=0;
for(const p of ['/admin/','/data/admin/content_manifest.json']){const r=await call(p,{e:{}});if(r.status!==503)errs.push(`secrets missing ${p} -> ${r.status}, want 503`);}
const login=(pw,ip)=>call('/admin/login',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded','cf-connecting-ip':ip},body:new URLSearchParams({password:pw})});
const bad=await login('wrong','198.51.100.1');if(bad.status!==401||bad.headers.get('set-cookie'))errs.push(`wrong password -> ${bad.status}, want 401 and no cookie`);
const good=await login(TEST_PASSWORD,'198.51.100.2');const cookie=(good.headers.get('set-cookie')||'').split(';')[0];
if(good.status!==303||!/HttpOnly/.test(good.headers.get('set-cookie')||''))errs.push(`right password -> ${good.status}, want 303 with an HttpOnly cookie`);
const inside=await call('/data/admin/content_manifest.json',{headers:{cookie}});if(inside.status!==200||opened!==1)errs.push(`a valid session must open the dashboard, got ${inside.status}`);
const forged=await call('/admin/',{headers:{cookie:cookie.replace(/.$/,c=>c==='0'?'1':'0')}});if(forged.status!==401)errs.push(`a tampered session -> ${forged.status}, want 401`);
for(let i=0;i<5;i+=1)await login('wrong','203.0.113.9');
const locked=await login(TEST_PASSWORD,'203.0.113.9');if(locked.status!==429)errs.push(`after five wrong tries the address must be locked (429), got ${locked.status}`);
if(!fs.existsSync(path.join(root,'functions/_middleware.js')))errs.push('missing functions/_middleware.js');
fail(errs);
})().catch(e=>{console.error('FAIL: '+e.message);process.exit(1);});
