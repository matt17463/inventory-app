// Channel-independent order artwork contract. Finance systems retain invoice totals;
// graphics selection lives in Skilled Crafting and is keyed to the invoice line.
const asText=value=>String(value??'').trim();
const uuid=value=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(asText(value));
export function buildOrderGraphicSelection({source,externalOrderId,externalLineId,familyId,label,details={}}){
 if(!['quickbooks','manual','woocommerce'].includes(source))throw Error('Unsupported order channel');
 if(!asText(externalOrderId)||!asText(externalLineId))throw Error('Order and line identifiers required');
 if(!uuid(familyId))throw Error('Select a valid graphics family');
 if(!details||Array.isArray(details)||typeof details!=='object')throw Error('Invalid production details');
 return {source,external_order_id:asText(externalOrderId),external_line_id:asText(externalLineId),
  family_id:familyId,selected_label:asText(label),selected_payload:details};
}
export function makeProductionGraphicSnapshot({selection,resolution,placements=[]}){
 if(resolution?.status!=='resolved'||!uuid(resolution.artworkAssetId))throw Error('Approved exact artwork must resolve before production');
 return Object.freeze({family_id:selection.family_id,selected_label:selection.selected_label,
  artwork_asset_id:resolution.artworkAssetId,variant_id:resolution.variantId,
  version:resolution.variantVersion,rule_id:resolution.ruleId,
  dimensions:resolution.dimensions,process:resolution.process,
  placements:placements.map(x=>({...x}))});
}
