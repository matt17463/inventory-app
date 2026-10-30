import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const root=new URL('../../',import.meta.url);
const read=(path)=>fs.readFileSync(new URL(path,root),'utf8');
test('supplier photo synchronization must restrict source and require authenticated staff',()=>{
 const source=read('netlify/functions/supplier-photo-sync.js');
 assert.match(source,/authorizeEmployee/);
 assert.match(source,/allowedRoles:\['admin','manager'\]/);
 assert.match(source,/sanmarsports\.com/);
 assert.match(source,/suitableTitle/);
 assert.match(source,/bestImage/);
 assert.match(source,/image_storage_path/);
 assert.match(source,/\.is\('image_url',null\)/);
 assert.doesNotMatch(source,/new URL\(input\./);
});
test('blank identification guide uses color-specific product photos and sourced material',()=>{
 const source=read('src/BlankIdentificationGuide.jsx');
 assert.match(source,/const match=variations\.find\(\(item\)=>item\.color===color&&item\.photo\)/);
 assert.match(source,/operationalAssetUrls/);
 assert.match(source,/Photo needs verification/);
});