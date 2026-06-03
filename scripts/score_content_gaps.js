const fs=require('fs');const path=require('path');const root=path.resolve(__dirname,'..');
const clusters=JSON.parse(fs.readFileSync(path.join(root,'data/intake/query_clusters.json'),'utf8')).clusters||[];
const matrix=JSON.parse(fs.readFileSync(path.join(root,'data/geo/query_matrix.json'),'utf8')).clusters||[];
const gaps=clusters.map(c=>({id:c.id,label:c.label||c.id,priority:c.priority||'medium',mappedResourceCount:matrix.filter(m=>m.cluster===c.id).length,status:matrix.some(m=>m.cluster===c.id)?'covered':'needs_content'}));
fs.writeFileSync(path.join(root,'data/geo/content_gap_matrix.json'), JSON.stringify({generatedAt:new Date().toISOString(), gaps}, null, 2));
console.log(`Scored ${gaps.length} content gap clusters.`);
