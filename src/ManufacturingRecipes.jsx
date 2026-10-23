import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { EmployeeAccessContext } from './lib/employeeAccessContext';
import { useContext } from 'react';
import GarmentPlacementGuide from './components/GarmentPlacementGuide';
import './ManufacturingRecipes.css';

const freshPlacement = () => ({
  placement_name:'full_front',print_width_inches:'11',print_height_inches:'11',
  top_offset_inches:'3',center_offset_inches:'0',reference_landmark:'Bottom of front collar trim',
  size_group:'Adult',instructions:'Measure placement on the actual garment before pressing.',
});
const newForm = () => ({
  id:'',name:'',garment_type:'tee',decoration_method:'DTF',notes:'',
  placements:[freshPlacement()],process_steps:[
    {label:'Verify blank size and color',instruction:'Compare garment with approved client order.'},
    {label:'Prepare artwork / transfer',instruction:'Check size, orientation and artwork version.'},
    {label:'Decorate garment',instruction:'Use the approved material and machine recipe.'},
    {label:'Inspect and pack',instruction:'Check for defects and compare with customer proof.'},
  ],
  packaging:{method:'Fold individually',labeling:'Label size',customer_notes:''},
  machine_settings_id:'',artwork_asset_id:'',production_notes:'',verified_sample:false,
});
const methods = ['DTF','HTV','Vinyl','BN2-30 Print/Cut','Omni UV','Laser','Sublimation','Other'];
const allowedPlacement = ['full_front','center_chest','left_chest','right_chest','full_back','sleeve'];

function explainError(error) {
  return error?.message || 'Request failed; check database migration and user permissions.';
}
export default function ManufacturingRecipes() {
  const access = useContext(EmployeeAccessContext);
  const editor = ['admin','manager','operator'].includes(access?.role);
  const approver = ['admin','manager'].includes(access?.role);
  const [recipes,setRecipes] = useState([]);
  const [versions,setVersions] = useState([]);
  const [materials,setMaterials] = useState([]);
  const [artworks,setArtworks] = useState([]);
  const [form,setForm] = useState(newForm);
  const [message,setMessage] = useState('');
  const [busy,setBusy] = useState(false);
  const [selectedVersion,setSelectedVersion] = useState('');
  const load = useCallback(async () => {
    const [a,b,c,d] = await Promise.all([
      supabase.from('sc_manufacturing_recipes').select('id,name,garment_type,decoration_method,notes,created_at').order('created_at',{ascending:false}).limit(250),
      supabase.from('sc_manufacturing_recipe_versions').select('*').order('created_at',{ascending:false}).limit(700),
      supabase.from('sc_material_recipes').select('id,machine_model,material_name,operation').eq('status','approved').limit(150),
      supabase.from('mockup_artwork_assets').select('id,artwork_name,preflight_status').order('created_at',{ascending:false}).limit(150),
    ]);
    if(a.error) throw a.error;
    if(b.error) throw b.error;
    setRecipes(a.data||[]);setVersions(b.data||[]);
    if(!c.error) setMaterials(c.data||[]);
    if(!d.error) setArtworks(d.data||[]);
  },[]);
  useEffect(() => { load().catch(e=>setMessage(explainError(e))); },[load]);
  const ownVersions = useMemo(()=>versions.filter(v=>v.recipe_id===form.id),[versions,form.id]);
  const current = versions.find(v=>v.id===selectedVersion);
  function change(key,value) { setForm(s=>({...s,[key]:value})); }
  function chooseRecipe(recipeId) {
    const r=recipes.find(x=>x.id===recipeId);
    if(!r) {setForm(newForm());setSelectedVersion('');return;}
    const latest=versions.filter(v=>v.recipe_id===r.id).sort((a,b)=>b.revision-a.revision)[0];
    const defaults=newForm();
    setForm({...defaults,...r,id:r.id,
      placements:latest?.placements?.length?latest.placements:[freshPlacement()],
      process_steps:latest?.process_steps?.length?latest.process_steps:defaults.process_steps,
      packaging:latest?.packaging||defaults.packaging,
      machine_settings_id:latest?.machine_settings_id||'',
      artwork_asset_id:latest?.artwork_asset_id||'',
      production_notes:latest?.production_notes||'',
      verified_sample:false,
    });
    setSelectedVersion(latest?.id||'');
  }
  function duplicateAsNewRecipe() {
    if(!form.id)return;
    const source=form.name;
    setForm(old=>({
      ...old,id:'',
      name:source.replace(/^Starter\\s*·\\s*/i,'')+' — Custom',
      placements:old.placements.map(p=>({...p})),
      process_steps:old.process_steps.map(step=>({...step})),
      packaging:{...old.packaging},
      artwork_asset_id:'',verified_sample:false,
    }));
    setSelectedVersion('');
    setMessage('Copied into a new unsaved recipe. Rename it, customize, then save. The original remains unchanged.');
  }
  function updatePlacement(i,key,value) {setForm(s=>({...s,placements:s.placements.map((x,n)=>n===i?{...x,[key]:value}:x)}));}
  function updateStep(i,key,value) {setForm(s=>({...s,process_steps:s.process_steps.map((x,n)=>n===i?{...x,[key]:value}:x)}));}
  function validate() {
    if(form.name.trim().length<2) throw Error('Enter a name for this manufacturing recipe.');
    if(!form.placements.length) throw Error('Add at least one graphic placement.');
    for(const p of form.placements) {
      for(const key of ['print_width_inches','print_height_inches']) {
        const n=Number(p[key]); if(!Number.isFinite(n)||n<=0||n>24) throw Error('Graphic dimensions must be between 0 and 24 inches.');
      }
      for(const key of ['top_offset_inches','center_offset_inches']) {
        if(!Number.isFinite(Number(p[key]))||Math.abs(Number(p[key]))>30) throw Error('Verify measured offsets; values must be within 30 inches.');
      }
      if(!p.reference_landmark?.trim())throw Error('Choose a placement reference landmark.');
    }
  }
  async function saveVersion() {
    setBusy(true);setMessage('');
    try{
      validate();
      const {data:auth,error:ae}=await supabase.auth.getUser();
      if(ae||!auth.user)throw Error('Sign in to save a recipe.');
      let recipeId=form.id;
      if(!recipeId) {
        const {data,error}=await supabase.from('sc_manufacturing_recipes')
          .insert({name:form.name.trim(),garment_type:form.garment_type,
            decoration_method:form.decoration_method,notes:form.notes,created_by:auth.user.id})
          .select('id').single();
        if(error)throw error;recipeId=data.id;
      }
      const prior=versions.filter(v=>v.recipe_id===recipeId);
      const revision=1+Math.max(0,...prior.map(v=>v.revision));
      const {data,error}=await supabase.from('sc_manufacturing_recipe_versions').insert({
        recipe_id:recipeId,revision,
        placements:form.placements.map(p=>({
          ...p,print_width_inches:Number(p.print_width_inches),
          print_height_inches:Number(p.print_height_inches),
          top_offset_inches:Number(p.top_offset_inches),center_offset_inches:Number(p.center_offset_inches),
        })),
        process_steps:form.process_steps,packaging:form.packaging,
        machine_settings_id:form.machine_settings_id||null,artwork_asset_id:form.artwork_asset_id||null,
        production_notes:form.production_notes,verified_sample:form.verified_sample,
        created_by:auth.user.id,
      }).select('id').single();
      if(error)throw error;
      await load();
      setForm(s=>({...s,id:recipeId,verified_sample:false}));
      setSelectedVersion(data.id);
      setMessage('Draft revision '+revision+' saved. Existing approved revisions and job travelers remain unchanged.');
    }catch(e){setMessage(explainError(e));}finally{setBusy(false);}
  }
  async function approve() {
    if(!current||current.status!=='draft'||!current.verified_sample)return;
    if(!window.confirm('Confirm that a physical sample has been verified and that you approve this exact immutable recipe revision?'))return;
    setBusy(true);setMessage('');
    try{
      const {data:auth,error:ae}=await supabase.auth.getUser();
      if(ae||!auth.user)throw Error('Sign in before approving.');
      const {error}=await supabase.from('sc_manufacturing_recipe_versions').update({
        status:'approved',approved_by:auth.user.id,approved_at:new Date().toISOString(),
      }).eq('id',current.id).eq('status','draft');
      if(error)throw error;
      await load();setMessage('Recipe version approved; it can now be assigned to a job traveler.');
    }catch(e){setMessage(explainError(e));}finally{setBusy(false);}
  }
  const selectedRecipe=recipes.find(r=>r.id===form.id);
  return <main className="page sc-recipe-editor">
    <div className="page-header"><div><p className="eyebrow">Production · Manufacturing recipes</p>
      <h1>Production Recipe Library</h1>
      <p>Save exact placement measurements, artwork, material settings, process steps and packing instructions. Approve only after checking a physical sample.</p></div>
      <Link to="/work-hub">← Work Hub</Link>
    </div>
    {message&&<p className="message" role="status">{message}</p>}
    <div className="sc-recipe-columns">
      <section className="card elevated-card">
        <h2>Recipe library</h2>
        <label>Load an existing template<select value={form.id} onChange={e=>chooseRecipe(e.target.value)}>
          <option value="">New recipe</option>
          {recipes.map(r=><option key={r.id} value={r.id}>{r.name} ({r.garment_type})</option>)}
        </select></label>
        {editor&&form.id&&<div className="sc-recipe-copy-action">
          <button type="button" disabled={busy} onClick={duplicateAsNewRecipe}>Duplicate as new recipe</button>
          <p><small>Copies placements and production steps. Original revisions stay unchanged; choose customer artwork for the new recipe.</small></p>
        </div>}
        <label>Recipe name<input value={form.name} disabled={!editor||Boolean(selectedRecipe)} onChange={e=>change('name',e.target.value)} placeholder="Team hoodie — DTF full front" /></label>
        <div className="sc-recipe-twocol">
          <label>Garment<select value={form.garment_type} disabled={!editor||Boolean(selectedRecipe)} onChange={e=>change('garment_type',e.target.value)}>
            {['tee','hoodie','sweatshirt','polo','other'].map(x=><option key={x}>{x}</option>)}
          </select></label>
          <label>Process<select value={form.decoration_method} disabled={!editor||Boolean(selectedRecipe)} onChange={e=>change('decoration_method',e.target.value)}>
            {methods.map(x=><option key={x}>{x}</option>)}
          </select></label>
        </div>
        <label>Recipe notes<textarea rows="2" value={form.notes} disabled={!editor||Boolean(selectedRecipe)} onChange={e=>change('notes',e.target.value)}/></label>
        <h3>Artwork and machine settings</h3>
        <label>Approved material/machine settings<select value={form.machine_settings_id} disabled={!editor} onChange={e=>change('machine_settings_id',e.target.value)}>
          <option value="">Not linked — verify manually</option>
          {materials.map(x=><option key={x.id} value={x.id}>{x.machine_model} / {x.material_name} — {x.operation}</option>)}
        </select></label>
        <label>Existing artwork asset<select value={form.artwork_asset_id} disabled={!editor} onChange={e=>change('artwork_asset_id',e.target.value)}>
          <option value="">Not linked — add approved art later</option>
          {artworks.map(x=><option key={x.id} value={x.id}>{x.artwork_name} ({x.preflight_status})</option>)}
        </select></label>
        <label>Production notes<textarea rows="3" value={form.production_notes} disabled={!editor} onChange={e=>change('production_notes',e.target.value)} placeholder="Heat press, peel/cure notes, item protection, process-specific instructions"/></label>
        <h3>Manufacturing steps</h3>
        {form.process_steps.map((step,i)=><div className="sc-recipe-step" key={i}>
          <label>Step {i+1}<input value={step.label} disabled={!editor} onChange={e=>updateStep(i,'label',e.target.value)}/></label>
          <label>Instruction<input value={step.instruction} disabled={!editor} onChange={e=>updateStep(i,'instruction',e.target.value)}/></label>
          {editor&&<button type="button" onClick={()=>change('process_steps',form.process_steps.filter((_,idx)=>idx!==i))}>Remove step</button>}
        </div>)}
        {editor&&<button type="button" onClick={()=>change('process_steps',[...form.process_steps,{label:'New step',instruction:''}])}>+ Add step</button>}
        <h3>Packaging</h3>
        <label>Method<input value={form.packaging.method||''} disabled={!editor} onChange={e=>change('packaging',{...form.packaging,method:e.target.value})}/></label>
        <label>Labeling<input value={form.packaging.labeling||''} disabled={!editor} onChange={e=>change('packaging',{...form.packaging,labeling:e.target.value})}/></label>
        <label>Special customer instructions<textarea rows="2" value={form.packaging.customer_notes||''} disabled={!editor} onChange={e=>change('packaging',{...form.packaging,customer_notes:e.target.value})}/></label>
      </section>
      <section className="card elevated-card">
        <h2>Graphic placement ruler</h2>
        <p>Diagrams are approximate. Save measurements from an actual blank; do not use the illustrations as a scale drawing.</p>
        {form.placements.map((p,i)=><div className="sc-recipe-placement" key={i}>
          <div className="sc-recipe-twocol">
            <label>Position<select value={p.placement_name} disabled={!editor} onChange={e=>updatePlacement(i,'placement_name',e.target.value)}>
              {allowedPlacement.map(x=><option key={x} value={x}>{x.replaceAll('_',' ')}</option>)}
            </select></label>
            <label>Garment size group<input value={p.size_group} disabled={!editor} onChange={e=>updatePlacement(i,'size_group',e.target.value)}/></label>
            <label>Graphic width (in)<input type="number" step=".125" min=".1" max="24" value={p.print_width_inches} disabled={!editor} onChange={e=>updatePlacement(i,'print_width_inches',e.target.value)}/></label>
            <label>Graphic height (in)<input type="number" step=".125" min=".1" max="24" value={p.print_height_inches} disabled={!editor} onChange={e=>updatePlacement(i,'print_height_inches',e.target.value)}/></label>
            <label>Top-edge offset (in)<input type="number" step=".125" value={p.top_offset_inches} disabled={!editor} onChange={e=>updatePlacement(i,'top_offset_inches',e.target.value)}/></label>
            <label>Horizontal offset (in)<input type="number" step=".125" value={p.center_offset_inches} disabled={!editor} onChange={e=>updatePlacement(i,'center_offset_inches',e.target.value)}/></label>
          </div>
          <label>Offset reference landmark<input value={p.reference_landmark} disabled={!editor} onChange={e=>updatePlacement(i,'reference_landmark',e.target.value)}/></label>
          <label>Position-specific instructions<textarea rows="2" value={p.instructions} disabled={!editor} onChange={e=>updatePlacement(i,'instructions',e.target.value)}/></label>
          <GarmentPlacementGuide blank={{asset_name:form.garment_type,product_view:p.placement_name}} placement={p}/>
          <p><strong>Measured top offset:</strong> {p.top_offset_inches} in from {p.reference_landmark} · <strong>Horizontal:</strong> {p.center_offset_inches} in relative to the named placement centerline.</p>
          {editor&&<button type="button" onClick={()=>change('placements',form.placements.filter((_,idx)=>idx!==i))}>Remove placement</button>}
        </div>)}
        {editor&&<button type="button" onClick={()=>change('placements',[...form.placements,freshPlacement()])}>+ Add graphic location</button>}
        <h3>{form.id?'Save a new revision':'Create a new recipe'}</h3>
        {editor&&<label className="sc-recipe-check"><input type="checkbox" checked={form.verified_sample} onChange={e=>change('verified_sample',e.target.checked)}/>I physically measured and verified the sample for this revision</label>}
        <p>Saved revisions do not change when you edit this form. Create a new revision for all adjustments; previous travelers retain the original approved details.</p>
        {editor&&<button type="button" disabled={busy} onClick={saveVersion}>{busy?'Saving…':form.id?'Save new draft revision':'Create recipe and draft'}</button>}
        <h3>Version history</h3>
        <select aria-label="Review saved revision" value={selectedVersion} onChange={e=>setSelectedVersion(e.target.value)}>
          <option value="">Choose revision</option>
          {ownVersions.map(v=><option value={v.id} key={v.id}>Revision {v.revision} — {v.status}{v.verified_sample?' · sample checked':''}</option>)}
        </select>
        {current&&<div className="sc-recipe-version"><p><strong>Revision {current.revision}</strong> · {current.status}</p>
          <p>Sample verified: {current.verified_sample?'Yes':'No'} · placements: {current.placements.length}</p>
          {approver&&current.status==='draft'&&current.verified_sample&&
            <button type="button" disabled={busy} onClick={approve}>Approve verified revision</button>}
          {current.status==='approved'&&<Link to="/production-travelers">Use this revision on a job traveler →</Link>}
        </div>}
      </section>
    </div>
  </main>;
}
