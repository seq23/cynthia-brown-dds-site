const fs=require('fs');const path=require('path');const root=path.resolve(__dirname,'..');
const raw=JSON.parse(fs.readFileSync(path.join(root,'data/intake/raw_signals.json'),'utf8')).signals||[];
const signals=raw.map(s=>({id:s.id, source:s.source, normalizedQuery:(s.normalizedQuery||s.observedQuery||'').trim(), topic:s.topic||'dental care', intent:s.intent||'patient education', audience:s.audience||['patients'], dateObserved:s.dateObserved, rawPostStored:false, containsPersonalData:false})).filter(s=>s.normalizedQuery);
fs.writeFileSync(path.join(root,'data/intake/normalized_signals.json'), JSON.stringify({generatedAt:new Date().toISOString(), signals}, null, 2));
console.log(`Normalized ${signals.length} query signals.`);
