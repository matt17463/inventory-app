import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css=fs.readFileSync(new URL('../../src/ProductDevelopmentCenter.css',import.meta.url),'utf8');
const appCss=fs.readFileSync(new URL('../../src/App.css',import.meta.url),'utf8');
const jsx=fs.readFileSync(new URL('../../src/ProductDevelopmentCenter.jsx',import.meta.url),'utf8');
const contrast=(a,b)=>{
 const l=hex=>{
  const [r,g,blue]=hex.replace('#','').match(/.{2}/g).map(c=>parseInt(c,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);
  return .2126*r+.7152*g+.0722*blue;
 };
 const x=l(a),y=l(b);
 return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
};
function varsIn(block){
 const vars={};
 for(const [,key,val] of block.matchAll(/(--pdc-[\w-]+):\s*(#[\da-f]{6});/ig))vars[key]=val;
 return vars;
}
const light=varsIn(css.match(/\.pdc-page\{([\s\S]*?)\n\}/)?.[1]||'');
const dark=varsIn(css.match(/html\[data-theme='dark'\] \.pdc-page,[\s\S]*?\{([\s\S]*?)\n\}/)?.[1]||'');

test('global style uses important button overrides, but page provides scoped, explicit important text and surfaces',()=>{
 assert.match(appCss,/button,[\s\S]{0,3000}background:\s*var\(--sc-panel\)\s*!important/);
 assert.match(css,/\.pdc-page button,\.pdc-page \.pdc-link\{[\s\S]*?background:var\(--pdc-surface\) !important;color:var\(--pdc-text\) !important/);
 assert.match(css,/\.pdc-page \.pdc-hero \.pdc-link\{[\s\S]*?background:#f5fbff !important;color:#17324b !important/);
 assert.match(css,/\.pdc-page \.pdc-tabs button\[aria-selected='true'\]\{[\s\S]*?color:#fff !important/);
 assert.match(css,/\.pdc-page \.pdc-primary,.pdc-page button\.pdc-primary\{[\s\S]*?color:#ffffff !important/);
});
test('light and dark palettes have AA text contrast across buttons, muted labels, fields and cards',()=>{
 for(const [name,palette] of [['light',light],['dark',dark]]){
  for(const key of ['--pdc-text','--pdc-muted','--pdc-surface','--pdc-field','--pdc-accent','--pdc-link']){
   assert.ok(palette[key],name+' missing '+key);
  }
  assert.ok(contrast(palette['--pdc-text'],palette['--pdc-surface'])>=4.5,name+' panel body');
  assert.ok(contrast(palette['--pdc-muted'],palette['--pdc-surface'])>=4.5,name+' muted text');
  assert.ok(contrast(palette['--pdc-text'],palette['--pdc-field'])>=4.5,name+' form controls');
  assert.ok(contrast('#ffffff',palette['--pdc-accent'])>=4.5,name+' primary controls');
  assert.ok(contrast(palette['--pdc-link'],palette['--pdc-surface'])>=4.5,name+' text links');
 }
 assert.ok(contrast('#17324b','#f5fbff')>=4.5,'hero navigation text');
});
test('layout safely shrinks at narrow widths and tables retain horizontal scrolling',()=>{
 assert.match(css,/\.pdc-page\{[\s\S]*?width:100%;[\s\S]*?min-width:0/);
 assert.match(css,/grid-template-columns:minmax\(0,320px\) minmax\(0,1fr\)/);
 assert.match(css,/@media\(max-width:800px\)\{[\s\S]*?grid-template-columns:minmax\(0,1fr\)/);
 assert.match(css,/\.pdc-page \.pdc-table-wrap\{[\s\S]*?overflow-x:auto/);
 assert.match(css,/\.pdc-page \.pdc-grid\{display:grid;grid-template-columns:repeat\(auto-fit,minmax\(min\(100%,205px\),1fr\)\)/);
});
test('all five screens and the header actions use the updated scoped control components',()=>{
 for(const id of ['radar','recipes','economics','events','launch'])assert.match(jsx,new RegExp("'"+id+"'"));
 assert.match(jsx,/className="pdc-hero-links"/);
 assert.match(jsx,/className="pdc-link"/);
 assert.match(jsx,/className="pdc-primary"/);
 assert.match(css,/\.pdc-page button:focus-visible/);
 assert.match(css,/\.pdc-page \.pdc-source a/);
 assert.match(css,/\.pdc-page input::placeholder/);
});