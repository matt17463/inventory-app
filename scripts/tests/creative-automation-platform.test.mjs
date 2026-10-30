import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {allowlistedPdfKey,splitManualText,normalizedPageText} from '../../netlify/functions/_shared/knowledgeManuals.js';

const src=(p)=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
test('public design route runs outside employee auth shell and uses existing protected intake',()=>{
 const app=src('src/App.jsx'),client=src('src/PublicDesignConfigurator.jsx');
 assert.match(app,/path="\/design" element=\{publicPage\(<PublicDesignConfigurator \/>\)\}/);
 assert.match(client,/\.netlify\/functions\/client-order-submit/);
 assert.match(client,/customer_confirmation:\{approved:true\}/);
 assert.match(client,/NOT AN APPROVED PRODUCTION PROOF/);
 assert.doesNotMatch(client,/service_role|SUPABASE_SERVICE_ROLE_KEY/);
});
test('public design has real inline limits, review gate and no pricing trust',()=>{
 const s=src('src/PublicDesignConfigurator.jsx');
 assert.match(s,/MAX_ART_BYTES=3\*1024\*1024/);
 assert.match(s,/min="1" max="250"/);
 assert.match(s,/form\.confirmed/);
 assert.match(s,/quote request/i);
 assert.doesNotMatch(s,/\.from\(['"]sc_client_order_requests/);
});
test('PDF keys are restricted to the staff manual namespace',()=>{
 assert(allowlistedPdfKey('knowledge/manuals/fixture.pdf'));
 assert(!allowlistedPdfKey('operational/client-orders/secret.pdf'));
 assert(!allowlistedPdfKey('knowledge/manuals/../secret.pdf'));
 assert(!allowlistedPdfKey('https://evil.site/manual.pdf'));
 assert(!allowlistedPdfKey('knowledge/manuals/bad.svg'));
});
test('PDF text normalization and splitting produce bounded citable excerpts',()=>{
 const text=normalizedPageText({cells:[{str:'laser  '},{str:'  power'}, {str:' settings'}]});
 assert.equal(text,'laser power settings');
 const chunks=splitManualText('material '.repeat(2000));
 assert(chunks.length>2&&chunks.every(x=>x.length<=2300));
 assert.deepEqual(splitManualText(''),[]);
});
test('manuals use RLS-only reads and server-restricted writes',()=>{
 const sql=src('supabase/migrations/20261029222500_sc_knowledge_sources_chunks.sql');
 for(const term of ['alter table public.sc_knowledge_sources enable row level security','alter table public.sc_knowledge_chunks enable row level security','revoke all on public.sc_knowledge_sources from anon, authenticated','sc_internal_access_allowed'])assert(sql.includes(term));
 assert.match(sql,/grant select on public.sc_knowledge_sources,public.sc_knowledge_chunks to authenticated/);
 const func=src('netlify/functions/knowledge-manual-admin.js');
 assert.match(func,/authorizeEmployee/);assert.match(func,/allowedRoles:\['admin','manager'\]/);
});
test('local gateway only permits approved staff and loopback inference',()=>{
 const s=src('scripts/local-knowledge-agent.mjs');
 assert.match(s,/auth\.getUser\(jwt\)/);
 assert.match(s,/from\('sc_app_user_roles'\)/);
 assert.match(s,/localhost','127\.0\.0\.1'/);
 assert.match(s,/origin!==ORIGIN/);
 assert.match(s,/\[M1\]|source excerpts/i);
 assert.doesNotMatch(s,/api\.openai\.com|generativelanguage\.googleapis\.com/);
});
test('manuals have automatic indexing and no public raw PDF path',()=>{
 const s=src('netlify/functions/knowledge-manual-sync.mjs');
 assert.match(s,/schedule:'0 \* \* \* \*'/);
 assert.match(s,/scanManualPrefix/);
 assert.match(src('netlify.toml'),/knowledge-manual-sync/);
});
