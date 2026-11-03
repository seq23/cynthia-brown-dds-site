// The admin dashboard is gated on the server (functions/_middleware.js, validate_admin_gate.js).
// A password check in the browser protects
// nothing and shipping its hash hands the password to every visitor (security sweep, 3 Nov 2026),
// so the served admin JS must carry no password, password hash or secret-like string, and the
// page must stay unindexed.
const fs=require('fs');const path=require('path');const {root,fail}=require('./validator_utils');
const errs=[];
const admin=path.join(root,'dist/admin/index.html');
const js=path.join(root,'dist/assets/js/admin.js');
if(!fs.existsSync(admin))errs.push('Missing admin page');
else{const h=fs.readFileSync(admin,'utf8');
  if(!/noindex/.test(h))errs.push('Admin page lost its noindex');
  if(/type=["']password["']/i.test(h))errs.push('Admin page carries a password field: a client-side gate is not protection');}
if(!fs.existsSync(js))errs.push('Missing admin JS');
else{const s=fs.readFileSync(js,'utf8');
  if(/password/i.test(s))errs.push('Admin JS mentions a password: a client-side gate is not protection');
  if(/\b[0-9a-f]{40,}\b/i.test(s))errs.push('Admin JS carries a hash-like constant (a shipped hash IS the password)');
  if(/crypto\.subtle\.digest/.test(s))errs.push('Admin JS hashes input in the browser: a client-side gate is not protection');
  if(/api[_-]?key|secret|token|service_role/i.test(s))errs.push('Secret-like string found in admin JS');}
fail(errs);
