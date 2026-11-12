import {readFileSync} from "node:fs";
import test from 'node:test';
import assert from 'node:assert/strict';
import {studioLayoutSections,studioExportReadiness,studioPrintHtml,offlineStudioArtwork,inspectStudioPrintDom,STUDIO_CATEGORY_COPY} from '../../src/lib/marketingDesignStudio.js';

const sample='data:image/png;base64,AAAA';
test('validated layout plan reorders only supported modules and preserves each exactly once',()=>{
 assert.deepEqual(studioLayoutSections({sections:['hero','steps','steps','products','<script>','cta']},0),['steps','products','benefits']);
 assert.deepEqual(studioLayoutSections(null,0),['products','benefits','steps']);
});
test('every category has distinct content direction rather than school-only wording',()=>{
 for(const category of ['school','team','business','nonprofit','wedding','general']){
  assert.ok(STUDIO_CATEGORY_COPY[category].benefits);
  const html=studioPrintHtml({category,client:'Test Organization',headline:'Verified headline',benefits:['Good service'],steps:['Confirm proof'],contact:'example.test',productImages:[sample],logo:sample});
  assert.ok(html.includes(STUDIO_CATEGORY_COPY[category].hero.replaceAll('&','&amp;')));
  assert.ok(html.includes(STUDIO_CATEGORY_COPY[category].collection.replaceAll('&','&amp;')));
 }
 const business=studioPrintHtml({category:'business',client:'Example',benefits:['Workwear']});
 assert.ok(!business.includes('WHY SCHOOLS PARTNER WITH US'));
});
test('malformed or missing client images and contact block final export',()=>{
 const good={client:'Client',category:'school',logo:sample,headline:'Approved headline',contact:'verified@example.test',productImages:[sample]};
 assert.equal(studioExportReadiness(good).ready,true);
 for(const changes of [{logo:'https://evil.test/x.png'},{productImages:[]},{contact:''},{client:''},{headline:''},{headline:'x'.repeat(86)},{category:'unknown'}])
  assert.equal(studioExportReadiness({...good,...changes}).ready,false);
});
test('injected copy and logo cannot add executable print markup',()=>{
 const html=studioPrintHtml({client:'<script>bad()</script>',category:'wedding',headline:'<img src=x onerror=bad()>',contact:'<b>no</b>',logo:'javascript:bad()',productImages:['javascript:bad()']});
 assert.ok(!html.includes('<script>bad()'));
 assert.ok(!html.includes('<img src=x onerror=bad()>'));
 assert.ok(html.includes('APPROVED LOGO REQUIRED'));
 assert.ok(html.includes('APPROVED APPAREL PHOTOGRAPHY'));
});
test('layout plan ordering affects printed section order',()=>{
 const html=studioPrintHtml({category:'nonprofit',plan:{sections:['hero','steps','benefits','products','cta']},benefits:['Benefit A'],steps:['Step A'],productImages:[sample],logo:sample});
 assert.ok(html.indexOf('Step A')<html.indexOf('Benefit A'));
 assert.ok(html.indexOf('Benefit A')<html.indexOf('Approved merchandise photo 1'));
});

test('generated visual backdrops are actually inserted into the printed proof',()=>{
 const html=studioPrintHtml({client:'Client',image:sample,logo:sample,productImages:[sample]});
 assert.ok(html.includes('class="hero-scenery"'));
 assert.ok(html.includes('background-image:url(&quot;data:image/png;base64,AAAA&quot;)'));
 assert.ok(!studioPrintHtml({image:'javascript:alert(1)'}).includes('class="hero-scenery"'));
});
test('school and wedding visual motifs are distinct and contain no identity lettering',()=>{
 const school=offlineStudioArtwork({category:'school',concept:1,colors:['#113355']});
 const wedding=offlineStudioArtwork({category:'wedding',concept:1,colors:['#113355']});
 assert.notEqual(school,wedding);
 assert.ok(school.includes('M0 790L170'));
 assert.ok(wedding.includes('M0 850Q130'));
 assert.ok(!school.includes('<text'));
});
test('lengthy copy cannot pass export gate while shorter copy can',()=>{
 const base={client:'Client',category:'business',logo:sample,headline:'Ready',contact:'sales@example.test',productImages:[sample]};
 assert.equal(studioExportReadiness({...base,description:'a'.repeat(281)}).ready,false);
 assert.equal(studioExportReadiness({...base,benefits:['a'.repeat(101)]}).ready,false);
 assert.equal(studioExportReadiness({...base,steps:['a'.repeat(86)]}).ready,false);
 assert.equal(studioExportReadiness({...base,description:'Short approved copy',benefits:['Benefit'],steps:['Step']}).ready,true);
});

test('DOM print preflight catches clipped body and hero headline',()=>{
 const rect=(left,top,right,bottom)=>({left,top,right,bottom});
 const hero={getBoundingClientRect:()=>rect(0,0,816,320)};
 const title={getBoundingClientRect:()=>rect(10,110,820,350)};
 const main={scrollHeight:800,clientHeight:600};
 const page={scrollHeight:1056,clientHeight:1056,querySelector:s=>({main,'.hero':hero,h1:title})[s]||null};
 const issues=inspectStudioPrintDom({querySelector:s=>s==='.page'?page:null});
 assert.match(issues.join(' '),/clipped|Headline/);
 assert.deepEqual(inspectStudioPrintDom({querySelector:()=>null}),['Print page is missing.']);
});

test('studio export and release confirmation gates are connected in the UI',()=>{
 const ui=readFileSync(new URL('../../src/MarketingAIDesignStudio.jsx',import.meta.url),'utf8');
 assert.match(ui,/checkPrintReady\(\)/);
 assert.match(ui,/releaseConfirmed/);
 assert.match(ui,/inspectStudioPrintDom\(popup\.document\)/);
 assert.match(ui,/image:concepts\[i\]/);
 assert.match(ui,/setLockedSections/);
});

test('approved storefront integration uses account-scoped assortment and private mockup validation',()=>{
 const ui=readFileSync(new URL('../../src/MarketingAIDesignStudio.jsx',import.meta.url),'utf8');
 assert.match(ui,/marketing-store-assortment\?account_id=/);
 assert.match(ui,/marketingSharedImageUrl\(accountId,\{source:"mockup_outputs",asset_id:assetId\}\)/);
 assert.match(ui,/findApprovedStoreMockups/);
 assert.match(ui,/importStoreMockup/);
 assert.match(ui,/normalizeStudioLayout/);
 assert.match(ui,/layoutAdjustments/);
});
