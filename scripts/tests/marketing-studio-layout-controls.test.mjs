import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_STUDIO_LAYOUT,normalizeStudioLayout,studioLayoutStyle} from '../../src/lib/marketingStudioLayoutControls.js';
import {studioPrintHtml} from '../../src/lib/marketingDesignStudio.js';

test('bounded print geometry retains safe defaults and clamps untrusted values',()=>{
 assert.deepEqual(normalizeStudioLayout({}),DEFAULT_STUDIO_LAYOUT);
 const value=normalizeStudioLayout({heroHeight:999,galleryHeight:-99,spacing:'calc(1in + 5in)',presentation:'url(evil)'});
 assert.deepEqual(value,{heroHeight:3.65,galleryHeight:1.5,spacing:.16,presentation:'overlap'});
});
test('all exported page geometry is numeric, not raw style text',()=>{
 const css=studioLayoutStyle({heroHeight:'5in;background:red',galleryHeight:2.2,presentation:'grid'});
 assert.ok(!css.includes('background:red'));
 assert.match(css,/--studio-hero-height:3\.35in/);
 assert.match(css,/--studio-gallery-height:2\.20in/);
});
test('selected concept geometry is embedded in print page and layout changes presentation',()=>{
 const html=studioPrintHtml({client:'Client',layoutAdjustments:{heroHeight:3.4,galleryHeight:1.8,spacing:.1,presentation:'grid'}});
 assert.match(html,/--studio-hero-height:3\.40in/);
 assert.match(html,/--studio-gallery-height:1\.80in/);
 assert.match(html,/gallery-grid/);
 const defaultHtml=studioPrintHtml({client:'Client'});
 assert.match(defaultHtml,/--studio-hero-height:3\.35in/);
});
