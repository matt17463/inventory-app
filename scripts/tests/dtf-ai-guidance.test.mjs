import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {prepareSourceMask,sourcePoint,validateGuidance} from '../../src/lib/dtfMaskGuidance.js';
import {DTF_DEFAULTS,processDtfPixels} from '../../src/lib/dtfStudioEngine.js';
import {createHandler,generateImageGuidance,imageUsageGuard} from '../../netlify/functions/dtf-ai-guidance.js';
const options={...DTF_DEFAULTS,background:'none',regionPoints:[],maskStrokes:[],removalTolerance:0,backgroundFeather:0};
function logo(){const data=new Uint8ClampedArray(9*9*4);for(let i=0;i<81;i++)data.set([255,255,255,255],i*4);for(let y=2;y<7;y++)for(let x=2;x<7;x++)data.set([120,50,10,255],(y*9+x)*4);data.set([255,255,255,255],(3*9+3)*4);data.set([255,255,255,255],(5*9+5)*4);return data;}
const a=(d,x,y)=>d[(y*9+x)*4+3];
test('accumulated exterior and independent holes preserve white detail, source bytes and color',()=>{
 const source=logo(),before=new Uint8ClampedArray(source);
 const {data,report}=prepareSourceMask(source,9,9,{...options,regionPoints:[{kind:'remove',x:0,y:0},{kind:'remove',x:3,y:3}]});
 assert.equal(a(data,0,0),0);assert.equal(a(data,3,3),0);assert.equal(a(data,5,5),255);assert.equal(a(data,4,4),255);
 assert.equal(report.removed,57);assert.deepEqual(source,before);assert.deepEqual(Array.from(data.slice((4*9+4)*4,(4*9+4)*4+4)),[120,50,10,255]);
});
test('keep guidance restores intentional white after global knockout; repeated picks do not double count',()=>{
 const {data,report}=prepareSourceMask(logo(),9,9,{...options,removeInteriorWhite:true,regionPoints:[{kind:'remove',x:0,y:0},{kind:'remove',x:0,y:0},{kind:'keep',x:3,y:3}]});
 assert.equal(a(data,3,3),255);assert.equal(a(data,5,5),0);assert.equal(report.removed,57);
});
test('AI guidance resolves source-size regions with protected art; malformed and out-of-range coordinates rejected',()=>{
 const g={confidence:.6,points:[{kind:'remove',x:0,y:0},{kind:'remove',x:3/9,y:3/9},{kind:'keep',x:5/9,y:5/9}]};
 const {data,report}=prepareSourceMask(logo(),9,9,{...options,background:'ai',aiGuidance:g});
 assert.equal(a(data,3,3),0);assert.equal(a(data,5,5),255);assert.equal(report.reviewRequired,true);
 for(const bad of [{points:[]},{confidence:1,points:[{kind:'remove',x:2,y:0}]},{confidence:1,points:[{kind:'keep',x:0,y:0}]}])assert.throws(()=>validateGuidance(bad));
 assert.throws(()=>prepareSourceMask(logo(),9,9,{...options,background:'ai'}),/malformed/);
});
test('all-transparent mask fails closed and a transparent source is unchanged',()=>{
 const source=logo();assert.throws(()=>prepareSourceMask(source,9,9,{...options,regionPoints:[{kind:'remove',x:0,y:0},{kind:'remove',x:3,y:3},{kind:'remove',x:5,y:5},{kind:'remove',x:4,y:4}]}),/all artwork/);
 source[3]=0;source[7]=128;assert.deepEqual(prepareSourceMask(source,9,9,options).data,source);
});
test('letterboxing, zoom, responsive positions and padding reject out-of-image clicks',()=>{
 assert.deepEqual(sourcePoint({left:10,top:20,width:400,height:400},400,200,210,220),{x:200,y:100});
 assert.equal(sourcePoint({left:10,top:20,width:400,height:400},400,200,210,50),null);
 assert.deepEqual(sourcePoint({left:-100,top:-80,width:800,height:800},400,200,300,320),{x:200,y:100});
 assert.deepEqual(sourcePoint({left:0,top:0,width:200,height:500},400,200,50,250),{x:100,y:100});
 assert.equal(sourcePoint({left:0,top:0,width:0,height:0},400,200,0,0),null);
});
test('hard alpha remains optional while soft alpha is retained when requested',()=>{
 const d=new Uint8ClampedArray([15,40,70,128]);processDtfPixels(d,1,1,{...options,alphaMode:'preserve'},300);assert.equal(d[3],128);
 processDtfPixels(d,1,1,{...options,alphaMode:'hard'},300);assert.equal(d[3],255);
});
const env={GEMINI_API_KEY:'server-test-secret',GEMINI_IMAGE_MODEL:'gemini-2.5-flash',DTF_GEMINI_ENABLED:'true'};
const auth={ok:true,user:{id:'employee'},role:'operator',supabase:{}};
const points={confidence:.9,points:[{kind:'remove',x:0,y:0},{kind:'keep',x:.5,y:.5}]};
const png=await sharp({create:{width:20,height:20,channels:4,background:'#fff'}}).png().toBuffer();
const event={httpMethod:'POST',body:JSON.stringify({mimeType:'image/png',image:png.toString('base64')})};
const make=(overrides={})=>createHandler({authorize:async()=>auth,audit:async()=>{},guard:async()=>{},generate:async()=>points,env,...overrides});
test('authenticated image endpoint returns bounded guidance and provenance, no secrets or source bytes',async()=>{
 const audits=[];let called=false;
 const res=await make({audit:async r=>audits.push(r),generate:async(bytes,mime,config)=>{called=true;assert.equal(mime,'image/png');assert.equal(config.key,env.GEMINI_API_KEY);assert.ok(bytes.length);return points;}})(event);
 assert.equal(res.statusCode,200);assert.equal(res.headers['Cache-Control'],'no-store');assert.ok(called);
 const body=JSON.parse(res.body);assert.equal(body.provenance.provider,'gemini');assert.equal(body.reviewRequired,true);
 assert.ok(!JSON.stringify([res,audits]).includes(env.GEMINI_API_KEY));assert.ok(!JSON.stringify(audits).includes(png.toString('base64')));
});
test('endpoint rejects anonymous and forbidden roles before any provider calls',async()=>{
 for(const statusCode of [401,403]){let called=false;const res=await make({authorize:async()=>({ok:false,statusCode,message:'Denied'}),generate:async()=>{called=true;}})(event);assert.equal(res.statusCode,statusCode);assert.equal(called,false);}
});
test('endpoint validates method, configuration, MIME, size, dimensions and encoded image bytes',async()=>{
 assert.equal((await make()({...event,httpMethod:'GET'})).statusCode,405);
 assert.equal((await make({env:{}})(event)).statusCode,503);
 for(const body of ['{',JSON.stringify({mimeType:'image/svg+xml',image:'AAAA'}),JSON.stringify({mimeType:'image/png',image:'bad'}),JSON.stringify({mimeType:'image/jpeg',image:png.toString('base64')})])assert.equal((await make()({...event,body})).statusCode,400);
 assert.equal((await make()({...event,body:'x'.repeat(1500001)})).statusCode,413);
 const large=await sharp({create:{width:1025,height:1,channels:3,background:'#fff'}}).png().toBuffer();
 assert.equal((await make()({...event,body:JSON.stringify({mimeType:'image/png',image:large.toString('base64')})})).statusCode,400);
});
test('endpoint handles quota, rate failure, timeouts and untrusted provider errors without leakage',async()=>{
 for(const [error,status] of [[Object.assign(Error('quota'),{statusCode:429}),429],[Object.assign(Error('timeout'),{name:'TimeoutError'}),504],[Error('secret-response '+env.GEMINI_API_KEY),502]]){
 const res=await make({generate:async()=>{throw error;}})(event);assert.equal(res.statusCode,status);assert.ok(!res.body.includes(env.GEMINI_API_KEY));}
 assert.equal((await make({guard:async()=>{throw Object.assign(Error('limited'),{statusCode:429});}})(event)).statusCode,429);
});
function mockProvider(value,finish='STOP'){return async()=>new Response(JSON.stringify({candidates:[{finishReason:finish,content:{parts:[{text:JSON.stringify(value)}]}}]}));}
test('Gemini parser accepts JSON guidance and rejects invalid output, unsupported model and incomplete answer',async()=>{
 const config={key:'test',model:'gemini-2.5-flash',fetcher:mockProvider(points)};
 assert.deepEqual((await generateImageGuidance(png,'image/png',config)).points,points.points);
 await assert.rejects(()=>generateImageGuidance(png,'image/png',{...config,model:'paid-unapproved'}),/unavailable/);
 for(const fetcher of [mockProvider({mask:'invented'}),mockProvider(points,'MAX_TOKENS'),async()=>new Response('bad')])await assert.rejects(()=>generateImageGuidance(png,'image/png',{...config,fetcher}));
 for(const status of [404,429,500])await assert.rejects(()=>generateImageGuidance(png,'image/png',{...config,fetcher:async()=>new Response('do not leak',{status})}),/Gemini/);
});
test('hourly usage guard fails closed and enforces employee and global caps',async()=>{
 const dbFor=(count,error=null)=>({from:()=>{const q={insert:async()=>({error}),select:()=>q,eq:()=>q,gte:()=>q,then:r=>Promise.resolve({count,error}).then(r)};return q;}});
 await imageUsageGuard(dbFor(1),'user');await assert.rejects(()=>imageUsageGuard(dbFor(61),'user'),/quota/);await assert.rejects(()=>imageUsageGuard(dbFor(null,'offline'),'user'),/unavailable/);
});

test('hosted production gate verifies model access before a real image call; local/CI never call provider',async()=>{
 const {verifyDtfGeminiLive}=await import('../verify-dtf-gemini-live.mjs');let calls=0;
 const fetcher=async()=>{calls++;return new Response(JSON.stringify({name:'models/gemini-2.5-flash',supportedGenerationMethods:['generateContent']}));};
 assert.deepEqual(await verifyDtfGeminiLive({env,fetcher}),{skipped:true});assert.equal(calls,0);
 const hosted={...env,NETLIFY:'true',CONTEXT:'production'};
 const result=await verifyDtfGeminiLive({env:hosted,fetcher,generate:async()=>points});assert.equal(calls,1);assert.equal(result.foregroundPreserved,true);
 await assert.rejects(()=>verifyDtfGeminiLive({env:hosted,fetcher:async()=>new Response('',{status:403}),generate:async()=>{throw Error('must not call');}}),/model access failed/);
 await assert.rejects(()=>verifyDtfGeminiLive({env:hosted,fetcher,generate:async()=>({confidence:1,points:[{kind:'remove',x:.5,y:.5}]})}),/foreground/);
});
test('dark exterior removal protects isolated black lines and intentional white lettering',()=>{
 const source=logo();for(let i=0;i<source.length;i+=4)if(source[i]===255)source.set([8,8,8,255],i);
 source.set([255,255,255,255],(4*9+4)*4);source.set([0,0,0,255],(2*9+4)*4);
 const {data}=prepareSourceMask(source,9,9,{...options,background:'auto'});
 assert.equal(a(data,0,0),0);assert.equal(a(data,4,4),255);assert.equal(a(data,4,2),255);
});
test('detailed-image requests use bounded JSON guidance without optional provider-specific fields',async()=>{
 let request;
 await generateImageGuidance(png,'image/png',{key:'test',model:'gemini-3.5-flash-lite',fetcher:async(_url,options)=>{request=JSON.parse(options.body);return mockProvider(points)();}});
 assert.equal(request.generationConfig.responseMimeType,'application/json');
 assert.ok(!request.generationConfig.responseJsonSchema);
 assert.equal(request.generationConfig.maxOutputTokens,1800);
 assert.ok(!request.generationConfig.thinkingConfig);
 const tooMany={confidence:.9,points:Array.from({length:25},()=>points.points[0])};
 await assert.rejects(()=>generateImageGuidance(png,'image/png',{key:'test',model:'gemini-3.5-flash-lite',fetcher:mockProvider(tooMany)}),/too many/);
 assert.ok(!request.tools);assert.ok(!JSON.stringify(request).includes('tavily'));
});
test('large accepted thumbnails are reduced to 384 pixels before reaching Gemini',async()=>{
 const large=await sharp({create:{width:768,height:768,channels:4,background:'#fff'}}).png().toBuffer();let dimensions;
 const res=await make({generate:async bytes=>{const m=await sharp(bytes).metadata();dimensions=[m.width,m.height];return points;}})({...event,body:JSON.stringify({mimeType:'image/png',image:large.toString('base64')})});
 assert.equal(res.statusCode,200);assert.deepEqual(dimensions,[384,384]);
});
