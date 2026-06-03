const fs=require('fs');const path=require('path');const {root,fail}=require('./validator_utils');
const errs=[];
const css=fs.readFileSync(path.join(root,'assets/css/styles.css'),'utf8');
if(css.includes('@import')) errs.push('CSS must not use @import for fonts; use preconnect/link tags to reduce render blocking.');
const vars=new Set([...css.matchAll(/--([a-zA-Z0-9-]+)\s*:/g)].map(m=>m[1]));
for(const m of css.matchAll(/var\(--([a-zA-Z0-9-]+)/g)){ if(!vars.has(m[1])) errs.push(`CSS uses undefined variable --${m[1]}`); }
if(!/@media\(max-width:640px\)/.test(css)) errs.push('Missing 640px mobile refinement breakpoint.');
if(!/prefers-reduced-motion:reduce/.test(css)) errs.push('Missing prefers-reduced-motion handling.');
if(!/overflow-x:hidden/.test(css)) errs.push('Body/html must guard against horizontal overflow.');
if(!/min-height:44px/.test(css)) errs.push('Mobile touch targets must include 44px minimum height rule.');
const siteJs=fs.readFileSync(path.join(root,'assets/js/site.js'),'utf8');
if(!siteJs.includes("Escape")) errs.push('Mobile menu should close on Escape.');
if(!siteJs.includes('aria-label')) errs.push('Mobile menu should update aria-label.');
const home=fs.readFileSync(path.join(root,'dist/index.html'),'utf8');
if(!home.includes('rel="preload" as="image"')) errs.push('Homepage should preload the hero image.');
if(!home.includes('fetchpriority="high"')) errs.push('Hero image should use fetchpriority="high".');
if(!home.includes('loading="eager"')) errs.push('Hero image should be eager-loaded.');
if(!/<img[^>]+width="1122"[^>]+height="1402"/.test(home)) errs.push('Images should include width and height to prevent CLS.');
if(!home.includes('twitter:card')) errs.push('Pages should include Twitter/X card metadata.');
if(!home.includes('og:url')) errs.push('Pages should include og:url metadata.');
const admin=fs.readFileSync(path.join(root,'dist/admin/index.html'),'utf8');
if(!admin.includes('noindex, nofollow, noarchive')) errs.push('Admin page must include noindex meta.');
const previewFiles=[];
function walk(d){ if(!fs.existsSync(d))return; for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name); if(e.isDirectory()) walk(p); else if(e.name==='index.html') previewFiles.push(p);} }
walk(path.join(root,'dist/previews'));
for(const f of previewFiles){ const h=fs.readFileSync(f,'utf8'); if(!h.includes('noindex, nofollow, noarchive')) errs.push(`Preview missing noindex: ${path.relative(root,f)}`); }
const headers=fs.readFileSync(path.join(root,'dist/_headers'),'utf8');
if(!headers.includes('/assets/portraits/optimized/*')||!headers.includes('immutable')) errs.push('Optimized images need long immutable cache headers.');
if(!headers.includes('/admin/*')||!headers.includes('/previews/*')||!headers.includes('X-Robots-Tag')) errs.push('Admin/previews need X-Robots-Tag headers.');
fail(errs);
