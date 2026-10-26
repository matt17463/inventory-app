import {useCallback,useContext,useEffect,useMemo,useState} from 'react';
import {Link} from 'react-router-dom';
import {supabase} from './supabaseClient';
import {addArtworkAsset,createMockupProject} from './lib/mockupStudioApi';
import {EmployeeAccessContext} from './lib/employeeAccessContext';
import {authenticatedFunctionFetch} from './lib/netlifyFunctionClient';
import './CatalogPairingWorkbench.css';
const api=async(endpoint,input)=>{const response=await authenticatedFunctionFetch('/.netlify/functions/'+endpoint,{method:'POST',body:JSON.stringify(input)});const body=await response.json().catch(()=>({}));if(!response.ok||!body.success)throw Error(body.message||'Catalog request failed');return body.data;};
const words=s=>new Set(String(s||'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(x=>x.length>2&&!['shirt','hoodie','black','size','adult','youth','logo','artwork','graphic','custom','apparel','print','design'].includes(x)));
export function overlap(a,b){const aa=words(a),bb=words(b);return [...aa].filter(x=>bb.has(x)).length;}
export function suggestions(product,assets,recipes){const text=[product.product_name,product.example_sku].join(' ');const candidates=entries=>entries.map(x=>({...x,matchCount:overlap(text,x.artwork_name||x.name)})).filter(x=>x.matchCount>0).sort((a,b)=>b.matchCount-a.matchCount);return {assets:candidates(assets).slice(0,5),recipes:candidates(recipes).slice(0,5)};}
export default function CatalogPairingWorkbench(){
 const access=useContext(EmployeeAccessContext),canManage=['admin','manager'].includes(access?.role);
 const [catalog,setCatalog]=useState(null),[readiness,setReadiness]=useState(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const [search,setSearch]=useState(''),[selected,setSelected]=useState(''),[assetId,setAssetId]=useState(''),[recipeId,setRecipeId]=useState(''),[evidence,setEvidence]=useState(''),[confirm,setConfirm]=useState(false);
 const [uploadFile,setUploadFile]=useState(null),[uploadName,setUploadName]=useState(''),[recipeName,setRecipeName]=useState(''),[method,setMethod]=useState('DTF'),[garment,setGarment]=useState('hoodie'),[adultWidth,setAdultWidth]=useState('10'),[youthWidth,setYouthWidth]=useState('8');
 const load=useCallback(async()=>{setBusy(true);try{const [a,b]=await Promise.all([api('legacy-catalog-modernization',{action:'dashboard'}),api('catalog-production-readiness',{action:'overview'})]);setCatalog(a);setReadiness(b);setMessage('Catalog refreshed. Suggestions are unverified and require review.');}catch(e){setMessage(e.message)}finally{setBusy(false)}},[]);
 useEffect(()=>{load()},[load]);
 const list=useMemo(()=>(catalog?.scores||[]).filter(x=>[x.product_name,x.example_sku,x.woocommerce_product_id].join(' ').toLowerCase().includes(search.toLowerCase())).sort((a,b)=>a.score-b.score),[catalog,search]);
 const product=list.find(x=>String(x.woocommerce_product_id)===selected);
 const recipes=readiness?.recipes||[];
 const matches=product?suggestions(product,catalog?.assets||[],recipes):{assets:[],recipes:[]};
 const stats={total:catalog?.scores?.length||0,withArtwork:(catalog?.scores||[]).filter(x=>x.flags?.artwork).length,withRecipe:(catalog?.scores||[]).filter(x=>x.flags?.recipe).length,review:(catalog?.scores||[]).filter(x=>!x.flags?.artwork||!x.flags?.recipe).length};
 async function uploadNewArtwork(){
  if(!canManage||!product||!uploadFile)return;
  if(!['image/png','image/jpeg','image/webp','image/svg+xml','application/pdf'].includes(uploadFile.type))return setMessage('Choose a PNG, JPEG, WebP, SVG or PDF artwork file.');
  setBusy(true);setMessage('');
  try{
   const project=await createMockupProject({project_name:'Catalog pairing · '+product.product_name+' · Woo '+product.woocommerce_product_id,project_type:'store_product',notes:'Created from the catalog pairing workbench. Artwork requires technical preflight and customer approval.'});
   const saved=await addArtworkAsset({projectId:project.id,file:uploadFile,values:{artwork_name:uploadName.trim()||uploadFile.name,exact_artwork_locked:true,preflight_status:'pending'}});
   setAssetId(saved.id);setUploadFile(null);
   await load();setMessage('Uploaded artwork into Mockup Studio project '+project.id+'. Technical preflight is PENDING. Complete preflight before pairing; no approval or Woo changes were made.');
  }catch(e){setMessage('Artwork upload failed: '+e.message)}
  finally{setBusy(false)}
 }
 async function createDraftRecipe(){
  if(!canManage||!product||!recipeName.trim())return;
  const aw=Number(adultWidth),yw=Number(youthWidth);
  if(!(aw>0&&aw<=24&&yw>0&&yw<=24))return setMessage('Enter sensible positive adult and youth print widths (maximum 24 inches).');
  setBusy(true);setMessage('');
  try{
   const {data:{user},error:authError}=await supabase.auth.getUser();if(authError||!user?.id)throw Error('Sign in as a manager before creating a recipe.');
   const base={name:recipeName.trim().slice(0,160),garment_type:garment,decoration_method:method,scope:'client',customer_label:product.product_name||'',notes:'Draft pairing for Woo parent '+product.woocommerce_product_id+'. Dimensions require measured physical sample.',created_by:user.id};
   const {data:recipe,error:re}=await supabase.from('sc_manufacturing_recipes').insert(base).select('id,name').single();if(re)throw re;
   const placementFor=(size,width)=>({placement_name:'full_front',size_group:size,print_width_inches:width,reference_landmark:'Front collar seam',top_offset_inches:null,center_offset_inches:0,instructions:'Confirm exact positioning and print height on physical garment; not production-approved.'});
   const details={recipe_id:recipe.id,revision:1,status:'draft',verified_sample:false,created_by:user.id,artwork_asset_id:assetId||null,placements:[placementFor('Adult',aw),placementFor('Youth',yw)],process_steps:[{label:'Check blank and order',instruction:'Verify variation, color, and customer personalization'},{label:'Verify production artwork',instruction:'Use only exact preflight-passed approved artwork'},{label:'Measure and produce sample',instruction:'Confirm transfer dimensions, placement, application temperature, pressure and time on real garment'},{label:'Final QC',instruction:'Inspect finished garment and capture sample approval'}],production_notes:'Draft recipe created from catalog pairing. Do not produce without approved sample, artwork and print parameters.'};
   const {error:ve}=await supabase.from('sc_manufacturing_recipe_versions').insert(details);if(ve)throw Error('Recipe '+recipe.id+' created but draft revision failed: '+ve.message);
   setRecipeId(recipe.id);await load();setMessage('Draft recipe created: '+recipe.name+'. Complete dimensions, placements, personalization and sample review before approval.');
  }catch(e){setMessage('Recipe creation failed: '+e.message)}finally{setBusy(false)}
 }
 async function saveArtwork(){if(!canManage||!product||!assetId||!confirm||evidence.trim().length<12)return;setBusy(true);try{await api('legacy-catalog-modernization',{action:'link_artwork',woocommerce_product_id:product.woocommerce_product_id,artwork_asset_id:assetId,approval_evidence:evidence.trim(),confirm:true});await load();setMessage('Approved artwork association saved; WooCommerce checkout unchanged.')}catch(e){setMessage(e.message)}finally{setBusy(false)}}
 async function saveRecipe(){if(!canManage||!product||!recipeId)return;setBusy(true);try{await api('catalog-production-readiness',{action:'assign',woocommerce_product_id:product.woocommerce_product_id,disposition:'assigned',recipe_id:recipeId,notes:'Catalog Pairing Workbench: draft association; physical sample and approved revision still required.'});await load();setMessage('Recipe candidate assigned. Production remains gated by recipe approval.')}catch(e){setMessage(e.message)}finally{setBusy(false)}}
 function select(p){setSelected(String(p.woocommerce_product_id));setAssetId(p.artwork?.artwork_asset_id||'');setRecipeId(p.recipe_id||'');setEvidence('');setConfirm(false);setUploadName(p.product_name||'');setRecipeName((p.product_name||'Product')+' · DTF · Draft')}
 async function initializeQueue(){if(!canManage)return;setBusy(true);try{const result=await api('catalog-production-readiness',{action:'seed_candidates'});await load();setMessage('Created '+result.created+' missing review assignments; '+result.existing+' were already present. No production mapping approved.')}catch(e){setMessage(e.message)}finally{setBusy(false)}}
 function downloadAudit(){const records=list.map(x=>[x.woocommerce_product_id,x.product_name,x.flags?.artwork?'verified':'review',x.flags?.recipe?'approved':'review',x.score]);const csv=[['woo_product_id','product_name','artwork_status','recipe_status','readiness_score'],...records].map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\r\n');const blob=new Blob([csv],{type:'text/csv'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='skilled-crafting-catalog-pairing-audit.csv';a.click();URL.revokeObjectURL(url)}
 return <main className="page sc-pairing"><header className="page-header"><div><p className="eyebrow">Production · Existing products</p><h1>Catalog Artwork & Recipe Pairing</h1><p>Review every synced WooCommerce family, find likely artwork and recipe matches, and save only evidence-backed associations. No bulk guessed approvals or customer-facing activation.</p></div><button type="button" disabled={busy} onClick={load}>Refresh catalog</button></header>
 {message&&<p role="status" className="message">{message}</p>}
 <div className="sc-pairing-stats"><div><strong>{stats.total}</strong> families indexed</div><div><strong>{stats.withArtwork}</strong> artwork reviewed</div><div><strong>{stats.withRecipe}</strong> approved recipe</div><div><strong>{stats.review}</strong> require review</div></div>
 <div className="sc-pairing-toolbar"><label>Search Woo product, name or SKU<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Marcus Whitman, team or SKU"/></label><button type="button" disabled={!canManage||busy||!catalog} onClick={initializeQueue}>Create missing product review records</button><button type="button" disabled={!catalog} onClick={downloadAudit}>Export full review CSV</button></div>
 <div className="sc-pairing-layout"><div className="sc-pairing-list">{list.map(p=><button type="button" key={p.woocommerce_product_id} className={selected===String(p.woocommerce_product_id)?'selected':''} onClick={()=>select(p)}><strong>{p.product_name}</strong><small>Woo #{p.woocommerce_product_id} · {p.score}% ready · {p.row_count} synced rows</small><small>Artwork {p.flags?.artwork?'✓':'review'} · Recipe {p.flags?.recipe?'✓':'review'}</small></button>)}</div>
 <section className="card sc-pairing-detail">{!product?<p>Select a synced product family to inspect proposed matches. Products missing from sync require WooCommerce catalog synchronization first.</p>:<>
 <h2>{product.product_name}</h2><p>Woo parent #{product.woocommerce_product_id} · {product.variation_count} catalog variation IDs. Mapping at parent level does not prove each variation is correctly configured.</p>
 <p><strong>Artwork:</strong> {product.artwork?.artwork_asset_id?'Linked '+product.artwork.artwork_asset_id:'No reviewed link'}</p>
 <h3>1. Upload missing artwork</h3><p>New artwork is saved in a private R2-backed Mockup Studio project with pending preflight. Uploading does not mark it approved or link it to WooCommerce.</p>
 <label>Artwork file<input type="file" accept=".png,.jpg,.jpeg,.webp,.svg,.pdf" onChange={e=>setUploadFile(e.target.files?.[0]||null)}/></label>
 <label>Artwork display name<input value={uploadName} onChange={e=>setUploadName(e.target.value)}/></label>
 <button type="button" disabled={!canManage||busy||!uploadFile} onClick={uploadNewArtwork}>Upload artwork to private R2 · draft</button>
 <p><Link to="/mockup-studio">Open Mockup Studio to check technical preflight and file</Link></p>
 <h3>2. Review exact artwork link</h3>
 <label>Artwork file (passed technical preflight)<select value={assetId} onChange={e=>{setAssetId(e.target.value);setConfirm(false)}}><option value="">Select verified file</option>{(catalog?.assets||[]).map(a=><option key={a.id} value={a.id}>{a.artwork_name}{matches.assets.some(m=>m.id===a.id)?' · possible name match':''}</option>)}</select></label>
 <p><small>{matches.assets.length?matches.assets.map(a=>a.artwork_name).join(' · '):'No name-based artwork candidates. Search your artwork library and upload the exact file.'} Name similarity is not proof of client approval.</small></p>
 <label>Approval evidence<textarea rows={2} placeholder="Approval date, customer proof, artwork identity and reviewer details" value={evidence} onChange={e=>setEvidence(e.target.value)}/></label>
 <label className="sc-pairing-confirm"><input type="checkbox" checked={confirm} onChange={e=>setConfirm(e.target.checked)}/> I personally verified this exact approved artwork for this product.</label>
 <button type="button" disabled={!canManage||busy||!assetId||!confirm||evidence.trim().length<12} onClick={saveArtwork}>Save reviewed artwork link</button>
 <hr/><h3>3. Create a missing production recipe</h3><p>Create a reusable starter recipe for this WooCommerce product. Both Adult and Youth are drafts; measured heights, exact placement offsets and application settings must be reviewed in the full recipe editor.</p>
 <label>Recipe name<input value={recipeName} onChange={e=>setRecipeName(e.target.value)}/></label>
 <label>Decoration method<select value={method} onChange={e=>setMethod(e.target.value)}><option value="DTF">DTF</option><option value="HTV">HTV</option><option value="Sublimation">Sublimation</option><option value="UV">UV</option><option value="Laser">Laser</option></select></label>
 <label>Garment type<select value={garment} onChange={e=>setGarment(e.target.value)}><option value="hoodie">Hoodie</option><option value="tee">T-shirt</option><option value="sweatshirt">Sweatshirt</option><option value="polo">Polo</option><option value="other">Other</option></select></label>
 <div className="sc-pairing-dimensions"><label>Adult front print width (inches)<input type="number" min="0.1" max="24" step="0.125" value={adultWidth} onChange={e=>setAdultWidth(e.target.value)}/></label><label>Youth front print width (inches)<input type="number" min="0.1" max="24" step="0.125" value={youthWidth} onChange={e=>setYouthWidth(e.target.value)}/></label></div>
 <button type="button" disabled={!canManage||busy||!recipeName.trim()} onClick={createDraftRecipe}>Create draft recipe for this product</button>
 <hr/><h3>4. Pair existing or newly created recipe</h3><p><strong>Production recipe:</strong> {product.recipe_id||'Not assigned'}</p>
 <label>Production recipe<select value={recipeId} onChange={e=>setRecipeId(e.target.value)}><option value="">Choose production recipe</option>{recipes.map(r=><option key={r.id} value={r.id}>{r.name}{matches.recipes.some(m=>m.id===r.id)?' · name match':''}</option>)}</select></label>
 <button type="button" disabled={!canManage||busy||!recipeId} onClick={saveRecipe}>Assign recipe for review</button>
 <p>Assignment does not approve a draft recipe, enable selection rules, or modify orders. Adult/youth-specific variations require separate checks.</p>
 <p><Link to="/manufacturing-recipes">Review recipe and physical sample</Link> · <Link to="/client-graphics">Graphic family bindings</Link> · <Link to="/catalog-production-readiness">Variation and readiness review</Link></p>
 </>}</section></div></main>;
}
