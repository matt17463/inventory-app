import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabaseClient';
import { EmployeeAccessContext } from './lib/employeeAccessContext';
import { authenticatedFunctionFetch } from './lib/netlifyFunctionClient';
import { shouldSimulateWrites } from './lib/testingMode';
import { MACHINE_TYPES, SETTING_FIELDS, OPERATION_LABELS, formatRecipeCSV, machineFor, materialSafety, normalizeSettingsJson } from './lib/materialSettings';
import './MaterialSettings.css';
import { Link } from 'react-router-dom';
import { OMNI_PRODUCTS, OMNI_DEVICE } from './lib/omniKnowledge';

const blank = () => ({
  id:null, machine_type:'mopa_fiber',machine_model:'',machine_configuration:'',operation:'color_engrave',
  material_name:'',material_brand:'',material_sku:'',material_finish:'',thickness_mm:'',
  material_notes:'',source_type:'manual',source_url:'',safety_notes:'',settings:'{\n  \n}'
});
const fieldNames = [
  ['machine_model','Exact machine model'],['machine_configuration','Wattage / module / press or ink configuration'],
  ['material_name','Material / item'],['material_brand','Supplier / brand'],['material_sku','Supplier SKU'],
  ['material_finish','Surface finish / coating'],['thickness_mm','Thickness (mm, when relevant)'],
  ['material_notes','Material and process notes'],['source_url','Manufacturer or verified source URL'],
  ['safety_notes','Safety / preparation notes']
];
function errorText(error) {
  const msg=error?.message||'An unexpected error occurred.';
  if(/does not exist|schema cache|PGRST205/i.test(msg))return 'The material-settings database migration has not been applied yet.';
  return msg;
}
function saveCSV(csv){
  const a=document.createElement('a');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  a.href=url;a.download='skilled-crafting-material-recipes.csv';a.click();
  window.setTimeout(()=>URL.revokeObjectURL(url),3000);
}
export default function MaterialSettings(){
  const access=useContext(EmployeeAccessContext);
  const admin=['admin','manager'].includes(access?.role);
  const canWrite=['admin','manager','operator'].includes(access?.role);
  const [rows,setRows]=useState([]);
  const [trialRows,setTrialRows]=useState([]);
  const [form,setForm]=useState(blank);
  const [search,setSearch]=useState('');
  const [filterMachine,setFilterMachine]=useState('all');
  const [trial,setTrial]=useState({result:'needs_adjustment',observations:'',measurement:'{}'});
  const [ai,setAi]=useState(null);
  const [research,setResearch]=useState(null);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [currentTab,setCurrentTab]=useState('library');
  const [sourceLinks,setSourceLinks]=useState('');
  const machine=machineFor(form.machine_type);
  const safety=materialSafety(form.machine_type,form.material_name);
  const currentValues=useMemo(()=>{try{return normalizeSettingsJson(form.settings);}catch{return {}; }},[form.settings]);
  const visible=useMemo(()=>rows.filter(r=>(filterMachine==='all'||r.machine_type===filterMachine)&&
    [r.material_name,r.material_brand,r.material_sku,r.machine_model,r.operation].join(' ').toLowerCase().includes(search.toLowerCase())),[rows,search,filterMachine]);
  const load=useCallback(async()=>{
    const a=await supabase.from('sc_material_recipes').select('*').order('updated_at',{ascending:false}).limit(600);
    if(a.error)throw a.error;
    setRows(a.data||[]);
  },[]);
  useEffect(()=>{
    let alive=true;
    load().catch(e=>{if(alive)setMessage(errorText(e));});
    const params=new URLSearchParams(window.location.search);
    const seed=OMNI_PRODUCTS.find(x=>x.id===params.get('seed'));
    const recipeId=params.get('recipe');
    if(seed){
      const officialPreset=seed.id==='slate'?
        {studio_mode:'UV flatbed / Flat',ink_white_mode:'White+Color',white_layers:2,color_layers:1}:
        seed.id==='acrylic'?{studio_mode:'UV flatbed / Texture',target_relief_mm:0.6,texture_smoothness:1}:{};
      setForm({...blank(),machine_type:'xtool_omni',machine_model:OMNI_DEVICE.name,
        machine_configuration:OMNI_DEVICE.edition,operation:seed.operation,material_name:seed.name,
        material_notes:seed.steps.join('\\n'),source_type:['slate','acrylic'].includes(seed.id)?'manufacturer':'manual',
        source_url:seed.source,safety_notes:seed.primer+'; '+seed.accessory,
        settings:JSON.stringify(officialPreset,null,2)});
      setCurrentTab('editor');
      setMessage('Unapproved starter loaded from the device library. Confirm the exact blank and run a physical trial before manager approval.');
    } else if(recipeId && /^[0-9a-f-]{36}$/i.test(recipeId)){
      supabase.from('sc_material_recipes').select('*').eq('id',recipeId).single().then(({data,error})=>{
       if(!alive)return;
       if(error)setMessage(errorText(error));
       else{setForm({...data,thickness_mm:data.thickness_mm??'',settings:JSON.stringify(data.settings||{},null,2)});setCurrentTab('editor');loadTrials(data.id);}
      });
    }
    return()=>{alive=false;};
   },[load]);
  const set=(key,value)=>setForm(p=>({...p,[key]:value}));
  const setMachineSetting=(key,value)=>{try{const settings=normalizeSettingsJson(form.settings);if(value==='')delete settings[key];else settings[key]=value;set('settings',JSON.stringify(settings,null,2));}catch{setMessage('Repair invalid settings JSON before editing individual machine fields.');}};
  const edit=(record)=>{
    setForm({...record,thickness_mm:record.thickness_mm??'',settings:JSON.stringify(record.settings||{},null,2)});
    setAi(null);setCurrentTab('editor');
    setMessage('Loaded a saved recipe. Any modifications must be re-tested before production.');
    loadTrials(record.id);
  };
  async function loadTrials(id){
    if(!id){setTrialRows([]);return;}
    const {data,error}=await supabase.from('sc_material_recipe_trials').select('*').eq('recipe_id',id).order('created_at',{ascending:false}).limit(100);
    if(error)setMessage(errorText(error));else setTrialRows(data||[]);
  }
  async function saveRecord(){
    if(!canWrite)return setMessage('Read-only access.');
    if(safety.blocked)return setMessage(safety.reason);
    if(!form.material_name.trim()||!form.machine_model.trim()||!form.machine_configuration.trim())return setMessage('Complete the material, exact model and machine configuration.');
    setBusy(true);setMessage('');
    try{
      const settings=normalizeSettingsJson(form.settings);
      const payload={
        machine_type:form.machine_type,machine_model:form.machine_model.trim(),machine_configuration:form.machine_configuration.trim(),
        operation:form.operation,material_name:form.material_name.trim(),material_brand:form.material_brand,material_sku:form.material_sku,
        material_finish:form.material_finish,material_notes:form.material_notes,safety_notes:form.safety_notes,
        thickness_mm:form.thickness_mm?Number(form.thickness_mm):null,settings,
        source_type:form.source_type,source_url:form.source_url,
        status:'draft',approved_by:null,approved_at:null,updated_at:new Date().toISOString(),
      };
      if(payload.thickness_mm!==null&&(!(payload.thickness_mm>0)||payload.thickness_mm>=300))throw Error('Thickness must be between 0 and 300 mm.');
      if(shouldSimulateWrites()){setMessage('Training mode: settings validated; no database changes made.');return;}
      let result;
      if(form.id){
        result=await supabase.from('sc_material_recipes').update({...payload,version:(form.version||1)+1}).eq('id',form.id).eq('version',form.version).select().single();
      }else{
        result=await supabase.from('sc_material_recipes').insert(payload).select().single();
      }
      if(result.error)throw result.error;
      setForm({...result.data,settings:JSON.stringify(result.data.settings||{},null,2)});
      await load();await loadTrials(result.data.id);
      setMessage('Draft saved. Record a physical trial before manager approval.');
    }catch(e){setMessage(errorText(e));}finally{setBusy(false);}
  }
  async function recordTrial(){
    if(!form.id)return setMessage('Save the recipe before recording a trial.');
    setBusy(true);setMessage('');
    try{
      const measurement=normalizeSettingsJson(trial.measurement);
      if(!trial.observations.trim())throw Error('Describe the actual result, test method and material lot.');
      if(shouldSimulateWrites()){setMessage('Training mode: test recorded locally only; database unchanged.');return;}
      const {error}=await supabase.from('sc_material_recipe_trials').insert({
        recipe_id:form.id,recipe_version:form.version||1,result:trial.result,observations:trial.observations.trim(),measurement,
        observed_settings:normalizeSettingsJson(form.settings)
      });
      if(error)throw error;setTrial({result:'needs_adjustment',observations:'',measurement:'{}'});
      await loadTrials(form.id);setMessage('Physical test result saved.');
    }catch(e){setMessage(errorText(e));}finally{setBusy(false);}
  }
  async function approve(){
    if(!admin||!form.id)return;
    if(!window.confirm('Approve this physically tested recipe for repeat production?'))return;
    setBusy(true);
    try{
      if(shouldSimulateWrites()){setMessage('Training mode: approval simulated; no data updated.');return;}
      const {error}=await supabase.rpc('sc_approve_material_recipe',{p_recipe_id:form.id});
      if(error)throw error;
      await load();
      const {data,error:re}=await supabase.from('sc_material_recipes').select('*').eq('id',form.id).single();
      if(re)throw re;setForm({...data,settings:JSON.stringify(data.settings||{},null,2)});
      setMessage('Manager approval saved. Use exact matching machines, lots and materials.');
    }catch(e){setMessage(errorText(e));}finally{setBusy(false);}
  }
  async function suggest(){
    if(safety.blocked)return setMessage(safety.reason);
    if(!form.material_name||!form.machine_model||!form.machine_configuration)return setMessage('Enter material, exact model and machine configuration first.');
    setBusy(true);setMessage('Preparing an AI test plan, not an approved production setting...');
    try{
      const sources=sourceLinks.split('\n').filter(Boolean).slice(0,4).map(s=>({label:'Reference supplied by operator',url:s.trim(),verified:false}));
      const res=await authenticatedFunctionFetch('/.netlify/functions/material-settings-ai',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({...form,notes:form.material_notes,sources})
      });
      const data=await res.json().catch(()=>({}));
      if(!res.ok)throw Error(data.message||'Settings AI unavailable.');
      setAi(data);setMessage('Unverified AI plan prepared. Review against machine and substrate manuals before testing.');
    }catch(e){setMessage(errorText(e));}finally{setBusy(false);}
  }

  async function researchSources(){
    if(safety.blocked)return setMessage(safety.reason);
    if(!form.material_name||!form.machine_model||!form.machine_configuration)
      return setMessage('Identify the exact material and equipment configuration first.');
    setBusy(true);setMessage('Researching live manufacturer and supplier instructions...');
    try{
      const response=await authenticatedFunctionFetch('/.netlify/functions/material-settings-ai',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({...form,mode:'research',notes:form.material_notes})
      });
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload.message||'Live research failed.');
      setResearch(payload);
      setMessage('Research complete. Verify the cited instructions apply to your exact machine and material before any test.');
    }catch(e){setMessage(errorText(e));}finally{setBusy(false);}
  }

  function adoptSuggestion(){
    if(!ai)return;
    set('settings',JSON.stringify(ai.candidate_settings||{},null,2));
    setForm(p=>({...p,settings:JSON.stringify(ai.candidate_settings||{},null,2),source_type:'ai_suggested',status:'draft',source_url:''}));
    setMessage('Candidate copied into the editable draft; not verified or approved.');
  }
  return <main className="page sc-materials">
    <header className="page-header"><div><p className="eyebrow">SKILLED CRAFTING / WORKSHOP</p><h1>Equipment Settings & Material Recipes</h1>
      <p>Find settings by material, machine, module and process. AI plans are unverified until tested and approved.</p><p><Link to="/device-product-library">Browse product guides, Omni setup, troubleshooting and maintenance →</Link></p>
    </div><div className="sc-material-actions"><button type="button" className="secondary-button" onClick={()=>{load().catch(e=>setMessage(errorText(e)));}}>Refresh</button>
      <button type="button" className="secondary-button" onClick={()=>saveCSV(visible)}>Export CSV</button></div></header>
    {message&&<p className="sc-material-message" role="status">{message}</p>}
    <nav className="sc-material-tabs"><button onClick={()=>setCurrentTab('library')} className={currentTab==='library'?'active':''}>Recipe library</button>
      <button onClick={()=>{setCurrentTab('editor');setForm(blank());setTrialRows([]);setAi(null);}} className={currentTab==='editor'?'active':''}>New recipe / AI assistant</button></nav>
    {currentTab==='library'?<section className="card"><div className="sc-material-filter"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search material, SKU, machine or operation" aria-label="Search recipes"/>
      <select value={filterMachine} onChange={e=>setFilterMachine(e.target.value)} aria-label="Filter machine"><option value="all">All machines</option>{MACHINE_TYPES.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}</select></div>
      <div className="sc-material-table"><table><thead><tr><th>Material</th><th>Machine</th><th>Process</th><th>Source</th><th>Validation</th><th>Action</th></tr></thead><tbody>{visible.map(r=><tr key={r.id}>
        <td><strong>{r.material_name}</strong><small>{[r.material_brand,r.material_sku,r.material_finish].filter(Boolean).join(' · ')}</small></td>
        <td>{machineFor(r.machine_type).label}<small>{r.machine_model}</small></td><td>{OPERATION_LABELS[r.operation]}</td>
        <td>{r.source_type}</td><td><span className={'sc-recipe-status '+r.status}>{r.status}</span></td>
        <td><button type="button" className="secondary-button" onClick={()=>edit(r)}>Open</button></td></tr>)}</tbody></table>
      {!visible.length&&<p>No matching recipes. Create an experimental recipe or import verified settings manually.</p>}</div></section>:
    <div className="sc-material-layout"><section className="card sc-material-editor">
      <h2>{form.id?'Edit material recipe':'Create material recipe'}</h2>
      <div className="sc-material-grid"><label>Equipment type<select value={form.machine_type} onChange={e=>{const m=machineFor(e.target.value);setForm(p=>({...p,machine_type:m.id,operation:m.modes[0]}));}}>
        {MACHINE_TYPES.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}</select></label>
        <label>Process<select value={form.operation} onChange={e=>set('operation',e.target.value)}>{machine.modes.map(m=><option key={m} value={m}>{OPERATION_LABELS[m]}</option>)}</select></label>
        {fieldNames.map(([name,label])=><label key={name}>{label}{['material_notes','safety_notes'].includes(name)?
          <textarea rows={2} value={form[name]||''} onChange={e=>set(name,e.target.value)}/>:
          <input type={name==='thickness_mm'?'number':'text'} step={name==='thickness_mm'?'0.01':undefined} value={form[name]||''} onChange={e=>set(name,e.target.value)}/>}</label>)}
        <label>Evidence classification<select value={form.source_type} onChange={e=>set('source_type',e.target.value)}>{['manual','manufacturer','supplier','ai_suggested','prior_test'].map(x=><option key={x} value={x}>{x}</option>)}</select></label>
      </div>
      <p className="sc-material-help">{machine.note}</p>
      {safety.blocked?<p className="sc-material-danger" role="alert">{safety.reason}</p>:<p className="sc-material-warning">{safety.warning}</p>}
      <h3>Machine-specific settings</h3><p className="sc-material-help">Enter verified manufacturer values or values from your own test coupon. Leave unknown values empty. No fields are automatically assumed safe.</p>
      <div className="sc-material-grid">
      {(SETTING_FIELDS[form.machine_type]||[]).map(([key,label])=><label key={key}>{label}
        <input type="text" value={String(currentValues[key]??'')} onChange={e=>setMachineSetting(key,e.target.value)}/></label>)}
      </div>
      <details><summary>Advanced settings JSON (optional)</summary><label className="sc-material-json">Editable machine settings (JSON — include units)<textarea rows={8} spellCheck={false} value={form.settings} onChange={e=>set('settings',e.target.value)}/></label></details>
      <div className="sc-material-actions"><button className="primary-button" type="button" disabled={busy||!canWrite||safety.blocked} onClick={saveRecord}>Save experimental draft</button>
       <button className="secondary-button" type="button" disabled={busy||!canWrite||safety.blocked} onClick={suggest}>AI test plan</button>
       <button className="secondary-button" type="button" disabled={busy||!canWrite||safety.blocked} onClick={researchSources}>Research manufacturer settings online</button>
       {admin&&form.id&&form.status!=='approved'&&<button className="secondary-button" type="button" disabled={busy||!trialRows.some(x=>x.result==='pass' && x.recipe_version===form.version)} onClick={approve}>Approve tested recipe</button>}</div>
      {form.id&&<p className="sc-material-help">Status: <strong>{form.status}</strong> · Version {form.version} · {form.approved_at?'Approved '+new Date(form.approved_at).toLocaleDateString():'Not production approved'}</p>}
    </section>
    <div className="sc-material-aside">
      <section className="card"><h2>AI settings researcher</h2><p>The research tool searches current manufacturer/supplier sources. The test-plan tool prepares cautious candidate settings. Verify citations, model/module, and substrate before trying any setting.</p>
        <label>Relevant manufacturer reference links (one per line)<textarea rows={3} value={sourceLinks} onChange={e=>setSourceLinks(e.target.value)}/></label>
        {research&&<div className="sc-material-ai">
          <h3>Current source research</h3><p className="sc-material-warning">{research.evidence_note}</p>
          <div style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{research.research}</div>
          {research.references?.length>0&&<><h4>Cited sources</h4><ul>{research.references.map((ref,i)=><li key={i}>
            <a href={ref.url} rel="noopener noreferrer" target="_blank">{ref.label||ref.url}</a> · verify exact product match
          </li>)}</ul></>}
        </div>}
        {ai&&<div className="sc-material-ai"><h3>{ai.summary}</h3><p>{ai.evidence_note}</p>
          {!!ai.test_steps?.length&&<><h4>Test checklist</h4><ol>{ai.test_steps.map((s,i)=><li key={i}>{s}</li>)}</ol></>}
          {!!ai.warnings?.length&&<><h4>Warnings</h4><ul>{ai.warnings.map((s,i)=><li key={i}>{s}</li>)}</ul></>}
          <pre>{JSON.stringify(ai.candidate_settings||{},null,2)}</pre><button type="button" onClick={adoptSuggestion}>Copy candidate into draft</button>
        </div>}
      </section>
      <section className="card"><h2>Physical test log</h2>
        {!form.id?<p>Save the draft to attach tests and photographs.</p>:<>
        <label>Outcome<select value={trial.result} onChange={e=>setTrial(p=>({...p,result:e.target.value}))}>{['needs_adjustment','fail','pass'].map(x=><option value={x} key={x}>{x}</option>)}</select></label>
        <label>Results, machine conditions and material lot<textarea rows={3} value={trial.observations} onChange={e=>setTrial(p=>({...p,observations:e.target.value}))}/></label>
        <label>Measurements (JSON with units)<textarea rows={3} spellCheck={false} value={trial.measurement} onChange={e=>setTrial(p=>({...p,measurement:e.target.value}))}/></label>
        <button className="primary-button" type="button" disabled={busy||!canWrite} onClick={recordTrial}>Record test</button>
        {trialRows.map(t=><article className="sc-material-trial" key={t.id}><strong>{t.result}</strong> · {new Date(t.created_at).toLocaleString()}<p>{t.observations}</p></article>)}
        </>}
      </section>
    </div></div>}
  </main>;
}
