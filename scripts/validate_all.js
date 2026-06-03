const {spawnSync}=require('child_process');
const scripts=[
  'validate_site_config.js',
  'validate_resource_word_counts.js',
  'validate_dental_compliance.js',
  'validate_admin_manifest.js',
  'validate_approval_gate.js',
  'validate_booking_links.js',
  'validate_no_phi_forms.js',
  'validate_admin_protection.js',
  'validate_sitemap.js',
  'validate_query_traceability.js',
  'validate_accessibility_static.js',
  'validate_mobile_performance_contract.js',
  'validate_resource_sources.js',
  'validate_seo_contract.js',
  'validate_schema_contract.js',
  'validate_aeo_contract.js',
  'validate_geo_contract.js',
  'validate_ingestion_contract.js',
  'validate_auto_draft_contract.js'
];
let failed=false;
for(const s of scripts){
  console.log(`\n--- ${s} ---`);
  const r=spawnSync(process.execPath,[`scripts/${s}`],{stdio:'inherit'});
  if(r.status!==0)failed=true;
}
if(failed){console.error('\nValidation failed.');process.exit(1);}console.log('\nAll validators passed.');
