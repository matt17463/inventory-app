// Keep historical WooCommerce orders working until verified migration.
// A verified design on one line never silently authorizes unmapped siblings.
export function graphicCompatibilityState({channel,selections=[],unmapped_line_ids=[],loading=false,error=''}={}){
 if(loading||error)return {blocked:true,legacy:false,message:error||'Checking graphic assignments'};
 const unresolvedCapture=selections.some(s=>s?.capture_status&&s.capture_status!=='managed_resolved');
 if(unresolvedCapture)return {blocked:true,legacy:false,message:'Managed graphic capture needs verification'};
 if(selections.some(s=>s?.capture_status==='managed_resolved'&&!s?.family_id))return {blocked:true,legacy:false,message:'Managed graphic capture has no linked artwork selection'};
 const mapped=selections.filter(s=>s?.family_id);
 if(!mapped.length)return {blocked:false,legacy:true,message:channel==='woocommerce'?'Legacy WooCommerce order: confirm artwork manually.':'No managed graphic selection; use existing approved recipe.'};
 if(unmapped_line_ids.length)return {blocked:true,legacy:false,message:'This order mixes verified graphics with unmapped line items: '+unmapped_line_ids.join(', ')};
 if(mapped.some(x=>!x.resolution_snapshot?.artworkAssetId))return {blocked:true,legacy:false,message:'Verified graphic assignment lacks exact production artwork'};
 return {blocked:false,legacy:false,message:'Verified graphic selections available'};
}
