// Runs every validator in the one registry, data/system/validators.json.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '..');
const { validators } = JSON.parse(fs.readFileSync(path.join(root, 'data/system/validators.json'), 'utf8'));
if (!Array.isArray(validators) || !validators.length) { console.error('NAMED STOP [NO_VALIDATORS] data/system/validators.json lists no validators'); process.exit(1); }
let failed = false;
for (const { name } of validators) {
  const file = path.join(root, 'scripts', name);
  if (!fs.existsSync(file)) { console.error(`FAIL: registered validator ${name} does not exist`); failed = true; continue; }
  console.log(`\n--- ${name} ---`);
  const r = spawnSync(process.execPath, [file], { stdio: 'inherit', cwd: root });
  if (r.status !== 0) failed = true;
}
if (failed) { console.error('\nValidation failed.'); process.exit(1); }
console.log(`\nAll ${validators.length} validators passed.`);
