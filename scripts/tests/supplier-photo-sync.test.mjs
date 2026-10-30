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
 assert.match(source,/const match=variations\.find\(\(item\)=>item\.color===color&&item\.exactPhoto\)/);
 assert.match(source,/operationalAssetUrls/);
 assert.match(source,/No supplier photo assigned/);
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
test('Shopify product feed accepts text/javascript while reading actual JSON safely',async()=>{
 const {fetchProduct}=await import('../../netlify/functions/supplier-photo-sync.js');
 const prior=globalThis.fetch;
 try{
  globalThis.fetch=async()=>new Response(JSON.stringify({title:'Gildan Heavy Blend 18500',vendor:'Gildan',images:[],variants:[]}),{status:200,headers:{'Content-Type':'text/javascript; charset=utf-8'}});
  const result=await fetchProduct('18500');
  assert.equal(result.vendor,'Gildan');
  globalThis.fetch=async()=>new Response('<script>not json</script>',{status:200,headers:{'Content-Type':'text/html'}});
  await assert.rejects(fetchProduct('18500'),/content type/);
 }finally{globalThis.fetch=prior}
});
test('guide clearly distinguishes missing reference photos from failed image links',()=>{
 const source=read('src/BlankIdentificationGuide.jsx');
 assert.match(source,/No supplier photo assigned/);
 assert.match(source,/Supplier photo failed to load/);
 assert.match(source,/loading="eager"/);
 assert.match(source,/Photo coverage/);
});

test('supplier image lookup supports official BC6400 and BC6405 style handles',async()=>{
 const {catalogStyle}=await import('../../netlify/functions/supplier-photo-sync.js');
 assert.equal(catalogStyle('Bella + Canvas','6400'),'bc6400');
 assert.equal(catalogStyle('Bella + Canvas','6405'),'bc6405');
});
test('provisional photos match only the same manufacturer and style, except an explicitly documented style alias',async()=>{
 const {referenceIndex,referenceFor}=await import('../../src/lib/blankGuidePhotos.js');
 const known=[{brand:'Gildan',style:'18500',color:'Black',savedPhoto:'https://example.com/a.jpg'},
 {brand:'Gildan',style:'64000',color:'White',savedPhoto:'https://example.com/b.jpg'}];
 const index=referenceIndex(known);
 const probable=referenceFor({brand:'Gildan',style:'18500',color:'Red'},index);
 assert.equal(probable.kind,'style');
 assert.match(probable.note,/color may differ/);
 assert.equal(probable.exactPhoto,'');
 assert.equal(referenceFor({brand:'Richardson',style:'18500',color:'Red'},index).photo,'');
 assert.equal(referenceFor({brand:'Gildan',style:'6400',color:'White'},index).kind,'alias');
 assert.equal(referenceFor({brand:'Gildan',style:'NA',color:'White'},index).photo,'');
});
test('blank-guide SKU table is collapsed by default but printable, and photo edits require privileged staff',()=>{
 const jsx=read('src/BlankIdentificationGuide.jsx');
 const functionSource=read('netlify/functions/blank-guide-photo-edit.js');
 assert.match(jsx,/<details className="sc-blank-guide-identifiers">/);
 assert.match(jsx,/beforeprint/);
 assert.match(jsx,/afterprint/);
 assert.match(jsx,/uploadOperationalImage/);
 assert.match(jsx,/blank-guide-photo-edit/);
 assert.match(functionSource,/allowedRoles:\['admin','manager'\]/);
 assert.match(functionSource,/matching size variations/i);
 assert.match(functionSource,/operational\/products/);
});
