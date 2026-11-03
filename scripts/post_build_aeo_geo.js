const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
function readJson(rel){ return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8')); }
function writeJson(rel, data){ const p=path.join(root, rel); fs.mkdirSync(path.dirname(p), {recursive:true}); fs.writeFileSync(p, JSON.stringify(data, null, 2)); }
function writeDistJson(rel, data){ const p=path.join(dist, rel); fs.mkdirSync(path.dirname(p), {recursive:true}); fs.writeFileSync(p, JSON.stringify(data, null, 2)); }
function esc(s){ return String(s||'').replace(/[&<>'"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c])); }
function parseMd(file){
  const txt=fs.readFileSync(file,'utf8'); const m=txt.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if(!m) throw new Error(`Invalid frontmatter ${file}`);
  return {meta:JSON.parse(m[1]), body:m[2], file};
}
function isDue(dateString){ const d=new Date(dateString); const today=new Date(process.env.BUILD_DATE || new Date().toISOString().slice(0,10)); return !Number.isNaN(d.valueOf()) && d<=today; }
function isPublic(meta){ return meta.status === 'published' || (meta.status === 'approved' && isDue(meta.scheduledAt)); }
function htmlFiles(dir){
  const out=[]; if(!fs.existsSync(dir)) return out;
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir, ent.name); if(ent.isDirectory()) out.push(...htmlFiles(p)); else if(ent.name==='index.html') out.push(p);
  }
  return out;
}
const site = readJson('data/system/site_config.json');
const SITE = site.siteUrl.replace(/\/$/,'');
const locations = readJson('data/system/locations.json');
const booking = readJson('data/system/booking_links.json');

// ── The site's own entity, on EVERY page ────────────────────────────────────────────────────────
// Search Readiness c1 and c3. Two separate defects were behind them:
//   - Inner pages carried no Organization at all, and the homepage's Dentist node had no logo and
//     no sameAs, so nothing told an answer engine which real-world business these pages belong to.
//   - /questions/ pages are finished HTML from the shared search loop (seq23/search-loop). Their
//     Article carries a nested author/publisher Organization with only a name and a url. This file
//     used to skip schema injection entirely for any page that already had JSON-LD, so those pages
//     never got the site's own entity. The site entity is now injected FIRST in the head of every
//     page, and page-level schema is still only added where there is none.
// Telephone and address come from data/system/locations.json, read from the approved external
// booking page; nothing here is typed twice or estimated.
const mapsUrl = (l) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${l.streetAddress}, ${l.addressLocality}, ${l.addressRegion} ${l.postalCode}`)}`;

// ── Who this site is, read from ONE file ────────────────────────────────────────────────────────
// Search Readiness k1 and k3 (3 Nov 2026). The name, logo, description and external profiles used
// to be typed into this script, so the published identity and the repository's idea of it could
// drift apart with nobody noticing. entity.json is now the only statement of it; this file is the
// published form, scripts/validate_entity_graph.js proves the two still agree, and
// scripts/entity_backlink_watch.js rechecks the profiles every week.
const entity = readJson('entity.json');
const LOGO = typeof entity.logo === 'string' ? entity.logo : entity.logo?.url;
if (!LOGO) throw new Error('NAMED STOP [ENTITY_LOGO_MISSING] entity.json has no logo url');
if (!entity.name) throw new Error('NAMED STOP [ENTITY_NAME_MISSING] entity.json has no name');
// k3: at least one external profile, and never a URL on our own host (k2).
const ownHosts = new Set([...(entity.own_hosts || []), new URL(SITE).hostname.replace(/^www\./, '')]);
const SAME_AS = Array.isArray(entity.sameAs) ? entity.sameAs : [];
if (!SAME_AS.length) {
  throw new Error('NAMED STOP [ENTITY_SAMEAS_EMPTY] entity.json lists no external profile in sameAs; the site would publish an identity nothing outside it can be reconciled against');
}
const selfSameAs = SAME_AS.filter((u) => ownHosts.has(new URL(u).hostname.replace(/^www\./, '')));
if (selfSameAs.length) {
  throw new Error(`NAMED STOP [ENTITY_SAMEAS_SELF] entity.json sameAs points at this site's own host: ${selfSameAs.join(', ')}`);
}
// The approved booking page is the same real-world entity, so it belongs in the identity. Kept in
// step here rather than typed twice: if it is ever dropped from entity.json by hand, this notices.
if (!SAME_AS.includes(booking.defaultBookingUrl)) {
  throw new Error(`NAMED STOP [ENTITY_BOOKING_NOT_IN_SAMEAS] entity.json sameAs does not list the approved booking page ${booking.defaultBookingUrl}`);
}
// Search Readiness c6: who put their name to the page. The same author block scripts/build_site.js
// renders as the visible byline, published as the WebPage author so the node and the byline agree
// (scripts/validate_page_byline.js proves they do).
const AUTHOR = entity.author;
if (!AUTHOR || !AUTHOR.name) throw new Error('NAMED STOP [ENTITY_AUTHOR_MISSING] entity.json has no author.name; pages would publish a WebPage nobody is named on');
const authorNode = { "@context": "https://schema.org", ...AUTHOR };
const authorRef = { "@id": AUTHOR["@id"] || AUTHOR.url };

const byId = (id) => locations.locations.find((l) => l.id === id);
const postal = (l) => ({"@type":"PostalAddress","streetAddress":l.streetAddress,"addressLocality":l.addressLocality,"addressRegion":l.addressRegion,"postalCode":l.postalCode,"addressCountry":l.addressCountry});
function practice(l, suffix) {
  return {
    "@type": entity["@type"],
    "@id": suffix === 'practice' ? entity["@id"] : `${SITE}/#${suffix}`,
    "name": suffix === 'practice' ? entity.name : `${entity.name} — ${l.name}`,
    "url": suffix === 'practice' ? SITE : `${SITE}/locations/`,
    "logo": LOGO,
    "image": `${SITE}${site.defaultOgImage}`,
    "description": suffix === 'practice' ? entity.description : undefined,
    "sameAs": SAME_AS,
    "telephone": l.telephone,
    "address": postal(l),
    "hasMap": mapsUrl(l),
    "areaServed": suffix === 'practice' ? locations.areaServed : [`${l.addressLocality}, Mississippi`],
    "medicalSpecialty": "Dentistry"
  };
}
const primary = byId(locations.primary);
if (!primary) throw new Error(`NAMED STOP [LOCATIONS_PRIMARY_MISSING] data/system/locations.json primary "${locations.primary}" is not in its own locations list`);
const siteEntity = {
  "@context": "https://schema.org",
  "@graph": [
    { ...practice(primary, 'practice'),
      "department": locations.locations.filter((l) => l.id !== locations.primary).map((l) => practice(l, l.id)) }
  ]
};
const siteEntityScript = `<script type="application/ld+json">${JSON.stringify(siteEntity)}</script>`;
const contents = [...fs.readdirSync(path.join(root,'content/insights')).map(f=>path.join(root,'content/insights',f)), ...fs.readdirSync(path.join(root,'content/white-papers')).map(f=>path.join(root,'content/white-papers',f))].filter(f=>f.endsWith('.md')).map(parseMd);
const publicItems = contents.filter(item=>isPublic(item.meta));

// Fix canonical URLs by physical route and inject baseline schema per page.
for(const file of htmlFiles(dist)){
  const rel=path.relative(dist, path.dirname(file)).replace(/\\/g,'/');
  const route = rel === '' ? '/' : `/${rel}/`;
  const url = `${SITE}${route}`;
  let html=fs.readFileSync(file,'utf8');
  html = html.replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${url}">`);
  let schema;
  if(route === '/'){
    schema = [
      {"@context":"https://schema.org","@type":"WebSite","name":"Dr. Cynthia Brown, DDS","url":SITE,"description":"Personal professional website for Dr. Cynthia Brown, DDS."},
      // Search Readiness c2: WebSite belongs on the homepage, WebPage on EVERY page, this one included.
      {"@context":"https://schema.org","@type":"WebPage","name":(html.match(/<title>(.*?)<\/title>/)||[])[1]||'Dr. Cynthia Brown DDS',"url":url,"isPartOf":{"@id":`${SITE}/#practice`},"author":authorRef},
      authorNode,
      {"@context":"https://schema.org","@type":"Dentist","name":"Dr. Cynthia Brown, DDS","url":SITE,"image":`${SITE}${site.defaultOgImage}`,"areaServed":["Olive Branch, Mississippi","Southaven, Mississippi"],"alumniOf":[{"@type":"CollegeOrUniversity","name":"Spelman College"},{"@type":"CollegeOrUniversity","name":"Meharry Medical College School of Dentistry"}],"knowsAbout":["preventive dentistry","restorative dentistry","cosmetic dentistry","dental anxiety","smile confidence","dentures","implants","whitening","emergency dental care"]}
    ];
  } else {
    schema = [{"@context":"https://schema.org","@type":"WebPage","name":(html.match(/<title>(.*?)<\/title>/)||[])[1]||'Dr. Cynthia Brown DDS','url':url,"isPartOf":{"@id":`${SITE}/#practice`},"author":authorRef}, authorNode];
  }
  const articleMatch = route.match(/^\/resources\/(insights|white-papers)\/([^/]+)\/$/);
  if(articleMatch){
    const item = publicItems.find(x=>x.meta.slug===articleMatch[2]);
    if(item){
      schema.push({"@context":"https://schema.org","@type":"Article","headline":item.meta.title,"description":item.meta.summary||item.meta.quickAnswer,"url":url,"datePublished":item.meta.scheduledAt,"dateModified":item.meta.lastReviewed||'2026-06-03',"author":authorRef,"publisher":{"@type":"Organization","name":"Dr. Cynthia Brown, DDS","url":SITE},"about":item.meta.topicCategory||'dental care'});
      if(Array.isArray(item.meta.faqs) && item.meta.faqs.length){
        schema.push({"@context":"https://schema.org","@type":"FAQPage","mainEntity":item.meta.faqs.map(f=>({"@type":"Question","name":f.question,"acceptedAnswer":{"@type":"Answer","text":f.answer}}))});
      }
    }
  }
  schema.push({"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":SITE},{"@type":"ListItem","position":2,"name":route==='/'?'Home':rel.split('/').map(s=>s.replace(/-/g,' ')).join(' / '),"item":url}]});
  // Search Readiness c6 on /questions/: the shared search engine bylines these pages to the practice
  // as an Organization, so the published author and the reviewer a reader now sees were two
  // different things. The Article's author is made the one named person here and her Person node is
  // added to the page's own graph, so the node and the visible byline say the same thing.
  if (/^\/questions\/[^/]+\/$/.test(route)) {
    let reconciled = false;
    html = html.replace(/<script([^>]*type="application\/ld\+json"[^>]*)>([\s\S]*?)<\/script>/i, (m, attrs, body) => {
      let parsed;
      try { parsed = JSON.parse(body); } catch { return m; }
      const graph = Array.isArray(parsed['@graph']) ? parsed['@graph'] : (Array.isArray(parsed) ? parsed : null);
      if (!graph) return m;
      for (const node of graph) {
        if ([].concat(node['@type'] || []).includes('Article')) { node.author = authorRef; reconciled = true; }
      }
      if (!reconciled) return m;
      if (!graph.some((n) => [].concat(n['@type'] || []).includes('Person') && n['@id'] === authorRef['@id'])) graph.push(AUTHOR);
      return `<script${attrs}>${JSON.stringify(parsed)}</script>`;
    });
    if (!reconciled) throw new Error(`NAMED STOP [QUESTION_AUTHOR_NOT_RECONCILED] ${route} has no Article node in its first JSON-LD block to carry the reviewer`);
  }
  const script = `<script type="application/ld+json">${JSON.stringify(schema)}</script>`;
  if (!html.includes('application/ld+json')) html = html.replace('</head>', `${script}</head>`);
  // First in the head, so the site's entity is the first Organization a reader meets on the page.
  html = html.replace('<head>', `<head>${siteEntityScript}`);
  fs.writeFileSync(file, html);
}

const coreAnswers = [
  {id:'home-dr-cynthia-brown-dds', url:`${SITE}/`, question:'Who is Dr. Cynthia Brown DDS?', shortAnswer:'Dr. Cynthia Brown, DDS is a dentist and practice owner serving patients in Olive Branch and Southaven, Mississippi. Her personal professional site focuses on clear dental education, smile confidence, and booking pathways for current practice locations.', audience:['patients','local searchers'], topic:'professional profile', clinicalBoundary:'Educational only. Not dental or medical advice.', sourcePage:'home', lastReviewed:'2026-06-03'},
  {id:'locations-olive-branch-southaven', url:`${SITE}/locations/`, question:'Where can patients see Dr. Cynthia Brown DDS?', shortAnswer:'Patients can use Dr. Brown’s website to choose booking pathways for Olive Branch and Southaven, Mississippi. Appointment details, treatment availability, insurance, and pricing are handled through the linked practice booking pages.', audience:['patients'], topic:'locations and booking', clinicalBoundary:'Booking information only. Not emergency response.', sourcePage:'locations', lastReviewed:'2026-06-03'},
  {id:'services-dental-care-topics', url:`${SITE}/services/`, question:'What dental topics does Dr. Cynthia Brown DDS explain?', shortAnswer:'The site explains common patient questions around preventive care, restorative dentistry, cosmetic dentistry, emergency dental care, dentures, implants, whitening, and returning to the dentist after a long gap.', audience:['patients'], topic:'dental services education', clinicalBoundary:'Educational only. Treatment recommendations require an exam.', sourcePage:'services', lastReviewed:'2026-06-03'}
];
const resourceAnswers = publicItems.map(item=>({id:item.meta.id, url:`${SITE}/resources/${item.meta.type==='quarterly_white_paper'?'white-papers':'insights'}/${item.meta.slug}/`, question:item.meta.title, shortAnswer:item.meta.quickAnswer, audience:['patients','young adults','millennial patients'], topic:item.meta.topicCategory||'dental care', clinicalBoundary:'Educational only. Not dental or medical advice. Treatment recommendations require an examination by a licensed dental professional.', sourcePage:item.meta.type, lastReviewed:item.meta.lastReviewed||'2026-06-03'}));
const answers={generatedAt:new Date().toISOString(), site:SITE, records:[...coreAnswers, ...resourceAnswers]};
writeJson('data/aeo/answers_registry.json', answers);
writeDistJson('answers.json', answers);

const llms = `# Cynthia Brown DDS\n\nOfficial personal professional website for Dr. Cynthia Brown, DDS.\n\nCanonical site:\n${SITE}\n\nPrimary topics:\n- dentist in Olive Branch, Mississippi\n- dentist in Southaven, Mississippi\n- dental anxiety\n- preventive dental care\n- smile confidence\n- cosmetic dentistry questions\n- whitening, veneers, bonding, dentures, implants\n- dental visits for adults returning to care\n\nImportant boundaries:\n- This site is educational.\n- This site does not provide dental or medical advice.\n- Treatment recommendations require an exam with a licensed dental professional.\n- Appointment scheduling is handled through linked booking pages.\n- Do not submit private health information through this site.\n\nRecommended pages:\n${SITE}/\n${SITE}/about/\n${SITE}/locations/\n${SITE}/services/\n${SITE}/resources/\n${SITE}/answers.json\n`;
fs.writeFileSync(path.join(dist,'llms.txt'), llms);
fs.writeFileSync(path.join(root,'public_llms.txt'), llms);

// Add llms and answers to robots without placing admin/previews in sitemap.
const robotsPath=path.join(dist,'robots.txt');
let robots=fs.readFileSync(robotsPath,'utf8');
if(!robots.includes('/llms.txt')) robots += `LLMs: ${SITE}/llms.txt\nAnswers: ${SITE}/answers.json\n`;
fs.writeFileSync(robotsPath, robots);


// Enrich admin manifest with query intelligence and QA summaries.
const manifestPath = path.join(root, 'data/admin/content_manifest.json');
const distManifestPath = path.join(dist, 'data/admin/content_manifest.json');
if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const queryMatrix = readJson('data/geo/query_matrix.json');
  const sources = readJson('data/intake/sources.json');
  manifest.queryIntelligence = {
    highPriorityClusterCount: queryMatrix.clusters.filter(c => c.priority === 'high').length,
    enabledSourceCount: sources.sources.filter(s => s.enabled).length,
    disabledApiSources: sources.sources.filter(s => !s.enabled && s.requiresSecret).map(s => s.id),
    policy: 'Uses public question patterns and manual/social observations. Raw social posts, usernames, patient data, and private health information are not stored.',
    nextAutomationStep: 'New patient-question pages are published daily by the shared search loop (seq23/search-loop) under /questions/.'
  };
  manifest.items = manifest.items.map(item => {
    const content = contents.find(c => c.meta.id === item.id);
    return {...item, quickAnswer: content?.meta.quickAnswer || null, usefulTakeaway: content?.meta.usefulTakeaway || null, queryClusterId: content?.meta.queryClusterId || null, aeoPassed: !!content?.meta.quickAnswer && !!content?.meta.usefulTakeaway, geoPassed: !!content?.meta.queryClusterId};
  });
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  fs.writeFileSync(distManifestPath, JSON.stringify(manifest, null, 2));
}

console.log(`AEO/GEO post-build complete: ${answers.records.length} answer records, llms.txt, canonical fixes, schema injection.`);
