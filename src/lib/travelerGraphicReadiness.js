// Side-effect-free validation before creating a grouped production traveler.
// Never group lines with different customer-selected artwork families.
export function validateTravelerGraphicReadiness({items=[],recipeVersion,artworkAssets=[],selections=[],lineArtworkByItem={}}={}){
 const blockers=[];
 if(!items.length)blockers.push('Select at least one order line');
 if(!recipeVersion||recipeVersion.status!=='approved')blockers.push('Choose an approved recipe version');
 const placements=recipeVersion?.placements||[];
 const assets=new Map(artworkAssets.map(a=>[String(a.id),a]));
 const versionAsset=recipeVersion?.artwork_asset_id;
 if(!placements.length && !versionAsset)blockers.push('Recipe has no decoration placements or approved recipe artwork');
 for(const [index,p] of (placements.length?placements:[{artwork_asset_id:versionAsset}]).entries()){
  for(const item of items){
   const mapped=(lineArtworkByItem[item.id]||[]).filter(a=>a.placement_name===p.placement_name);
   const id=p.artwork_asset_id||versionAsset||mapped[0]?.artwork_asset_id;
   if(!id||(!p.artwork_asset_id&&!versionAsset&&mapped.length!==1)){
    blockers.push('Line '+item.id+' placement '+(p.placement_name||index+1)+' needs an approved artwork assignment');continue;
   }
   const asset=assets.get(String(id));
   if(!asset){blockers.push('Line '+item.id+' placement '+(p.placement_name||index+1)+' artwork is unavailable');continue}
   if(!['approved','ready','passed'].includes(String(asset.preflight_status||'').toLowerCase()))
    blockers.push('Line '+item.id+' placement '+(p.placement_name||index+1)+' artwork has not passed preflight');
  }
 }
 const families=new Set(selections.filter(x=>x&&x.family_id).map(x=>String(x.family_id)));
 if(families.size>1)blockers.push('Selected order lines have different customer graphic choices');
 const resolved=selections.filter(x=>x&&x.family_id);
 if(resolved.some(x=>x.resolution_snapshot?.status && x.resolution_snapshot.status!=='resolved'))
  blockers.push('Customer graphic selection has unresolved production artwork');
 if(resolved.some(x=>!x.resolution_snapshot?.artworkAssetId))
  blockers.push('Customer graphic selection is missing an approved artwork snapshot');
 // A recipe may contain multiple placements, but the resolved primary design must
 // appear among its attached exact artwork assets.
 for(const x of resolved){
  const selectedId=String(x.resolution_snapshot?.artworkAssetId||'');
  const mappedIds=(lineArtworkByItem[x.job_item_id]||[]).map(a=>String(a.artwork_asset_id));
  if(selectedId && !(placements.length?placements:[{artwork_asset_id:versionAsset}]).some(p=>String(p.artwork_asset_id||versionAsset)===selectedId)
    && !mappedIds.includes(selectedId))
   blockers.push('Recipe artwork does not match customer graphic selection');
 }
 return {ready:blockers.length===0,blockers:[...new Set(blockers)]};
}
