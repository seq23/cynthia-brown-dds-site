const fs=require('fs');const path=require('path');
const root=path.resolve(__dirname,'..');
const sources=JSON.parse(fs.readFileSync(path.join(root,'data/intake/sources.json'),'utf8')).sources;
const manual=JSON.parse(fs.readFileSync(path.join(root,'data/intake/manual_social_observations.json'),'utf8')).observations||[];
const enabled=sources.filter(s=>s.enabled);
const signals=[...manual.map(o=>({...o, ingestedAt:new Date().toISOString(), rawPostStored:false, containsPersonalData:false}))];
fs.writeFileSync(path.join(root,'data/intake/raw_signals.json'), JSON.stringify({generatedAt:new Date().toISOString(), enabledSources:enabled.map(s=>s.id), signals}, null, 2));
console.log(`Ingested ${signals.length} safe query signals from ${enabled.length} enabled source(s). API sources stay disabled until secrets and approval exist.`);
