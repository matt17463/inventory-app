import test from "node:test";
import assert from "node:assert/strict";
import {approvedMarketingPhotoCandidates} from "../../src/lib/marketingApprovedPhotoAssets.js";

const key="marketing/artwork/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.jpg";
test("only approved client document photo references can be selected",()=>{
 const docs=[
  {status:"draft",title:"Unapproved",content:{marketing_product_images:[{key:"marketing/artwork/11111111-1111-4111-8111-111111111111/33333333-3333-4333-8333-333333333333.png"}]}},
  {status:"approved",title:"Approved program",content:{marketing_product_images:[{key},{key},{source:"mockup_outputs",asset_id:"33333333-3333-4333-8333-333333333333"}]}},
  {status:"approved",title:"Bad reference",content:{marketing_product_images:[{key:"../../../secrets"},{source:"blank_products",asset_id:"33333333-3333-4333-8333-333333333333"}]}},
 ];
 const found=approvedMarketingPhotoCandidates(docs);
 assert.equal(found.length,2);
 assert.deepEqual(found.map(x=>x.id),[key,"mockup_outputs:33333333-3333-4333-8333-333333333333"]);
 assert.equal(found[0].title,"Approved program");
});
test("does not implicitly accept arbitrary embedded photos",()=>{
 const result=approvedMarketingPhotoCandidates([{status:"approved",content:{productImages:["data:image/png;base64,abcd"]}}]);
 assert.deepEqual(result,[]);
});

test("private shared marketing signing validates tenant project storage paths",async()=>{
 const {marketingSharedAssetPathAllowed}=await import('../../netlify/functions/marketing-shared-asset.js');
 const project='22222222-2222-4222-8222-222222222222';
 const owner='11111111-1111-4111-8111-111111111111';
 const asset={project_id:project,storage_provider:'r2',storage_bucket:'mockups',storage_path:owner+'/'+project+'/outputs/sample.webp'};
 assert.equal(marketingSharedAssetPathAllowed('mockup_outputs',asset),true);
 assert.equal(marketingSharedAssetPathAllowed('mockup_outputs',{...asset,storage_path:owner+'/33333333-3333-4333-8333-333333333333/outputs/sample.webp'}),false);
 assert.equal(marketingSharedAssetPathAllowed('mockup_outputs',{...asset,storage_path:owner+'/'+project+'/artwork/file.png'}),false);
 assert.equal(marketingSharedAssetPathAllowed('mockup_outputs',{...asset,storage_path:'../../'+project+'/outputs/sample.webp'}),false);
 assert.equal(marketingSharedAssetPathAllowed('mockup_artwork_assets',{...asset,storage_path:owner+'/'+project+'/artwork/logo.png'}),true);
 assert.equal(marketingSharedAssetPathAllowed('mockup_artwork_assets',asset),false);
 assert.equal(marketingSharedAssetPathAllowed('mockup_blank_assets',{...asset,storage_path:'blanks/sample.webp'}),true);
 assert.equal(marketingSharedAssetPathAllowed('mockup_blank_assets',{...asset,storage_provider:'external'}),false);
});
