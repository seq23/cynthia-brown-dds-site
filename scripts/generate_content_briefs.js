const fs=require('fs');const path=require('path');const root=path.resolve(__dirname,'..');
const clusters=JSON.parse(fs.readFileSync(path.join(root,'data/intake/query_clusters.json'),'utf8')).clusters||[];
const gapsPath=path.join(root,'data/geo/content_gap_matrix.json');
const gaps=fs.existsSync(gapsPath)?JSON.parse(fs.readFileSync(gapsPath,'utf8')).gaps||[]:[];
const briefs=clusters.map(c=>({id:`brief-${c.id}`,queryClusterId:c.id,title:`Patient education brief: ${c.label||c.id}`,status:'brief_candidate',priority:c.priority||'medium',patientIntent:c.patientIntent||'patient education',recommendedContentType:'monthly_insight',mustInclude:['quick answer','useful takeaway','FAQ block','exam boundary','educational disclaimer','source trace'],autoPublish:false,requiresHumanApproval:true,gapStatus:(gaps.find(g=>g.id===c.id)||{}).status||'unknown'}));
fs.writeFileSync(path.join(root,'data/intake/content_brief_candidates.json'), JSON.stringify({generatedAt:new Date().toISOString(), briefs}, null, 2));
console.log(`Generated ${briefs.length} content brief candidates.`);
