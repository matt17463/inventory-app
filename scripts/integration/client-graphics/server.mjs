import {mock} from 'node:test';
import {createServer} from '../../../node_modules/vite/dist/node/index.js';
import react from '../../../node_modules/@vitejs/plugin-react/dist/index.js';
import {fixture,root,job,selection,asRole} from './fixture.mjs';
import {adapter} from './adapter.mjs';
const db=await fixture(),api=adapter(db);
await job(db,90,{woo:false});await job(db,91);await selection(db,91);
await db.exec("update mockup_artwork_assets set storage_bucket='fictional-bucket'");
mock.module('../../../netlify/functions/_shared/security.js',{namedExports:{authorizeEmployee:async(_event,options)=>({ok:options.allowedRoles.includes('manager'),role:'manager',supabase:api}),jsonResponse:(statusCode,data)=>({statusCode,body:JSON.stringify(data)})}});
const handlers={};for(const name of ['client-graphics','order-graphic-selection','traveler-graphic-selections'])handlers[name]=(await import('../../../netlify/functions/'+name+'.js')).handler;
const server=await createServer({configFile:false,root,plugins:[{name:'isolated-auth-client',enforce:'pre',resolveId(id){if(/(?:^|\/)supabaseClient(?:\.js)?$/.test(id))return root+'scripts/integration/client-graphics/frontend-client.js'}},react()],server:{host:'127.0.0.1',port:4175,strictPort:true},appType:'custom'});
server.middlewares.use(async(req,res,next)=>{
 const url=new URL(req.url,'http://127.0.0.1:4175');
 try{
 if(url.pathname==='/fixture-art.svg'){res.setHeader('Content-Type','image/svg+xml');res.end('<svg xmlns="http://www.w3.org/2000/svg" width="240" height="180"><rect width="240" height="180" fill="#174a74"/><text x="35" y="95" fill="white">FICTIONAL SCHOOL</text></svg>');return}
 if(url.pathname.startsWith('/fixture/')||url.pathname.startsWith('/.netlify/functions/')){
  let body='';for await(const chunk of req)body+=chunk;
  let result;
  if(url.pathname==='/fixture/query'){const input=JSON.parse(body);let q=api.from(input.table);for(const [name,args]of input.calls)q=q[name](...args);result=input.single?await q[input.single]():await q}
  else if(url.pathname==='/fixture/rpc'){const {name,args}=JSON.parse(body);try{const out=await asRole(db,'manager',()=>db.query('select '+name+'($1,$2,$3) as id',[args.p_job_id,args.p_job_item_ids,args.p_recipe_version_id]));result={data:out.rows[0].id,error:null}}catch(e){result={data:null,error:{message:e.message,code:e.code}}}}
  else{const fn=handlers[url.pathname.split('/').pop()];if(!fn){res.statusCode=404;res.end();return}const r=await fn({httpMethod:req.method,queryStringParameters:Object.fromEntries(url.searchParams),body,headers:{}});res.statusCode=r.statusCode;res.setHeader('Content-Type','application/json');res.end(r.body);return}
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));return;
 }
 if(req.headers.accept?.includes('text/html')){res.setHeader('Content-Type','text/html');res.end(await server.transformIndexHtml(req.url,'<!doctype html><html><head><title>Isolated Client Graphics Verification</title><style>body{font-family:Arial;margin:0;color:#172b3a}main{padding:24px}label{display:block;margin:12px 0}input,select,button{padding:8px;margin:4px}section{border:1px solid #ccc;padding:16px;margin:16px 0}</style></head><body><div id="root"></div><script>window.confirm=()=>true</script><script type="module" src="/scripts/integration/client-graphics/ui.jsx"></script></body></html>'));return}
 next();
 }catch(e){res.statusCode=500;res.end(JSON.stringify({error:e.message}));console.error(e)}
});await server.listen();console.log('Isolated fixture ready at http://127.0.0.1:4175/client-graphics; no production connection.');
