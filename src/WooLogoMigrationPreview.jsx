import {useState} from 'react';
import {authenticatedFunctionFetch} from './lib/netlifyFunctionClient';
export default function WooLogoMigrationPreview({parentId}){
 const [report,setReport]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 async function inspect(){
  setLoading(true);setError('');
  try{
   const response=await authenticatedFunctionFetch('/.netlify/functions/woo-logo-migration-preview',{method:'POST',body:JSON.stringify({woo_product_id:Number(parentId)})});
   const result=await response.json();
   if(!response.ok||!result.success)throw Error(result.message||'Preview unavailable');
   setReport(result.data);
  }catch(e){setError(e.message);setReport(null);}finally{setLoading(false);}
 }
 return <section className="card" aria-label="Legacy Logo Choice migration preview">
  <h4>Legacy Logo Choice migration — read-only</h4>
  <p>Before replacing Woo logo variation attributes with Client Graphics, inspect each existing graphic, image, size/color variation, price and stock rule. No WooCommerce records are changed.</p>
  <button type="button" disabled={loading||!parentId} onClick={inspect}>{loading?'Inspecting WooCommerce…':'Preview existing logo variations'}</button>
  {error&&<p role="alert">{error}</p>}
  {report&&<div>
   <p><strong>{report.product_name}</strong> · Woo #{report.parent_id} · {report.existing_variation_count} Woo variations · {report.physical_group_count} size/color groups · {report.logo_choices.length} logo choices.</p>
   <p><strong>Current logo values:</strong> {report.logo_choices.join(' · ')||'None detected'}</p>
   <p><strong>Conflicting physical groups:</strong> {report.conflict_group_count}</p>
   <ul>{report.warnings.map((w,i)=><li key={i}>{w}</li>)}</ul>
   <details><summary>Inspect variation image and option mapping ({report.variations.length})</summary>
    <div style={{maxHeight:420,overflow:'auto'}}><table><thead><tr><th>Woo variation</th><th>Logo choice</th><th>Other attributes</th><th>Image</th><th>Price</th></tr></thead><tbody>
    {report.variations.map(v=><tr key={v.id}><td>{v.id} · {v.sku}</td><td>{v.logo_values.join(', ')||'Missing'}</td><td>{v.physical_attributes.map(a=>a.name+': '+a.value).join(' · ')}</td><td>{v.image_id||'Missing'}</td><td>{v.price}</td></tr>)}
    </tbody></table></div>
   </details>
   <p role="status"><strong>Migration not authorized by this preview.</strong> Preserve variation IDs, historic orders, price/stock behavior and images until approved canonical family bindings and a reversible migration have been validated.</p>
  </div>}
 </section>;
}
