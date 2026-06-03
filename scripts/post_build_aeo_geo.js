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
      {"@context":"https://schema.org","@type":"Dentist","name":"Dr. Cynthia Brown, DDS","url":SITE,"image":`${SITE}${site.defaultOgImage}`,"areaServed":["Olive Branch, Mississippi","Southaven, Mississippi"],"alumniOf":[{"@type":"CollegeOrUniversity","name":"Spelman College"},{"@type":"CollegeOrUniversity","name":"Meharry Medical College School of Dentistry"}],"knowsAbout":["preventive dentistry","restorative dentistry","cosmetic dentistry","dental anxiety","smile confidence","dentures","implants","whitening","emergency dental care"]}
    ];
  } else {
    schema = [{"@context":"https://schema.org","@type":"WebPage","name":(html.match(/<title>(.*?)<\/title>/)||[])[1]||'Dr. Cynthia Brown DDS','url':url}];
  }
  const articleMatch = route.match(/^\/resources\/(insights|white-papers)\/([^/]+)\/$/);
  if(articleMatch){
    const item = publicItems.find(x=>x.meta.slug===articleMatch[2]);
    if(item){
      schema.push({"@context":"https://schema.org","@type":"Article","headline":item.meta.title,"description":item.meta.summary||item.meta.quickAnswer,"url":url,"datePublished":item.meta.scheduledAt,"dateModified":item.meta.lastReviewed||'2026-06-03',"author":{"@type":"Person","name":"Dr. Cynthia Brown, DDS"},"publisher":{"@type":"Organization","name":"Dr. Cynthia Brown, DDS","url":SITE},"about":item.meta.topicCategory||'dental care'});
      if(Array.isArray(item.meta.faqs) && item.meta.faqs.length){
        schema.push({"@context":"https://schema.org","@type":"FAQPage","mainEntity":item.meta.faqs.map(f=>({"@type":"Question","name":f.question,"acceptedAnswer":{"@type":"Answer","text":f.answer}}))});
      }
    }
  }
  schema.push({"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":SITE},{"@type":"ListItem","position":2,"name":route==='/'?'Home':rel.split('/').map(s=>s.replace(/-/g,' ')).join(' / '),"item":url}]});
  const script = `<script type="application/ld+json">${JSON.stringify(schema)}</script>`;
  html = html.includes('application/ld+json') ? html : html.replace('</head>', `${script}</head>`);
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
    nextAutomationStep: 'Month-13 auto-drafting can create ready_for_approval drafts only after an approved LLM provider key is configured.'
  };
  manifest.items = manifest.items.map(item => {
    const content = contents.find(c => c.meta.id === item.id);
    return {...item, quickAnswer: content?.meta.quickAnswer || null, usefulTakeaway: content?.meta.usefulTakeaway || null, queryClusterId: content?.meta.queryClusterId || null, aeoPassed: !!content?.meta.quickAnswer && !!content?.meta.usefulTakeaway, geoPassed: !!content?.meta.queryClusterId};
  });
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  fs.writeFileSync(distManifestPath, JSON.stringify(manifest, null, 2));
}

console.log(`AEO/GEO post-build complete: ${answers.records.length} answer records, llms.txt, canonical fixes, schema injection.`);
