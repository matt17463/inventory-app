import {readFileSync} from "node:fs";
import test from 'node:test';
import assert from 'node:assert/strict';
import {studioLayoutSections,studioMoveSectionFirst,studioMergeLockedSections,studioExportReadiness,studioPrintHtml,offlineStudioArtwork,inspectStudioPrintDom,studioRectanglesOverlap,STUDIO_CATEGORY_COPY} from '../../src/lib/marketingDesignStudio.js';

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

test('pale brand colors cannot become low-contrast flyer headline backgrounds',()=>{
 const html=studioPrintHtml({category:'school',colors:['#FFFF00','#123456'],headline:'Headline'});
 assert.ok(html.includes('--primary:#123456')||html.includes('--primary:#233B69'));
 assert.ok(!html.includes('--primary:#FFFF00'));
 assert.ok(html.includes('#FFFF00'));
});

test('collision preflight rejects overlapping approved identity and headline regions',()=>{
 const rect=(left,top,right,bottom)=>({left,top,right,bottom});
 assert.equal(studioRectanglesOverlap(rect(0,0,90,90),rect(45,45,120,120)),true);
 assert.equal(studioRectanglesOverlap(rect(0,0,90,90),rect(92,92,120,120)),false);
 const identity={getBoundingClientRect:()=>rect(20,20,150,130)};
 const heroText={getBoundingClientRect:()=>rect(40,110,400,260)};
 const page={scrollHeight:1056,clientHeight:1056,querySelector:s=>({'.hero .identity':identity,'.hero-text':heroText})[s]||null};
 const issues=inspectStudioPrintDom({querySelector:s=>s==='.page'?page:null});
 assert.match(issues.join(' '),/identity overlaps/);
});
test('collision preflight protects school options against merchandising overlap',()=>{
 const rect=(left,top,right,bottom)=>({left,top,right,bottom});
 const elements={'.gallery':{getBoundingClientRect:()=>rect(30,330,750,620)},'.school-callouts':{getBoundingClientRect:()=>rect(30,600,750,720)}};
 const page={scrollHeight:1056,clientHeight:1056,querySelector:s=>elements[s]||null};
 assert.match(inspectStudioPrintDom({querySelector:s=>s==='.page'?page:null}).join(' '),/Content overlap/);
});

test('verified product captions appear with markup safely escaped',()=>{
 const html=studioPrintHtml({category:'school',logo:sample,productImages:[sample,sample],productLabels:['Spirit hoodie · navy','<img src=x onerror=alert(1)>']});
 assert.match(html,/Spirit hoodie/);
 assert.match(html,/class="product-tag"/);
 assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
 assert.ok(!html.includes('<img src=x onerror=alert(1)>'));
});
test('client draft persists approved-product labels and restores them as editable overlays',()=>{
 const ui=readFileSync(new URL('../../src/MarketingAIDesignStudio.jsx',import.meta.url),'utf8');
 assert.match(ui,/studioVersion:7/);
 assert.match(ui,/productLabels,organization/);
 assert.match(ui,/setProductLabels\(Array\.isArray\(d\.productLabels\)/);
 assert.match(ui,/productLabels,approvedProductImages/);
});

test('school hero reuses the exact approved client logo as a decorative mascot layer',()=>{
 const school=studioPrintHtml({category:'school',client:'Elementary School',logo:sample,productImages:[sample]});
 assert.match(school,/class="school-mascot-hero"/);
 assert.match(school,/class="page campaign athletic school-layout"/);
 assert.ok(school.includes('<img class="school-mascot-hero" src="'+sample+'"'));
 const business=studioPrintHtml({category:'business',client:'Client',logo:sample,productImages:[sample]});
 assert.ok(!business.includes('class="school-mascot-hero"'));
});

test('school hero visually communicates four verified program benefits without school messaging leaking to other audiences',()=>{
 const school=studioPrintHtml({category:'school',client:'Synthetic',headline:'Build school pride'});
 for(const label of ['SCHOOL PRIDE','PROGRAM FUNDING','ONLINE STOREFRONT','LOCAL PARTNERSHIP']){
  assert.ok(school.includes('<strong>'+label+'</strong>'));
 }
 assert.ok(school.includes('class="school-highlights"'));
 assert.ok(!studioPrintHtml({category:'wedding'}).includes('class="school-highlights"'));
});
test('print gate detects school feature ribbon overlapping headline',()=>{
 const rect=(left,top,right,bottom)=>({left,top,right,bottom});
 const elements={
  '.school-highlights':{getBoundingClientRect:()=>rect(40,250,760,310)},
  '.hero-text':{getBoundingClientRect:()=>rect(40,110,720,270)}
 };
 const page={scrollHeight:1056,clientHeight:1056,querySelector:s=>elements[s]||null};
 const failures=inspectStudioPrintDom({querySelector:s=>s==='.page'?page:null});
 assert.match(failures.join(' '),/School program highlights overlap/);
});

test('long school campaign headline uses compact print treatment without affecting business flyers',()=>{
 const heading='SAMPLE DESIGN — NOT CLIENT APPROVED';
 const school=studioPrintHtml({category:'school',headline:heading});
 assert.match(school,/class="page campaign athletic school-layout long-headline"/);
 const shorter=studioPrintHtml({category:'school',headline:'SCHOOL SPIRIT WEAR'});
 assert.ok(!shorter.includes('class="page campaign athletic school-layout long-headline"'));
 const business=studioPrintHtml({category:'business',headline:heading});
 assert.ok(!business.includes(' long-headline"'));
});

test('per-section locks preserve the exact placement of each locked section',()=>{
 const current={sections:['hero','benefits','products','steps','cta']};
 assert.deepEqual(studioMoveSectionFirst(current,'steps',['benefits'],0),['benefits','steps','products']);
 assert.deepEqual(studioMoveSectionFirst(current,'benefits',['benefits'],0),['benefits','products','steps']);
 const proposed={sections:['hero','steps','products','benefits','cta']};
 assert.deepEqual(studioMergeLockedSections(current,proposed,['benefits'],0),['benefits','steps','products']);
 assert.deepEqual(studioMergeLockedSections(current,proposed,['benefits','products'],0),['benefits','products','steps']);
});
test('editor exposes bounded per-element offsets, independent placement locks, and unlocked regeneration',()=>{
 const ui=readFileSync(new URL('../../src/MarketingAIDesignStudio.jsx',import.meta.url),'utf8');
 assert.match(ui,/studioMoveSectionFirst\(plan,section,lockedSections,selected\)/);
 assert.match(ui,/studioMergeLockedSections\(v,result.plan,lockedSections,selected\)/);
 assert.match(ui,/if\(!lockedSections.includes\("hero"\)\)setConcepts/);
 for(const field of ['headlineX','headlineY','galleryX','galleryY'])assert.ok(ui.includes('updateSelectedLayout("'+field+'"'));
 const html=studioPrintHtml({category:'school',layoutAdjustments:{headlineX:.15,headlineY:-.1,galleryX:-.05,galleryY:.15}});
 assert.match(html,/--studio-headline-x:0\.15in/);
 assert.match(html,/--studio-gallery-y:0\.15in/);
});

test('deleting an approved merchandise image also shifts its caption and invalidates approval',()=>{
 const ui=readFileSync(new URL('../../src/MarketingAIDesignStudio.jsx',import.meta.url),'utf8');
 assert.match(ui,/function removeProductImage\(index\)/);
 assert.match(ui,/setProductLabels\(previous=>\[\.\.\.previous\.filter\(\(_,i\)=>i!==index\),""\]\.slice\(0,4\)\)/);
 assert.match(ui,/onClick=\{\(\)=>removeProductImage\(i\)\}/);
 assert.match(ui,/\[\.\.\.new Set\(\[\.\.\.productImages/);
});
