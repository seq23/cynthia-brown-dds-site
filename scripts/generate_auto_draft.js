const fs=require('fs');const path=require('path');const root=path.resolve(__dirname,'..');
const policy=JSON.parse(fs.readFileSync(path.join(root,'data/system/automation_policy.json'),'utf8'));
if(policy.autoPublish) throw new Error('autoPublish is forbidden for dental resources.');
if(process.env.ENABLE_AUTO_DRAFTS!=='true'){console.log('Auto drafts disabled. Set ENABLE_AUTO_DRAFTS=true after provider approval.');process.exit(0);}
if(!process.env.LLM_API_KEY){console.log('No LLM_API_KEY configured. Auto-drafting skipped safely.');process.exit(0);}
console.log('Provider key detected, but default adapter intentionally does not call external models. Connect an approved provider adapter in a reviewed change.');
