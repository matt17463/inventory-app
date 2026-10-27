import {useCallback,useContext,useEffect,useState} from 'react';
import {supabase} from './supabaseClient';
import {EmployeeAccessContext} from './lib/employeeAccessContext';
const unwrap=async query=>{const {data,error}=await query;if(error)throw error;return data;};
export default function VariationCertificationPanel({parentId,identityOnly=false}){
 const access=useContext(EmployeeAccessContext),manager=['admin','manager'].includes(access?.role);
 const [data,setData]=useState(null),[productId,setProductId]=useState(''),[versionId,setVersionId]=useState('');
 const [outputs,setOutputs]=useState([]),[evidence,setEvidence]=useState(''),[configuration,setConfiguration]=useState('');
 const [check,setCheck]=useState(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const load=useCallback(async()=>{
  const products=await unwrap(supabase.from('products').select('id,name,sku,size,woocommerce_variation_id,blank_product_id').eq('woocommerce_product_id',parentId).order('sku'));
  const blankIds=[...new Set(products.map(p=>p.blank_product_id).filter(Boolean))];
  const blanks=blankIds.length?await unwrap(supabase.from('blank_products').select('id,name,sku_base').in('id',blankIds)):[];
  const blankLabels=new Map(blanks.map(b=>[b.id,[b.name,b.sku_base].filter(Boolean).join(' · ')]));
  products.forEach(p=>{p.blank_label=blankLabels.get(p.blank_product_id)||p.blank_product_id;});
  const projects=await unwrap(supabase.from('mockup_projects').select('id').eq('woo_product_id',parentId));
  const [versions,configurations,certificates,mockups]=await Promise.all([
   unwrap(supabase.from('sc_manufacturing_recipe_versions').select('id,recipe_id,revision,status,placements,sc_manufacturing_recipes(name)').order('created_at',{ascending:false}).limit(1000)),
   products.length?unwrap(supabase.from('sc_variation_configurations').select('*').in('product_id',products.map(p=>p.id))):[],
   products.length?unwrap(supabase.from('sc_variation_certifications').select('id,configuration_id,product_id,recipe_version_id,status,certified_at,revoked_at,revocation_reason,evidence_snapshot').in('product_id',products.map(p=>p.id)).order('certified_at',{ascending:false})):[],
   projects.length?unwrap(supabase.from('mockup_outputs').select('id,output_name,placement_id,approval_status,is_selected').in('project_id',projects.map(p=>p.id))):[],
  ]);
  const audit=configurations.length?await unwrap(supabase.from('sc_certification_audit').select('id,kind,reason,created_at,actor_id,details').in('configuration_id',configurations.map(c=>c.id)).order('created_at',{ascending:false}).limit(200)):[];
  setData({products,versions,configurations,certificates,mockups,audit});
 },[parentId]);
 useEffect(()=>{let active=true;setData(null);setProductId('');setVersionId('');setCheck(null);setConfiguration('');load().catch(e=>{if(active)setMessage(e.message);});return()=>{active=false;};},[load]);
 const version=data?.versions.find(v=>v.id===versionId);
 function choose(product,revision){
  setProductId(product);setVersionId(revision);setCheck(null);setMessage('');
  const prior=data?.configurations.find(c=>c.product_id===product&&c.recipe_version_id===revision);
  setOutputs(prior?.output_ids||[]);setEvidence(prior?.review_evidence||'');setConfiguration(prior?.id||'');
 }
 async function run(fn){setBusy(true);setMessage('');try{await fn();await load();}catch(e){setMessage(e.message);setCheck(null);}finally{setBusy(false);}}
 if(identityOnly)return <section aria-label="Individual product variations"><h4>Individual variation identity</h4>{message&&<p role="alert">{message}</p>}{!data?<p>Loading exact product rows…</p>:<ul>{data.products.map(p=><li key={p.id}><strong>{p.sku||p.name}</strong> · Variation #{p.woocommerce_variation_id||'simple product'} · Size {p.size||'missing'} · Blank {p.blank_label||'missing mapping'}</li>)}</ul>}</section>;
 return <section aria-label="Authoritative variation certification" className="card">
  <h3>Variation certification and evidence history</h3>
  <p>Choose the exact SKU and approved recipe revision. Every placement requires a matching mockup, exact blank, approved artwork and current customer sign-off. Saving a configuration records your review; it grants no source approval.</p>
  {message&&<p role="status">{message}</p>}
  {!data?<p>Loading authoritative records…</p>:<>
   <table><thead><tr><th>Variation / SKU</th><th>Size</th><th>Blank</th><th>Certification history</th></tr></thead><tbody>{data.products.map(p=><tr key={p.id}><td>{p.woocommerce_variation_id||'Simple product'} · {p.sku||p.name}</td><td>{p.size}</td><td>{p.blank_label||'Missing'}</td><td>{data.certificates.filter(c=>c.product_id===p.id).map(c=><details key={c.id}><summary>{c.status} · {new Date(c.certified_at).toLocaleString()}</summary><p>{c.revocation_reason||'Exact source evidence saved'} · Certificate {c.id}</p><pre style={{whiteSpace:'pre-wrap',maxHeight:240,overflow:'auto'}}>{JSON.stringify(c.evidence_snapshot,null,2)}</pre></details>)}</td></tr>)}</tbody></table>
   <details><summary>Certification audit history</summary><ul>{data.audit.map(a=><li key={a.id}>{new Date(a.created_at).toLocaleString()} · {a.kind} · {a.reason} · Actor {a.actor_id||'service / unavailable'}</li>)}</ul></details>
   <label>Exact variation<select value={productId} onChange={e=>choose(e.target.value,versionId)}><option value="">Select variation</option>{data.products.map(p=><option key={p.id} value={p.id}>{p.sku||p.name} · {p.size} · #{p.woocommerce_variation_id||'simple'}</option>)}</select></label>
   <label>Recipe revision<select value={versionId} onChange={e=>choose(productId,e.target.value)}><option value="">Select exact revision</option>{data.versions.map(v=><option key={v.id} value={v.id}>{v.sc_manufacturing_recipes?.name||'Recipe'} · revision {v.revision} · {v.status}</option>)}</select></label>
   {(version?.placements||[]).map((p,i)=><label key={i}>Placement {i+1}: {p.placement_name} · {p.size_group||'all'} · {p.print_width_inches} × {p.print_height_inches} in<select disabled={!manager} value={outputs[i]||''} onChange={e=>{setOutputs(old=>{const next=[...old];next[i]=e.target.value;return next;});setConfiguration('');setCheck(null);}}><option value="">Choose exact mockup output</option>{data.mockups.map(o=><option key={o.id} value={o.id}>{o.output_name||o.id} · {o.approval_status} · {o.is_selected?'selected':'unselected'}</option>)}</select></label>)}
   <label>Variation review evidence<textarea disabled={!manager} value={evidence} onChange={e=>{setEvidence(e.target.value);setConfiguration('');setCheck(null);}} placeholder="Explain the exact variation, blank, placements and customer evidence you verified."/></label>
   {manager&&<button disabled={busy||!productId||!versionId||outputs.length!==version?.placements?.length||Array.from({length:version?.placements?.length||0},(_,i)=>outputs[i]).some(x=>!x)||evidence.trim().length<12} onClick={()=>run(async()=>{
    const id=await unwrap(supabase.rpc('sc_save_variation_configuration',{p_product_id:productId,p_recipe_version_id:versionId,p_output_ids:outputs,p_review_evidence:evidence}));setConfiguration(id);setCheck(await unwrap(supabase.rpc('sc_check_variation_configuration',{p_configuration_id:id})));setMessage('Variation configuration saved and checked.');
   })}>Save exact configuration and check evidence</button>}
   <button disabled={busy||!configuration} onClick={()=>run(async()=>setCheck(await unwrap(supabase.rpc('sc_check_variation_configuration',{p_configuration_id:configuration}))))}>Refresh readiness blockers</button>
   {check&&<div role="status"><strong>{check.ready?'Source evidence is current':'Not certified — resolve blockers'}</strong><ul>{check.blockers.map((b,i)=><li key={i}>{b}</li>)}</ul></div>}
   {manager&&<button disabled={busy||!configuration||!check?.ready} onClick={()=>run(async()=>{const id=await unwrap(supabase.rpc('sc_certify_variation',{p_configuration_id:configuration}));setMessage('Certified exact variation. Certificate '+id+'. Production still validates each order and traveler.');})}>Certify this exact variation</button>}
  </>}
 </section>;
}
