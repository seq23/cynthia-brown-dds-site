const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const today = new Date(process.env.BUILD_DATE || new Date().toISOString().slice(0, 10));

function rm(p) { if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true }); }
function mkdir(p) { fs.mkdirSync(p, { recursive: true }); }
function copy(src, dst) {
  const st = fs.statSync(src);
  if (st.isDirectory()) { mkdir(dst); for (const f of fs.readdirSync(src)) copy(path.join(src, f), path.join(dst, f)); }
  else { mkdir(path.dirname(dst)); fs.copyFileSync(src, dst); }
}
function readJson(rel) { return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8')); }
function parseMd(file) {
  const txt = fs.readFileSync(file, 'utf8');
  const m = txt.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error('Invalid frontmatter ' + file);
  const meta = JSON.parse(m[1]);
  const body = m[2];
  return { meta, body, wordCount: body.trim().split(/\s+/).filter(Boolean).length, file };
}
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c])); }
function mdToHtml(md) {
  let html = ''; let paras = [];
  function flush() { if (paras.length) { html += `<p>${paras.join(' ')}</p>\n`; paras = []; } }
  for (const line of md.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) { flush(); continue; }
    if (t.startsWith('## ')) { flush(); html += `<h2>${esc(t.slice(3))}</h2>\n`; }
    else if (t.startsWith('# ')) { flush(); html += `<h1>${esc(t.slice(2))}</h1>\n`; }
    else { paras.push(esc(t)); }
  }
  flush(); return html;
}
function isDue(dateString) {
  const d = new Date(dateString);
  return !Number.isNaN(d.valueOf()) && d <= today;
}
function isPublic(item) {
  return item.meta.status === 'published' || (item.meta.status === 'approved' && isDue(item.meta.scheduledAt));
}
function img(name, alt, cls = '', opts = {}) {
  const stem = `/assets/portraits/optimized/${name}`;
  const loading = opts.loading || 'lazy';
  const fetchpriority = opts.fetchpriority ? ` fetchpriority="${opts.fetchpriority}"` : '';
  const sizes = opts.sizes || '(max-width: 640px) 92vw, (max-width: 980px) 78vw, 48vw';
  return `<picture><source type="image/webp" srcset="${stem}-700.webp 700w, ${stem}-1000.webp 1000w, ${stem}-1200.webp 1200w, ${stem}-1600.webp 1600w" sizes="${sizes}"><img class="${esc(cls)}" src="/assets/portraits/${name}.png" alt="${esc(alt)}" width="1122" height="1402" loading="${loading}" decoding="async"${fetchpriority}></picture>`;
}
const siteConfig = readJson('data/system/site_config.json');
const booking = readJson('data/system/booking_links.json');
const SITE_URL = siteConfig.siteUrl.replace(/\/$/, '');

function layout(title, desc, body, extra = '', opts = {}) {
  const canonical = opts.canonical || SITE_URL;
  const robots = opts.noindex ? '<meta name="robots" content="noindex, nofollow, noarchive">' : '';
  const preloadHero = opts.preloadHero ? `<link rel="preload" as="image" href="/assets/portraits/optimized/cynthia-brown-dds-dental-coat-portrait-1000.webp" imagesrcset="/assets/portraits/optimized/cynthia-brown-dds-dental-coat-portrait-700.webp 700w, /assets/portraits/optimized/cynthia-brown-dds-dental-coat-portrait-1000.webp 1000w, /assets/portraits/optimized/cynthia-brown-dds-dental-coat-portrait-1200.webp 1200w" imagesizes="(max-width: 640px) 92vw, (max-width: 980px) 78vw, 48vw">` : '';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${canonical}">${robots}<meta name="theme-color" content="#143d2c"><meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${SITE_URL}${esc(siteConfig.defaultOgImage)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${SITE_URL}${esc(siteConfig.defaultOgImage)}"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Allura&family=Cormorant+Garamond:wght@500;600;700&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet">${preloadHero}<link rel="stylesheet" href="/assets/css/styles.css"></head><body>${nav()}${body}${footer()}<script src="/assets/js/site.js" defer></script>${extra}</body></html>`;
}
function nav() {
  return `<header class="nav"><div class="container nav-inner"><a class="brand" href="/">Dr. Cynthia Brown, DDS</a><button class="menu-toggle" type="button" aria-controls="primaryNav" aria-expanded="false" aria-label="Open navigation menu">Menu</button><nav class="nav-links" id="primaryNav"><a href="/about/">About</a><a href="/services/">Services</a><a href="/locations/">Locations</a><a href="/resources/">Resources</a><a href="/book/" class="btn">Book a Visit</a></nav></div></header>`;
}
function footer() {
  return `<footer class="footer"><div class="container footer-grid"><div><h3>Dr. Cynthia Brown, DDS</h3><p>Dentist and practice owner serving patients in Olive Branch and Southaven, Mississippi.</p><p>This personal professional website is informational and does not collect patient health information.</p></div><div><h4>Explore</h4><p><a href="/about/">About</a><br><a href="/services/">Services</a><br><a href="/locations/">Locations</a><br><a href="/resources/">Resources</a><br><a href="/book/">Book</a></p></div><div><h4>Legal</h4><p><a href="/privacy/">Privacy</a><br><a href="/disclaimer/">Disclaimer</a></p></div></div></footer>`;
}
function writePage(route, html) { const dir = path.join(dist, route); mkdir(dir); fs.writeFileSync(path.join(dir, 'index.html'), html); }
function hero() {
  return `<section class="hero"><div class="container hero-grid"><div><div class="eyebrow">Olive Branch + Southaven, Mississippi</div><h1 class="word-reveal"><span>Dr.</span> <span>Cynthia</span> <span>Brown,</span> <span>DDS</span></h1><p class="lede">Dentist and practice owner serving patients in Olive Branch and Southaven, Mississippi.</p><div class="script">confidence, carefully considered</div><div class="hero-actions"><a class="btn" href="/book/">Book a Visit</a><a class="btn secondary" href="/locations/">Choose a Location</a><a class="btn secondary" href="/about/">Meet Dr. Brown</a></div></div><div class="portrait-frame hero-portrait">${img('cynthia-brown-dds-dental-coat-portrait','Professional portrait of Dr. Cynthia Brown, DDS in a dental coat','', {loading:'eager', fetchpriority:'high'})}</div></div></section>`;
}
function cards() {
  return `<section class="section"><div class="container"><h2 class="section-title">Warm, clear, confidence-centered dental care.</h2><p class="section-copy">Dr. Brown’s site is designed to help patients feel informed before they book: what to ask, how to think about cosmetic goals, and how to return to dental care without shame.</p><div class="grid three"><div class="card"><h3>Clarity</h3><p>Plain-language education so patients can understand options before making decisions.</p></div><div class="card"><h3>Confidence</h3><p>A smile-forward approach that respects health, function, beauty, and real life.</p></div><div class="card"><h3>Care</h3><p>A patient-first tone that is polished, kind, and never judgmental.</p></div></div></div></section>`;
}
function manifestoBand() {
  return `<section class="quote-band"><div class="container"><div class="script">doctor with taste</div><p>Polished dental education for patients who want confidence, clarity, and care that respects the whole person.</p></div></section>`;
}
function portraitBand() {
  return `<section class="section alt"><div class="container split"><div class="editorial-img">${img('cynthia-brown-dds-navy-editorial-portrait','Editorial professional portrait of Dr. Cynthia Brown')}</div><div><div class="eyebrow">Meet Dr. Brown</div><h2 class="section-title">A thoughtful clinical presence with a polished personal brand.</h2><p class="section-copy">Dr. Cynthia Brown, DDS studied at Spelman College and Meharry Medical College School of Dentistry. Her professional brand centers warmth, detail, clarity, and smile confidence for patients in Olive Branch and Southaven.</p><a class="btn secondary" href="/about/">Read More</a></div></div></section>`;
}
function locationsBlock() {
  return `<section class="section"><div class="container"><h2 class="section-title">Choose a location.</h2><div class="grid two"><div class="card"><span class="tag">Olive Branch</span><h3>Olive Branch, Mississippi</h3><p>Continue to the current approved external scheduling page for appointment options.</p><a class="btn" href="${esc(booking.locations[0].bookingUrl)}">View Olive Branch Booking</a></div><div class="card"><span class="tag">Southaven</span><h3>Southaven, Mississippi</h3><p>Continue to the current approved external scheduling page for appointment options.</p><a class="btn" href="${esc(booking.locations[1].bookingUrl)}">View Southaven Booking</a></div></div></div></section>`;
}
function resourceCard(item, preview = false) {
  const isWhite = item.meta.type === 'quarterly_white_paper';
  const type = isWhite ? 'Quarterly white paper' : 'Monthly insight';
  const href = preview ? `/previews/resources/${isWhite ? 'white-papers' : 'insights'}/${item.meta.slug}/` : `/resources/${isWhite ? 'white-papers' : 'insights'}/${item.meta.slug}/`;
  return `<article class="card resource-card"><span class="tag">${type}</span><h3>${esc(item.meta.title)}</h3><p>${esc(item.meta.summary || 'Educational resource.')}</p><p><strong>${item.wordCount} words</strong> · ${esc(item.meta.scheduledAt)}</p><p><strong>Status:</strong> ${esc(item.meta.status)}</p><p style="margin-top:auto"><a class="btn secondary" href="${href}">${preview ? 'Preview' : 'Read'}</a></p></article>`;
}
function resourcesPreview(items) {
  const visible = items.filter(isPublic);
  const cards = visible.length ? visible.slice(0, 3).map(item => resourceCard(item)).join('') : `<div class="card"><h3>Resources coming soon</h3><p>Monthly insights and quarterly guides are in review. Approved resources will appear here after review and date gating.</p><a class="btn secondary" href="/resources/">Visit Resources</a></div>`;
  return `<section class="section alt"><div class="container"><div class="eyebrow">Resources</div><h2 class="section-title">Monthly insights and quarterly guides.</h2><p class="section-copy">Fresh, useful dental education for patients who want confidence without internet chaos.</p><div class="resource-grid">${cards}</div><p style="margin-top:28px"><a class="btn secondary" href="/resources/">View Resources</a></p></div></section>`;
}
function pageHero(title, copy) { return `<section class="page-hero section"><div class="container"><div class="eyebrow">Dr. Cynthia Brown, DDS</div><h1>${esc(title)}</h1><p>${esc(copy)}</p></div></section>`; }
function articlePage(item, isPreview = false) {
  const isWhite = item.meta.type === 'quarterly_white_paper';
  const statusNote = isPreview ? `<p class="disclaimer"><strong>Preview status:</strong> ${esc(item.meta.status)}. This draft is for review only and is not linked from the public resources archive until approved and date-gated.</p>` : '';
  const quick = item.meta.quickAnswer ? `<section class="quick-answer"><h2>Quick answer</h2><p>${esc(item.meta.quickAnswer)}</p></section>` : '';
  const takeaway = item.meta.usefulTakeaway ? `<aside class="useful-takeaway"><strong>Useful takeaway:</strong> ${esc(item.meta.usefulTakeaway)}</aside>` : '';
  const faqs = Array.isArray(item.meta.faqs) && item.meta.faqs.length ? `<section class="faq-block"><h2>Questions patients often ask</h2>${item.meta.faqs.map(f => `<details><summary>${esc(f.question)}</summary><p>${esc(f.answer)}</p></details>`).join('')}</section>` : '';
  const trace = item.meta.queryClusterId ? `<p class="source-note"><strong>Query cluster:</strong> ${esc(item.meta.queryClusterId)}</p>` : '';
  return layout(`${item.meta.title} | Dr. Cynthia Brown, DDS`, item.meta.summary || 'Dental education resource.', `<main class="article"><div class="container article-inner"><span class="tag">${isWhite ? 'Quarterly white paper' : 'Monthly insight'}</span><h1>${esc(item.meta.title)}</h1><p><strong>Scheduled:</strong> ${esc(item.meta.scheduledAt)} · <strong>${item.wordCount} words</strong></p>${statusNote}${quick}${takeaway}${trace}${mdToHtml(item.body)}${faqs}</div></main>`, '', { noindex: isPreview });
}

rm(dist); mkdir(dist);
copy(path.join(root, 'assets'), path.join(dist, 'assets'));
copy(path.join(root, '_headers'), path.join(dist, '_headers'));
copy(path.join(root, '_redirects'), path.join(dist, '_redirects'));

const insights = fs.readdirSync(path.join(root, 'content/insights')).filter(f => f.endsWith('.md')).map(f => parseMd(path.join(root, 'content/insights', f)));
const whites = fs.readdirSync(path.join(root, 'content/white-papers')).filter(f => f.endsWith('.md')).map(f => parseMd(path.join(root, 'content/white-papers', f)));
const all = [...insights, ...whites].sort((a, b) => a.meta.scheduledAt.localeCompare(b.meta.scheduledAt));
const publicItems = all.filter(isPublic);

writePage('', layout('Dr. Cynthia Brown, DDS | Olive Branch and Southaven Dentist', 'Personal professional website for Dr. Cynthia Brown, DDS.', hero() + cards() + manifestoBand() + portraitBand() + locationsBlock() + resourcesPreview(all), '', { preloadHero: true }));
writePage('about', layout('About Dr. Cynthia Brown, DDS', 'Education and personal professional background for Dr. Cynthia Brown, DDS.', pageHero('About Dr. Brown', 'A warm, polished dental professional serving patients in Olive Branch and Southaven.') + `<section class="section"><div class="container split"><div><h2 class="section-title">Education and care philosophy.</h2><p class="section-copy">Dr. Cynthia Brown studied at Spelman College, Class of 2003, and Meharry Medical College School of Dentistry, Class of 2014. Her professional presence blends clinical care, patient respect, smile confidence, and clear communication.</p><div class="script">care with clarity</div></div><div class="editorial-img">${img('cynthia-brown-dds-blush-professional-portrait','Professional blush portrait of Dr. Cynthia Brown')}</div></div></section>`));
writePage('locations', layout('Locations | Dr. Cynthia Brown, DDS', 'Book care in Olive Branch or Southaven, Mississippi.', pageHero('Locations', 'Dr. Brown serves patients in Olive Branch and Southaven, Mississippi.') + locationsBlock()));
writePage('services', layout('Services | Dr. Cynthia Brown, DDS', 'Educational overview of dental care topics and services.', pageHero('Services', 'A clear overview of common dental care conversations: prevention, restoration, cosmetics, emergencies, dentures, implants, and whitening.') + `<section class="section"><div class="container"><p class="disclaimer">Treatment recommendations require an in-person exam and clinical judgment by a licensed dental professional. This page is educational only.</p><div class="grid three">${['Preventive care','Restorative care','Cosmetic dentistry','Emergency dental care','Dentures and implants','Whitening questions'].map(t => `<div class="card"><h3>${t}</h3><p>Use this site to prepare better questions before an appointment. Treatment recommendations require an exam by a licensed dental professional.</p></div>`).join('')}</div></div></section>`));
writePage('smile-philosophy', layout('Smile Philosophy | Dr. Cynthia Brown, DDS', 'Confidence-centered dental education and patient philosophy.', pageHero('Smile Philosophy', 'A confident smile is not only about appearance. It is about health, clarity, comfort, and feeling informed.') + `<section class="section"><div class="container split"><div class="editorial-img">${img('cynthia-brown-dds-navy-lifestyle-portrait','Lifestyle professional portrait of Dr. Cynthia Brown')}</div><div><h2 class="section-title">The internet is loud. Your care should be clear.</h2><p class="section-copy">This philosophy keeps the focus on informed decisions, realistic expectations, and the health underneath every smile goal.</p><div class="script">informed confidence</div></div></div></section>`));
writePage('book', layout('Book a Visit | Dr. Cynthia Brown, DDS', 'Choose Olive Branch or Southaven to book a visit.', pageHero('Book a Visit', 'Choose a location and continue to the approved external booking page.') + locationsBlock() + `<section class="section"><div class="container"><p class="disclaimer">Appointments, insurance, pricing, and treatment availability are handled through the linked practice booking pages. Do not submit private health information through this website. Dental pain, swelling, trauma, fever, or signs of infection may require urgent evaluation. Use the linked scheduling page or contact the office directly for urgent concerns.</p></div></section>`));
writePage('privacy', layout('Privacy | Dr. Cynthia Brown, DDS', 'Privacy policy for this static website.', pageHero('Privacy', 'This static website does not collect patient health information.') + `<section class="section"><div class="container"><p class="section-copy">This site does not provide patient intake, diagnosis, treatment planning, or emergency response. It may use standard static hosting logs provided by the hosting platform. Do not send private health information through this site.</p></div></section>`));
writePage('disclaimer', layout('Disclaimer | Dr. Cynthia Brown, DDS', 'Educational disclaimer for dental content.', pageHero('Disclaimer', 'Educational information only.') + `<section class="section"><div class="container"><p class="disclaimer">This website is for general educational purposes only and is not dental or medical advice. It does not diagnose conditions, recommend a specific treatment, or replace an examination by a licensed dental professional. If you have pain, swelling, trauma, infection symptoms, or urgent concerns, contact a dental professional or seek appropriate care.</p></div></section>`));
writePage('resources', layout('Resources | Dr. Cynthia Brown, DDS', 'Monthly dental insights and quarterly guides.', pageHero('Resources', 'Monthly insights and quarterly guides for confident, informed dental care.') + `<section class="section"><div class="container"><h2 class="section-title">Monthly insights</h2>${publicItems.filter(i => i.meta.type === 'monthly_insight').length ? `<div class="resource-grid">${publicItems.filter(i => i.meta.type === 'monthly_insight').map(i => resourceCard(i)).join('')}</div>` : `<p class="section-copy">Monthly insights are currently in review. Approved, date-gated resources will appear here.</p>`}<h2 class="section-title" style="margin-top:70px">Quarterly white papers</h2>${publicItems.filter(i => i.meta.type === 'quarterly_white_paper').length ? `<div class="resource-grid">${publicItems.filter(i => i.meta.type === 'quarterly_white_paper').map(i => resourceCard(i)).join('')}</div>` : `<p class="section-copy">Quarterly white papers are currently in review. Approved, date-gated resources will appear here.</p>`}</div></section>`));

for (const item of all) {
  const isWhite = item.meta.type === 'quarterly_white_paper';
  const folder = isWhite ? 'white-papers' : 'insights';
  writePage(`previews/resources/${folder}/${item.meta.slug}`, articlePage(item, true));
  if (isPublic(item)) writePage(`resources/${folder}/${item.meta.slug}`, articlePage(item, false));
}

const manifest = { generatedAt: new Date().toISOString(), adminSecurityNotice: siteConfig.adminSecurityNotice, items: all.map(item => {
  const isWhite = item.meta.type === 'quarterly_white_paper'; const folder = isWhite ? 'white-papers' : 'insights';
  return { id: item.meta.id, type: item.meta.type, title: item.meta.title, slug: item.meta.slug, status: item.meta.status, scheduledAt: item.meta.scheduledAt, wordCount: item.wordCount, minimumWords: item.meta.minimumWords, validationPassed: item.wordCount >= item.meta.minimumWords, publicPath: isPublic(item) ? `/resources/${folder}/${item.meta.slug}/` : null, previewPath: `/previews/resources/${folder}/${item.meta.slug}/`, githubEditUrl: `${siteConfig.githubEditBase}content/${folder}/${path.basename(item.file)}`, sourceBasis: item.meta.sourceBasis || [], sources: item.meta.sources || [], disclaimerRequired: !!item.meta.disclaimerRequired };
}) };
mkdir(path.join(root, 'data/admin')); fs.writeFileSync(path.join(root, 'data/admin/content_manifest.json'), JSON.stringify(manifest, null, 2));
mkdir(path.join(dist, 'data/admin')); fs.writeFileSync(path.join(dist, 'data/admin/content_manifest.json'), JSON.stringify(manifest, null, 2));

const admin = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Admin | Dr. Cynthia Brown DDS</title><meta name="robots" content="noindex, nofollow, noarchive"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Allura&family=Cormorant+Garamond:wght@500;600;700&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet"><link rel="stylesheet" href="/assets/css/styles.css"></head><body class="admin-shell"><div id="loginShell" class="admin-login"><h1 class="section-title">Content Admin</h1><p>Soft-protected static review dashboard. No patient data belongs here.</p><form id="adminLogin"><label>Password<input id="password" type="password" autocomplete="current-password"></label><p id="error" style="color:#b00020;font-weight:800"></p><button class="btn" type="submit">Enter Admin</button></form></div><main id="adminPanel" class="admin-panel" hidden><h1 class="section-title">Resource Approval Dashboard</h1><p class="section-copy">Preview upcoming monthly insights and quarterly white papers. Use GitHub edit links to revise wording or change status. This dashboard is soft-gated only; never place patient data or secrets here.</p><div id="summary"></div><div id="queryIntelligence"></div><div class="admin-tools"><label>Status filter <select id="statusFilter"><option value="all">All</option><option value="ready_for_approval">Ready for approval</option><option value="approved">Approved</option><option value="published">Published</option><option value="needs_revision">Needs revision</option></select></label></div><table><thead><tr><th>Title</th><th>Type</th><th>Status</th><th>Scheduled</th><th>Words</th><th>Validation</th><th>Preview</th><th>GitHub</th></tr></thead><tbody id="contentRows"></tbody></table><section class="card editorial-checklist"><h2>Approval checklist</h2><ul><li>Clinically safe and educational only.</li><li>Sounds like Dr. Brown.</li><li>No unsupported treatment claims, cost promises, or guarantees.</li><li>Culturally relevant without being reductive.</li><li>Useful enough for a real patient to read.</li></ul></section></main><script src="/assets/js/admin.js" defer></script></body></html>`;
writePage('admin', admin);

const urls = ['/', '/about/', '/locations/', '/services/', '/smile-philosophy/', '/resources/', '/book/', '/privacy/', '/disclaimer/', ...publicItems.map(item => `/resources/${item.meta.type === 'quarterly_white_paper' ? 'white-papers' : 'insights'}/${item.meta.slug}/`)];
fs.writeFileSync(path.join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(u => `<url><loc>${SITE_URL}${u}</loc></url>`).join('')}</urlset>`);
fs.writeFileSync(path.join(dist, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /previews/\nSitemap: ${SITE_URL}/sitemap.xml\n`);
console.log(`Built ${urls.length} public pages, ${all.length} previews, plus admin dashboard.`);

require('./post_build_aeo_geo');
