const fs=require('fs');const path=require('path');
const root=path.resolve(__dirname,'..');
const clusters=JSON.parse(fs.readFileSync(path.join(root,'data/intake/query_clusters.json'),'utf8'));
fs.writeFileSync(path.join(root,'data/intake/query_clusters.generated.json'),JSON.stringify({...clusters,generatedAt:new Date().toISOString()},null,2));
console.log(`Prepared ${clusters.clusters.length} editorial clusters.`);
