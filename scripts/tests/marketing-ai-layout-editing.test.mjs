import test from 'node:test';
import assert from 'node:assert/strict';
import {studioLayoutSections,studioExportReadiness,studioPrintHtml,STUDIO_CATEGORY_COPY} from '../../src/lib/marketingDesignStudio.js';

const sample='data:image/png;base64,AAAA';
test('validated layout plan reorders only supported modules and preserves each exactly once',()=>{
 assert.deepEqual(studioLayoutSections({sections:['hero','steps','steps','products','<script>','cta']},0),['steps','products','benefits']);
 assert.deepEqual(studioLayoutSections(null,0),['products','benefits','steps']);
});
test('every category has distinct content direction rather than school-only wording',()=>{
 for(const category of ['school','team','business','nonprofit','wedding','general']){
  assert.ok(STUDIO_CATEGORY_COPY[category].benefits);
  const html=studioPrintHtml({category,client:'Test Organization',headline:'Verified headline',benefits:['Good service'],steps:['Confirm proof'],contact:'example.test',productImages:[sample],logo:sample});
  assert.ok(html.includes(STUDIO_CATEGORY_COPY[category].hero));
  assert.ok(html.includes(STUDIO_CATEGORY_COPY[category].collection));
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
