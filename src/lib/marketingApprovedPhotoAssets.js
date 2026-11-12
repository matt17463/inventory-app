/** Only surface product imagery belonging to previously APPROVED client documents.
 * Candidate assets are still reviewed by the operator before being included in a flyer.
 */
export function approvedMarketingPhotoCandidates(documents,limit=16){
 const seen=new Set(),items=[];
 for(const document of Array.isArray(documents)?documents:[]){
  if(document?.status!=="approved")continue;
  const content=document.content||{};
  const refs=[
   ...(Array.isArray(content.marketing_product_images)?content.marketing_product_images:[]),
   content.marketing_product_image,
   ...(Array.isArray(content.productReferences)?content.productReferences:[]),
  ];
  for(const reference of refs){
   if(!reference||typeof reference!=="object")continue;
   const key=typeof reference.key==="string" && /^marketing\/artwork\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(png|jpg|webp)$/i.test(reference.key)?reference.key:"";
   const source=["mockup_outputs"].includes(reference.source)?reference.source:"";
   const assetId=typeof reference.asset_id==="string"&&/^[0-9a-f-]{36}$/i.test(reference.asset_id)?reference.asset_id:"";
   if(!key&&!(source&&assetId))continue;
   const id=key||source+":"+assetId;
   if(seen.has(id))continue;
   seen.add(id);
   items.push({id,reference,title:String(document.title||"Approved client document").slice(0,150)});
   if(items.length>=limit)return items;
  }
 }
 return items;
}
