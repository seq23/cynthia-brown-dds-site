const fs=require('fs');const path=require('path');
const root=path.resolve(__dirname,'..');
function fail(msgs){if(msgs.length){console.error(msgs.map(m=>'FAIL: '+m).join('\n'));process.exit(1);}console.log('PASS');}
function parseMd(file){const txt=fs.readFileSync(file,'utf8');const m=txt.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);if(!m)throw new Error('Invalid frontmatter '+file);return {meta:JSON.parse(m[1]),body:m[2],file,wordCount:m[2].trim().split(/\s+/).filter(Boolean).length};}
function allContent(){const dirs=['content/insights','content/white-papers'];return dirs.flatMap(d=>fs.readdirSync(path.join(root,d)).filter(f=>f.endsWith('.md')).map(f=>parseMd(path.join(root,d,f))));}
module.exports={root,fail,allContent,parseMd};
