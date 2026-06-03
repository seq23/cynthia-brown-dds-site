const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '..');
const today = new Date(process.env.BUILD_DATE || new Date().toISOString().slice(0, 10));
function parse(file){const txt=fs.readFileSync(file,'utf8');const m=txt.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);if(!m)throw new Error(`Invalid frontmatter ${file}`);return {meta:JSON.parse(m[1]),body:m[2]};}
function write(file,meta,body){fs.writeFileSync(file,`---\n${JSON.stringify(meta,null,2)}\n---\n${body}`);}
let changed=0;
for(const dir of ['content/insights','content/white-papers']){
  for(const name of fs.readdirSync(path.join(root,dir)).filter(f=>f.endsWith('.md'))){
    const file=path.join(root,dir,name);const {meta,body}=parse(file);const due=new Date(meta.scheduledAt)<=today;
    if(meta.status==='approved' && due){meta.status='published';meta.publishedAt=new Date().toISOString().slice(0,10);write(file,meta,body);changed++;}
  }
}
console.log(`Published ${changed} approved due resources.`);
let r=spawnSync(process.execPath,['scripts/build_site.js'],{stdio:'inherit'});if(r.status!==0)process.exit(r.status);
r=spawnSync(process.execPath,['scripts/validate_all.js'],{stdio:'inherit'});process.exit(r.status||0);
