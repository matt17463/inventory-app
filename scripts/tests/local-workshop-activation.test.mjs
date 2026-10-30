import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=(name)=>fs.readFileSync(new URL('../../'+name,import.meta.url),'utf8');
test('workshop gateway does not require service-role key and uses caller-scoped authorization',()=>{
 const s=read('scripts/local-knowledge-agent.mjs');
 assert.doesNotMatch(s,/process\.env\.SUPABASE_SERVICE_ROLE_KEY/);
 assert.match(s,/clientForUser\(jwt\)/);
 assert.match(s,/sc_internal_access_allowed/);
 assert.match(s,/return db; \/\/ All subsequent queries/);
});
test('private setup never permits public tailnet funnel',()=>{
 const s=read('scripts/setup-workshop-ai.sh');
 assert.match(s,/tailscale serve --bg/);
 assert.doesNotMatch(s,/^\s*tailscale funnel/m);
 assert.match(s,/SC_MANUAL_SOURCE_DIR/);
 assert.match(s,/chmod 600/);
});
test('gateway URL must be tailnet HTTPS and staff-controlled',()=>{
 const s=read('src/lib/localAiGateway.js');
 assert.match(s,/\.tail934ae0/);
 assert.match(s,/sc_local_ai_connections/);
 assert.match(s,/updated_by/);
 assert.match(s,/getSession/);
 const sql=read('supabase/migrations/20261029233000_sc_local_ai_connections.sql');
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/REVOKE ALL.*anon/);
 assert.match(sql,/sc_internal_access_allowed/);
});
