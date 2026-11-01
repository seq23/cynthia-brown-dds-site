const fs=require('fs');const path=require('path');const {root,fail}=require('./validator_utils');const errs=[];
const links=JSON.parse(fs.readFileSync(path.join(root,'data/system/booking_links.json'),'utf8')).approvedExternalBookingLinks;
const site=JSON.parse(fs.readFileSync(path.join(root,'data/system/site_config.json'),'utf8')).siteUrl;
const allowed=new Set([...links,site,'https://fonts.googleapis.com','https://fonts.gstatic.com']);
const bookingLike=/book|schedul|appointment|aspendental|zocdoc|localmed|nexhealth/i;
const htmls=[];function walk(d){for(const f of fs.readdirSync(d)){const p=path.join(d,f);const st=fs.statSync(p);if(st.isDirectory())walk(p);else if(f.endsWith('.html'))htmls.push(p);}}walk(path.join(root,'dist'));
if(!htmls.length)errs.push('NAMED STOP [NOTHING_CHECKED] no built pages in dist/ (run the build first)');
for(const p of htmls){
  const s=fs.readFileSync(p,'utf8');
  // Question pages (seq23/search-loop) cite their verified sources by link; any booking or
  // scheduling link on them must still be the approved booking page.
  const isQuestion=p.includes(`${path.sep}dist${path.sep}questions${path.sep}`)&&!p.endsWith(`${path.sep}dist${path.sep}questions${path.sep}index.html`);
  const attr=isQuestion?/href="([^"]+)"/g:/(?:href|content)="([^"]+)"/g;
  for(const [,h] of s.matchAll(attr)){
    if(!h.startsWith('http')||allowed.has(h)||h.startsWith(site+'/')||h.startsWith('https://fonts.googleapis.com/css2')||h.startsWith('https://github.com/seq23/cynthia-brown-dds-site/'))continue;
    if(isQuestion&&!bookingLike.test(h))continue;
    errs.push(`Unapproved external link ${h} in ${path.relative(root,p)}`);
  }
}
fail(errs);
