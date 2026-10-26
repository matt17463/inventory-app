// Fail-closed reconciliation: canonical customer choice is accepted only if product binding was verified.
import {resolveGraphicVariant} from '../../../src/lib/clientGraphicsRules.js';
export async function persistWooGraphicSelections(db,order,{strict=false}={}){
 const failures=[],saved=[];
 for(const line of order.line_items||[]){
  const raw=line.graphic_selection;
  if(raw?.status!=='mapped')continue; // legacy text is intentionally not guessed or migrated
  const productId=Number(line.product_id);
  if(!Number.isSafeInteger(productId)||productId<=0){failures.push({lineId:line.id,reason:'Missing product ID'});continue}
  const {data:binding,error:be}=await db.from('sc_client_graphic_product_bindings').select('graphic_family_id,allowed,verified_at,mode').eq('woo_product_id',productId).eq('graphic_family_id',raw.familyId).maybeSingle();
  if(be){failures.push({lineId:line.id,reason:'Binding lookup failed'});continue}
  if(!binding?.allowed||!binding.verified_at){failures.push({lineId:line.id,reason:'Graphic selection has no verified product binding'});continue}
  const {data:family,error:fe}=await db.from('sc_client_graphic_families').select('id,state').eq('id',raw.familyId).maybeSingle();
  if(fe||family?.state!=='approved'){failures.push({lineId:line.id,reason:'Graphic family not approved'});continue}
  const [v,r]=await Promise.all([
    db.from('sc_client_graphic_variants').select('*').eq('family_id',raw.familyId),
    db.from('sc_client_graphic_rules').select('*').eq('family_id',raw.familyId).eq('enabled',true)
  ]);
  if(v.error||r.error){failures.push({lineId:line.id,reason:'Artwork rule lookup failed'});continue}
  const context={garment_color:line.selected_color||'',size_group:line.selected_size||'',garment_style:line.selected_style||'',placement_name:line.placement||((line.meta_data||[]).find(x=>['placement','logo placement','print location','decoration location'].includes(String(x.key||'').trim().toLowerCase()))?.value||'')};
  const resolution=resolveGraphicVariant({familyId:raw.familyId,variants:v.data,rules:r.data,context});
  const snapshot=resolution.status==='resolved'?resolution:null;
  const payload={
   source:'woocommerce',external_order_id:String(order.id),external_line_id:String(line.id),
   family_id:raw.familyId,selected_label:raw.label,
   selected_payload:{product_id:productId,variation_id:Number(line.variation_id||0)||null,...context},
   resolution_snapshot:snapshot
  };
  const {error}=await db.from('sc_order_graphic_selections').upsert(payload,{onConflict:'source,external_order_id,external_line_id'});
  if(error){failures.push({lineId:line.id,reason:'Failed to persist order graphic selection'});continue}
  saved.push({lineId:line.id,status:resolution.status});
 }
 if(strict&&failures.length)throw Error('Graphic selection reconciliation failed');
 return {saved,failures};
}
