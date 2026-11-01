// Dental claims gate. Resources (content/*.md) and every public question page
// (questions/<slug>/index.html, published by seq23/search-loop) are checked.
const fs = require('fs');
const path = require('path');
const { root, fail, allContent } = require('./validator_utils');
const errs = [];
// Claims banned everywhere (owner ruling 1 Nov 2026: no "best/top dentist", no guaranteed
// results, no pain-free promises, no before/after promises).
const claims = [/\bguarantee(d|s)?\b/i, /\b(best|top|#1|number one)\s+(rated\s+)?(dentists?|dental (office|practice|care))\b/i, /\bpain[- ]?free\b/i, /\bpainless\b/i, /before[- ]and[- ]after (results|photos|transformation)/i, /\b(will|guaranteed to) (look|transform|fix|whiten)\b/i, /\brisk[- ]free\b/i, /\bno risk\b/i, /\bpermanent (solution|results)\b/i, /\bdiagnose online\b/i, /Aspen Dental/];
// Extra wording banned in the long-form resources (unchanged from the original list).
const resourceOnly = [/\bcure\b/i, /always\s+(works|safe|cures|prevents)/i, /never\s+(need|fail|hurt)/i, /safe for everyone/i, /will fix/i, /you need (veneers|whitening|bonding|aligners|implants|dentures)/i, /you should get (veneers|whitening|bonding|aligners|implants|dentures)/i, /costs? exactly/i, /everyone should/i];
const visible = (html) => html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<head[\s\S]*?<\/head>/i, ' ').replace(/<[^>]+>/g, ' ');
const items = allContent();
for (const item of items) {
  const text = item.body;
  if (!/not dental or medical advice/i.test(text)) errs.push(`${item.file} missing educational disclaimer`);
  if (!/licensed dental professional/i.test(text)) errs.push(`${item.file} must defer treatment recommendations to a licensed dental professional`);
  for (const rx of [...claims, ...resourceOnly]) if (rx.test(text)) errs.push(`${item.file} has forbidden or risky claim: ${rx}`);
}
let pages = 0;
const qdir = path.join(root, 'questions');
if (fs.existsSync(qdir)) for (const slug of fs.readdirSync(qdir)) {
  const f = path.join(qdir, slug, 'index.html');
  if (!fs.existsSync(f)) continue;
  pages++;
  const text = visible(fs.readFileSync(f, 'utf8'));
  for (const rx of claims) { const m = text.match(rx); if (m) errs.push(`questions/${slug}/ has a forbidden claim "${m[0]}" (${rx})`); }
  if (!/href="\/book\/"/.test(fs.readFileSync(f, 'utf8'))) errs.push(`questions/${slug}/ does not end in the booking action`);
}
if (!items.length) errs.push('NAMED STOP [NOTHING_CHECKED] no resources found to check');
if (!errs.length) console.log(`checked ${items.length} resources and ${pages} question pages`);
fail(errs);
