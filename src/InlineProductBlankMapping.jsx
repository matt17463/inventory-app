import {useCallback,useEffect,useState} from 'react';
import {getProductBlankMappingIssues,searchMappingBlanks,setProductBlankMapping} from './lib/productBlankMappingApi';

const label=x=>[x.sku_base||x.name,x.brand,x.style,x.color,x.size].filter(Boolean).join(' · ');
export default function InlineProductBlankMapping({productId,canManage,onSaved}){
 const [issues,setIssues]=useState([]),[selected,setSelected]=useState(null),[blanks,setBlanks]=useState([]),[blankId,setBlankId]=useState('');
 const [query,setQuery]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const load=useCallback(async()=>{
  setBusy(true);setError('');
  try{
   // Use the existing guarded mapping endpoint; never operate on rows from another family.
   const rows=await getProductBlankMappingIssues('',500);
   setIssues((rows||[]).filter(x=>Number(x.woo_product_id)===Number(productId)));
  }catch(e){setError(e.message);}finally{setBusy(false);}
 },[productId]);
 useEffect(()=>{load();setSelected(null);setBlankId('');},[load]);
 async function selectRow(row){
  setSelected(row);setBlankId('');const initial=[row.brand,row.style,row.color,row.size].filter(Boolean).join(' ');
  setQuery(initial);try{setBlanks(await searchMappingBlanks(initial,100));}catch(e){setError(e.message);}
 }
 async function findBlanks(){
  setBusy(true);setError('');
  try{setBlanks(await searchMappingBlanks(query,100));}catch(e){setError(e.message);}finally{setBusy(false);}
 }
 async function save(){
  if(!canManage||!selected||!blankId||Number(selected.woo_product_id)!==Number(productId))return;
  const source=selected.woo_variation_id?{source_kind:'woocommerce_variation',source_key:String(selected.woo_variation_id)}:{source_kind:'woocommerce_sku',source_key:String(selected.sku||'')};
  if(!source.source_key)return setError('This row has no stable WooCommerce variation or SKU identity.');
  const chosen=blanks.find(x=>String(x.id)===blankId);
  if(!chosen||!window.confirm('Assign '+label(chosen)+' to '+(selected.sku||selected.product_name)+'? The existing mapping workflow may also repair unpaired pull sheet lines.'))return;
  setBusy(true);setError('');setMessage('');
  try{
   const result=await setProductBlankMapping({...source,blank_product_id:blankId,mapping_source:'mapping_lifecycle_review',notes:'Reviewed in product modernization wizard for Woo parent '+productId,propagate_unpaired:true});
   setMessage('Saved mapping for '+(selected.sku||selected.product_name)+'. '+(result.products_updated||0)+' catalog rows updated.');
   setSelected(null);setBlankId('');await load();onSaved?.();
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }
 return <section aria-label="Edit this product's blank mappings">
  <h4>Variation-by-variation blank matching</h4>
  <p>Showing unresolved mapping rows returned for WooCommerce parent #{productId}. Rows already paired are not modified.</p>
  <button type="button" disabled={busy} onClick={load}>Refresh mapping issues</button>
  {error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
  {!issues.length?<p>No unresolved variation rows for this product were returned in the first 500 issues. Check the specialist mapping page if the catalog summary still reports gaps.</p>:<div>
   {issues.map(x=><div key={x.product_row_id} className="sc-cr-listline">
    <span><strong>{x.sku||x.product_name||'Unnamed variation'}</strong> · {[x.brand,x.style,x.color,x.size].filter(Boolean).join(' / ')} · {x.issue_status}</span>
    {canManage&&<button type="button" disabled={busy} onClick={()=>selectRow(x)}>Choose blank</button>}
   </div>)}
  </div>}
  {selected&&canManage&&<div className="card">
   <h4>Assign blank to {selected.sku||selected.product_name}</h4>
   <form onSubmit={e=>{e.preventDefault();findBlanks();}}>
    <label>Search blanks<input value={query} onChange={e=>setQuery(e.target.value)} /></label>
    <button type="submit" disabled={busy}>Find blanks</button>
   </form>
   <label>Exact blank product<select value={blankId} onChange={e=>setBlankId(e.target.value)}>
    <option value="">Select matching style, color and size</option>
    {blanks.map(x=><option key={x.id} value={x.id}>{label(x)}</option>)}
   </select></label>
   <button type="button" disabled={!blankId||busy} onClick={save}>Confirm and save exact mapping</button>
   <button type="button" onClick={()=>setSelected(null)}>Cancel</button>
  </div>}
 </section>;
}
