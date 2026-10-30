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
test('only whitelisted supplier brand/style pairs qualify for automatic enrichment', async()=>{
 const {catalogStyle,suitableTitle}=await import('../../netlify/functions/supplier-photo-sync.js');
 assert.equal(catalogStyle('Bella + Canvas','3001'),'bc3001');
 assert.equal(catalogStyle('Gildan','18500'),'18500');
 assert.equal(catalogStyle('Gildan','NA'),'');
 assert.equal(catalogStyle('Independent','SS4500'),'ss4500');
 assert.equal(suitableTitle({title:'BELLA+CANVAS Unisex Tee BC3001'},'Bella + Canvas','bc3001'),true);
 assert.equal(suitableTitle({title:'Bella Canvas BC3001'},'Gildan','18500'),false);
});
test('catalog images must use an exact style/color and approved supplier source',async()=>{
 const {bestImage,validImage}=await import('../../netlify/functions/supplier-photo-sync.js');
 const data={
  images:[
   'https://sanmarsports.com/cdn/shop/files/18500_black_model_front_001.jpg',
   'https://sanmarsports.com/cdn/shop/files/18500_carolinablue_model_front_002.jpg',
   'https://sanmarsports.com/cdn/shop/files/64000_black_model_front_003.jpg',
  ],
  variants:[],
 };
 assert.match(bestImage(data,'18500','Carolina Blue'),/carolinablue/);
 assert.match(bestImage(data,'18500','Black'),/18500_black/);
 assert.equal(bestImage(data,'18500','Blue'),'');
 assert.equal(bestImage(data,'18500','Red'),'');
 assert.equal(validImage('https://malicious.example/18500_black.jpg'),'');
 assert.equal(validImage('http://sanmarsports.com/foo.jpg'),'');
});