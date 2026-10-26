// Capture-state persistence for WooCommerce order artwork.
export async function saveWooGraphicCapture(db,orderId,lineId,status,reason=null){
 const allowed=['managed_pending','managed_failed','managed_resolved'];
 if(!allowed.includes(status))throw Error('Unknown capture state');
 const woo_order_id=Number(orderId),woo_line_item_id=Number(lineId);
 if(!Number.isSafeInteger(woo_order_id)||woo_order_id<1||!Number.isSafeInteger(woo_line_item_id)||woo_line_item_id<1)
  throw Error('Invalid WooCommerce identifiers');
 const {error}=await db.from('sc_woo_graphic_capture_states').upsert({
  woo_order_id,woo_line_item_id,status,reason
 },{onConflict:'woo_order_id,woo_line_item_id'});
 if(error)throw Error('Failed to persist managed graphic capture state');
}
