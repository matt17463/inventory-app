import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { EmployeeAccessContext } from './lib/employeeAccessContext';
import { supabase } from './supabaseClient';
import { shouldSimulateWrites } from './lib/testingMode';
import { materialSafety } from './lib/materialSettings';
import { LASER_PRESETS,generateHeightmap,fromAiDepth,paintHeightmap,renderHeightmap,renderReliefPreview,
  grayscaleImageData,export16BitPng,stlRelief,svgCutOutline,downloadBlob } from './lib/laserReliefEngine';
import { inferDepth } from './lib/laserDepthAi';
import { listLaserAssets,uploadLaserAsset,readLaserAsset,signedLaserAsset } from './lib/laserAssets';
import './LaserReliefStudio.css';

const baseSettings={widthMm:38.1,heightMm:38.1,depthMm:0.35,mode:'logo',invert:false,
 detail:40,smoothing:1,bevel:8,contrast:1.2,material:'brass'};
const draft=()=>({id:null,title:'New Laser Relief',status:'draft',machine_type:'mopa_fiber',material_name:'brass',
 preset:'coin',material_recipe_id:'',job_id:'',customer_id:'',artwork_request_id:''});
const MACHINES=[['mopa_fiber','60W MOPA fiber / LightBurn'],['xtool_p2','xTool P2 CO₂'],['xtool_s1','xTool S1 diode / IR'],['xtool_omni','xTool Omni UV (depth map reuse)']];
const MATERIALS=[['brass','Brass'],['steel','Stainless steel'],['wood','Wood'],['slate','Slate'],['other','Other / custom']];
const imageBlob=(canvas,type='image/png')=>new Promise((resolve,reject)=>
 canvas.toBlob(blob=>blob?resolve(blob):reject(Error('Cannot create image export')),type));
const readImage=async(blob)=>{
 const bitmap=await createImageBitmap(blob);
 const scale=Math.min(1,512/Math.max(bitmap.width,bitmap.height));
 const cv=document.createElement('canvas');cv.width=Math.max(1,Math.round(bitmap.width*scale));cv.height=Math.max(1,Math.round(bitmap.height*scale));
 const cx=cv.getContext('2d',{willReadFrequently:true});cx.clearRect(0,0,cv.width,cv.height);cx.drawImage(bitmap,0,0,cv.width,cv.height);
 bitmap.close?.();
 return {data:cx.getImageData(0,0,cv.width,cv.height),canvas:cv};
};
const safeName=value=>String(value||'laser-relief').toLowerCase().replace(/[^a-z0-9-]+/g,'-').slice(0,45)||'laser-relief';
function Section({title,children}){return <section className="sc-laser-panel"><h2>{title}</h2>{children}</section>;}
function Slider({label,min,max,step=1,value,onChange,unit=''}){return <label className="sc-laser-range"><span>{label}<strong>{value}{unit}</strong></span>
 <input type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(Number(e.target.value))}/></label>;}

export default function LaserReliefStudio(){
 const [params]=useSearchParams(),access=useContext(EmployeeAccessContext);
 const canEdit=['admin','manager','operator'].includes(access?.role);
 const manager=['admin','manager'].includes(access?.role);
 const [project,setProject]=useState(()=>({...draft(),job_id:/^\d+$/.test(params.get('job')||'')?params.get('job'):''}));
 const [settings,setSettings]=useState(baseSettings);
 const [source,setSource]=useState(null),[map,setMap]=useState(null);
 const [assets,setAssets]=useState([]),[projects,setProjects]=useState([]),[recipes,setRecipes]=useState([]);
 const [jobs,setJobs]=useState([]),[tests,setTests]=useState([]);
 const [message,setMessage]=useState('Choose a preset and import a photo, logo, or prebuilt grayscale depth map.');
 const [busy,setBusy]=useState(false),[yaw,setYaw]=useState(22),[pitch,setPitch]=useState(55);
 const [brush,setBrush]=useState({tool:'raise',radius:15,strength:0.12});
 const [trial,setTrial]=useState({result:'needs_adjustment',measured_depth_mm:'',notes:''});
 const [aiLoading,setAiLoading]=useState(false);
 const [showLibrary,setShowLibrary]=useState(true);
 const sourceCanvas=useRef(null),depthCanvas=useRef(null),threeCanvas=useRef(null),pointerDown=useRef(false);
 const undoStack=useRef([]),redoStack=useRef([]);
 const active=project.status==='draft'||project.status==='proof';
 const canWrite=canEdit&&active&&!shouldSimulateWrites();
 const warn=materialSafety(project.machine_type,project.material_name);
 const matchRecipes=recipes.filter(r=>r.machine_type===project.machine_type);
 const change=(key,value)=>setProject(old=>({...old,[key]:value}));
 const setting=(key,value)=>setSettings(old=>({...old,[key]:value}));
 const resetHistory=()=>{undoStack.current=[];redoStack.current=[];};
 const checkpoint=()=>{if(!map)return;undoStack.current=[...undoStack.current.slice(-11),map];redoStack.current=[];};
 const loadLists=useCallback(async()=>{
   const [p,r,j]=await Promise.all([
     supabase.from('sc_laser_projects').select('*').order('updated_at',{ascending:false}).limit(100),
     supabase.from('sc_material_recipes').select('id,machine_type,machine_model,material_name,status,operation').eq('status','approved').in('machine_type',['mopa_fiber','xtool_s1','xtool_p2','xtool_omni']).limit(300),
     supabase.from('jobs').select('id,job_name,customer_name,status').order('created_at',{ascending:false}).limit(150)
   ]);
   if(p.error)throw p.error;
   setProjects(p.data||[]);if(!r.error)setRecipes(r.data||[]);if(!j.error)setJobs(j.data||[]);
 },[]);
 useEffect(()=>{loadLists().catch(e=>setMessage('Laser projects unavailable: '+e.message));},[loadLists]);
 useEffect(()=>{
   if(sourceCanvas.current&&source){
     sourceCanvas.current.width=source.width;sourceCanvas.current.height=source.height;
     sourceCanvas.current.getContext('2d').putImageData(source,0,0);
   }
 },[source]);
 useEffect(()=>{
   if(!map)return;
   renderHeightmap(depthCanvas.current,map);
   renderReliefPreview(threeCanvas.current,map,{yaw,pitch,...settings});
 },[map,yaw,pitch,settings]);
 const applyMode=()=>{
   if(!source)return setMessage('Import a source image first.');
   try{checkpoint();setMap(generateHeightmap(source,settings));setMessage('Depth regenerated. Brush edits can be undone.');}
   catch(e){setMessage(e.message);}
 };
 const importSource=async(file)=>{
   if(!file)return;
   if(!file.type.startsWith('image/'))return setMessage('Upload a supported raster image (PNG, JPEG, or WebP).');
   if(file.size>20_000_000)return setMessage('Source images must be smaller than 20 MB.');
   setBusy(true);
   try{
    const x=await readImage(file);resetHistory();setSource(x.data);setMap(generateHeightmap(x.data,settings));
    setMessage('Imported '+file.name+' and generated an editable relative-depth map.');
   }catch(e){setMessage(e.message);}finally{setBusy(false);}
 };
 const importDepth=async(file)=>{
   if(!file)return;
   setBusy(true);
   try{
     const x=await readImage(file);
     if(!source||source.width!==x.data.width||source.height!==x.data.height){
       setSource(x.data);
     }
     const mask=new Uint8Array(x.data.width*x.data.height);mask.fill(1);
     const values=new Float32Array(mask.length);
     for(let i=0;i<values.length;i++)values[i]=x.data.data[i*4]/255;
     checkpoint();setMap({width:x.data.width,height:x.data.height,values,mask,source:'imported'});
     setting('mode','grayscale');setMessage('Imported a grayscale heightmap. White is high; black is low.');
   }catch(e){setMessage(e.message);}finally{setBusy(false);}
 };
 const generateAI=async()=>{
   if(!source||!sourceCanvas.current)return setMessage('Import an image first.');
   setAiLoading(true);
   try{
     const gray=await inferDepth(sourceCanvas.current,{onStatus:setMessage});
     checkpoint();setMap(fromAiDepth(source,gray,source.width,source.height,{invert:settings.invert,smoothing:settings.smoothing}));
     setting('mode','ai');
     setMessage('AI depth generated locally. Review outlines and adjust by hand before engraving. Relative depth is not a millimeter measurement.');
   }catch(e){setMessage('AI model unavailable: '+e.message+'. Use photo, logo, or grayscale modes instead.');}
   finally{setAiLoading(false);}
 };
 const applyPreset=id=>{
   const p=LASER_PRESETS.find(x=>x.id===id);if(!p)return;
   setProject(old=>({...old,preset:p.id,machine_type:p.machine,material_name:p.material,material_recipe_id:''}));
   setSettings(old=>({...old,widthMm:p.widthMm,heightMm:p.heightMm,depthMm:p.depthMm,material:p.material,mode:p.mode}));
   setMessage('Loaded '+p.label+' as an unverified design preset. Select a tested equipment recipe before production approval.');
 };
 const brushPosition=event=>{
   const rect=event.currentTarget.getBoundingClientRect();
   return {x:Math.round((event.clientX-rect.left)*map.width/rect.width),y:Math.round((event.clientY-rect.top)*map.height/rect.height)};
 };
 const paint=event=>{
   if(!map||!pointerDown.current||!canEdit||!active)return;
   const {x,y}=brushPosition(event);
   setMap(current=>paintHeightmap(current,x,y,brush));
 };
 const undo=()=>{
   if(!undoStack.current.length)return;
   redoStack.current.push(map);setMap(undoStack.current.pop());
 };
 const redo=()=>{
   if(!redoStack.current.length)return;
   undoStack.current.push(map);setMap(redoStack.current.pop());
 };
 const download=async(kind)=>{
   if(!map)return setMessage('Generate a depth map first.');
   setBusy(true);
   try{
    const name=safeName(project.title);
    const size={widthMm:Number(settings.widthMm),heightMm:Number(settings.heightMm),depthMm:Number(settings.depthMm)};
    if(!size.widthMm||!size.heightMm||size.widthMm>600||size.heightMm>600||size.depthMm<=0||size.depthMm>20)
      throw Error('Check the physical size and relief depth before export.');
    if(kind==='png16')downloadBlob(await export16BitPng(map),name+'-lightburn-16bit.png');
    if(kind==='png8'){
      const cv=document.createElement('canvas');renderHeightmap(cv,map);
      downloadBlob(await imageBlob(cv),name+'-grayscale-8bit.png');
    }
    if(kind==='stl')downloadBlob(new Blob([stlRelief(map,size)],{type:'model/stl'}),name+'-relief.stl');
    if(kind==='svg')downloadBlob(new Blob([svgCutOutline(size)],{type:'image/svg+xml'}),name+'-outline.svg');
    setMessage('Export created. Import the file into your machine software; no laser settings or motion commands have been sent.');
   }catch(e){setMessage(e.message);}finally{setBusy(false);}
 };
 const refreshAssets=async id=>{
   if(!id)return;
   const rows=await listLaserAssets(id);setAssets(rows);return rows;
 };
 const readSavedImage=async(id,rows,kind)=>{
   const item=rows.find(a=>a.asset_kind===kind);
   if(!item)return null;
   const blob=await readLaserAsset(id,item.id);
   return readImage(blob);
 };
 const openProject=async row=>{
   if(!row?.id)return;
   setBusy(true);
   try{
     const savedSettings={...baseSettings,...(row.settings||{})};
     setSettings(savedSettings);setProject({...row,material_recipe_id:row.material_recipe_id||'',job_id:row.job_id||''});
     resetHistory();
     const [rows,t]=await Promise.all([
       listLaserAssets(row.id),
       supabase.from('sc_laser_tests').select('*').eq('project_id',row.id).order('created_at',{ascending:false}).limit(40)
     ]);
     setAssets(rows);if(!t.error)setTests(t.data||[]);
     const src=await readSavedImage(row.id,rows,'source');
     const height=await readSavedImage(row.id,rows,'heightmap');
     if(src)setSource(src.data);else setSource(null);
     if(height){
       const n=height.data.width*height.data.height,values=new Float32Array(n),mask=new Uint8Array(n);
       for(let i=0;i<n;i++){values[i]=height.data.data[i*4]/255;mask[i]=src?.data.data[i*4+3]>30?1:1;}
       setMap({width:height.data.width,height:height.data.height,values,mask,source:'saved'});
     }else if(src)setMap(generateHeightmap(src.data,savedSettings));
     else setMap(null);
     setMessage('Opened '+row.title+'. File versions are listed below; only drafts/proofs can be edited.');
   }catch(e){setMessage('Could not restore project: '+e.message);}finally{setBusy(false);}
 };
 const save=async()=>{
   if(!canWrite)return setMessage('A signed-in operator/manager and editable project are required. Training mode cannot save production assets.');
   if(!source||!map)return setMessage('Import source and generate a depth map first.');
   if(warn.blocked)return setMessage(warn.reason);
   const width=Number(settings.widthMm),height=Number(settings.heightMm),depth=Number(settings.depthMm);
   if(!width||!height||width>600||height>600||!depth||depth>20)return setMessage('Dimensions must be 0–600 mm and design relief 0–20 mm.');
   setBusy(true);
   try{
     const payload={title:project.title.trim()||'Laser Relief',status:active?project.status:'draft',
       machine_type:project.machine_type,material_name:project.material_name,preset:project.preset,
       source_mode:settings.mode,settings:{...settings},material_recipe_id:project.material_recipe_id||null,
       job_id:project.job_id||null,customer_id:project.customer_id||null,
       artwork_request_id:project.artwork_request_id||null,updated_at:new Date().toISOString()};
     const op=project.id?
       supabase.from('sc_laser_projects').update(payload).eq('id',project.id).select('*').single():
       supabase.from('sc_laser_projects').insert(payload).select('*').single();
     const {data,error}=await op;if(error)throw error;
     setProject(p=>({...p,...data,material_recipe_id:data.material_recipe_id||'',job_id:data.job_id||''}));
     const existing=project.id===data.id?assets:[];
     if(!existing.some(a=>a.asset_kind==='source')){
       const blob=await imageBlob(sourceCanvas.current);
       await uploadLaserAsset(data.id,{kind:'source',filename:'source.png',mime:'image/png',blob,notes:'Original image normalized for relief editing'});
     }
     const output=document.createElement('canvas');renderHeightmap(output,map);
     await uploadLaserAsset(data.id,{kind:'heightmap',filename:'heightmap.png',mime:'image/png',
       blob:await imageBlob(output),notes:'Editable depth version; original design size '+width+' x '+height+' mm'});
     await refreshAssets(data.id);await loadLists();
     setMessage('Saved project and append-only R2 heightmap version. Use Export for LightBurn/xTool files; approve only after a passing machine test.');
   }catch(e){setMessage('Save failed: '+e.message);}finally{setBusy(false);}
 };
 const recordTest=async()=>{
   if(!canWrite||!project.id||!project.material_recipe_id)return setMessage('Save the project and choose an approved material recipe before recording a physical test.');
   if(!trial.notes.trim())return setMessage('Record observations from the actual engraved coupon.');
   setBusy(true);
   try{
    const {error}=await supabase.from('sc_laser_tests').insert({
      project_id:project.id,material_recipe_id:project.material_recipe_id,result:trial.result,
      measured_depth_mm:trial.measured_depth_mm===''?null:Number(trial.measured_depth_mm),
      notes:trial.notes.trim()
    });
    if(error)throw error;
    const {data}=await supabase.from('sc_laser_tests').select('*').eq('project_id',project.id).order('created_at',{ascending:false});
    setTests(data||[]);setTrial({result:'needs_adjustment',measured_depth_mm:'',notes:''});
    setMessage('Physical test recorded. Manager approval remains a separate action.');
   }catch(e){setMessage(e.message);}finally{setBusy(false);}
 };
 const approve=async()=>{
   if(!manager||!project.id)return setMessage('Manager sign-off required.');
   if(warn.blocked)return setMessage(warn.reason);
   if(!project.material_recipe_id||!tests.some(x=>x.result==='pass'&&x.material_recipe_id===project.material_recipe_id))
     return setMessage('Select an approved recipe and record a passing physical coupon test for that recipe first.');
   setBusy(true);
   try{
    const {data:{user},error:authError}=await supabase.auth.getUser();
    if(authError||!user)throw Error('Sign in before approving.');
    const {data,error}=await supabase.from('sc_laser_projects').update({
      status:'approved',approved_by:user.id,approved_at:new Date().toISOString(),updated_at:new Date().toISOString()
    }).eq('id',project.id).select('*').single();
    if(error)throw error;setProject(old=>({...old,...data}));
    await loadLists();setMessage('Approved after a passing physical test. This project is now locked to protect certified output.');
   }catch(e){setMessage('Approval blocked: '+e.message);}finally{setBusy(false);}
 };
 const downloadStored=async asset=>{
   try{
    const d=await signedLaserAsset(project.id,asset.id);
    const link=document.createElement('a');link.href=d.url;link.target='_blank';link.rel='noopener noreferrer';link.click();
   }catch(e){setMessage(e.message);}
 };
 const calibration=async()=>{
   if(!map)return setMessage('Load artwork first.');
   const cv=document.createElement('canvas');cv.width=800;cv.height=180;const cx=cv.getContext('2d');
   for(let i=0;i<16;i++){
     const v=Math.round(i/15*255);cx.fillStyle='rgb('+v+','+v+','+v+')';cx.fillRect(i*50,0,50,150);
     cx.fillStyle=i>=8?'#141414':'#f8f8f8';cx.font='15px sans-serif';cx.fillText(String(i),i*50+15,175);
   }
   const blob=await imageBlob(cv);downloadBlob(blob,'laser-relief-calibration-16-steps.png');
   if(project.id&&canWrite){
    try{await uploadLaserAsset(project.id,{kind:'calibration',filename:'calibration.png',mime:'image/png',blob,
      notes:'16-step grayscale test coupon; record physical depth observations'});await refreshAssets(project.id);}
    catch(e){setMessage('Downloaded calibration grid; private storage failed: '+e.message);return;}
   }
   setMessage('16-step grayscale calibration grid created. Engrave on a confirmed safe material and record the measured result.');
 };
 const duplicate=()=>{
   setProject(old=>({...draft(),title:old.title+' — Revision',machine_type:old.machine_type,material_name:old.material_name,
     material_recipe_id:'',preset:old.preset,job_id:old.job_id||''}));
   setAssets([]);setTests([]);resetHistory();setMessage('New draft from the current artwork. No certified recipe or test result carries over.');
 };
 return <main className="page sc-page-stack sc-laser">
   <header className="sc-laser-hero">
     <div><p className="sc-kicker">SKILLED CRAFTING · ARTWORK HUB</p><h1>3D Laser Relief Studio</h1>
       <p>Convert photos, logos and grayscale images into editable 2.5D relief maps. Export LightBurn and xTool-ready artwork; verify machining separately.</p></div>
     <div className="sc-laser-hero-links"><Link className="sc-btn" to="/artwork-hub">Artwork Hub</Link>
       <Link className="sc-btn" to="/material-settings">Material Recipes</Link></div>
   </header>
   {message&&<div className="sc-laser-alert" role="status">{message}</div>}
   {warn.blocked?<div className="sc-laser-warning" role="alert">{warn.reason}</div>:
     <p className="sc-laser-safety">{warn.warning} Image depth is relative; the target depth is a design value, not a calibrated engraving measurement. No machine commands are generated.</p>}
   <div className="sc-laser-workspace">
     <aside className="sc-laser-sidebar">
       <Section title="Project & saved versions">
         <label>Title<input value={project.title} maxLength={180} onChange={e=>change('title',e.target.value)} /></label>
         <div className="sc-laser-actions">
           <button type="button" className="sc-btn sc-btn-primary" disabled={busy||!canWrite} onClick={save}>{busy?'Working…':'Save project + depth version'}</button>
           <button type="button" className="sc-btn" onClick={duplicate}>New draft / revision</button>
         </div>
         <label>Saved projects <select value={project.id||''} onChange={e=>openProject(projects.find(p=>p.id===e.target.value))}>
           <option value="">New unsaved project</option>{projects.map(p=><option key={p.id} value={p.id}>{p.title} · {p.status}</option>)}
         </select></label>
         <p className="sc-laser-muted">Status: <strong>{project.status}</strong> · {assets.length} saved assets</p>
         <button className="sc-btn" type="button" onClick={()=>setShowLibrary(s=>!s)}>{showLibrary?'Hide':'Show'} saved asset versions</button>
         {showLibrary&&<div className="sc-laser-library">{assets.length?assets.map(a=><button type="button" key={a.id} onClick={()=>downloadStored(a)}>
             {a.asset_kind} · {a.file_name}<small>{new Date(a.created_at).toLocaleString()}</small>
           </button>):<p className="sc-laser-muted">Save this project to create immutable R2 versions.</p>}</div>}
       </Section>
       <Section title="Source & templates">
         <label>Starting template <select value={project.preset} onChange={e=>applyPreset(e.target.value)}>
           {LASER_PRESETS.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}
         </select></label>
         <label>Source image (PNG / JPG / WebP)<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>importSource(e.target.files?.[0])}/></label>
         <label>Or import existing depth map<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>importDepth(e.target.files?.[0])}/></label>
         <label>Depth creation method <select value={settings.mode} onChange={e=>setting('mode',e.target.value)}>
           <option value="logo">Logo / bevel extrusion</option><option value="photo">Photo tonal sculpt</option>
           <option value="grayscale">Grayscale map</option><option value="ai">AI generated depth (existing)</option>
         </select></label>
         <div className="sc-laser-actions">
           <button type="button" className="sc-btn" disabled={!source||busy} onClick={applyMode}>Regenerate by method</button>
           <button type="button" className="sc-btn" disabled={!source||aiLoading||busy} onClick={generateAI}>{aiLoading?'Loading AI…':'AI depth · free local model'}</button>
         </div>
         <p className="sc-laser-muted">The browser downloads Apache-2.0 Depth Anything V2 Small weights on first use; photos are processed locally. Some devices or networks may not support inference.</p>
       </Section>
       <Section title="Sculpt & refinement">
         <Slider label="Bevel radius" value={settings.bevel} min={1} max={36} onChange={v=>setting('bevel',v)} unit=" px"/>
         <Slider label="Fine details" value={settings.detail} min={0} max={100} onChange={v=>setting('detail',v)} unit="%"/>
         <Slider label="Smoothing" value={settings.smoothing} min={0} max={12} onChange={v=>setting('smoothing',v)} unit=" px"/>
         <Slider label="Tonal contrast" value={settings.contrast} min={0.3} max={3} step={0.1} onChange={v=>setting('contrast',v)}/>
         <label className="sc-laser-check"><input type="checkbox" checked={settings.invert} onChange={e=>setting('invert',e.target.checked)}/> Invert generated depth</label>
         <div className="sc-laser-actions"><button type="button" className="sc-btn" disabled={!map} onClick={applyMode}>Apply image controls</button></div>
         <label>Brush operation<select value={brush.tool} onChange={e=>setBrush(s=>({...s,tool:e.target.value}))}>
           {['raise','lower','flatten','smooth'].map(t=><option key={t} value={t}>{t}</option>)}
         </select></label>
         <Slider label="Brush radius" value={brush.radius} min={1} max={80} unit=" px" onChange={v=>setBrush(s=>({...s,radius:v}))}/>
         <Slider label="Brush strength" value={brush.strength} min={0.01} max={0.5} step={0.01} onChange={v=>setBrush(s=>({...s,strength:v}))}/>
         <div className="sc-laser-actions"><button type="button" className="sc-btn" onClick={undo} disabled={!undoStack.current.length}>Undo</button>
           <button type="button" className="sc-btn" onClick={redo} disabled={!redoStack.current.length}>Redo</button></div>
       </Section>
     </aside>
     <div className="sc-laser-main">
       <div className="sc-laser-stages">
         <figure><figcaption><strong>Source</strong><span>Original, normalized to ≤512px</span></figcaption><canvas aria-label="Source image" ref={sourceCanvas}/></figure>
         <figure><figcaption><strong>Height map · editable</strong><span>Drag to sculpt; white = high</span></figcaption>
           <canvas ref={depthCanvas} role="img" aria-label="Editable grayscale depth map"
             onPointerDown={e=>{if(!map||!canEdit||!active)return;pointerDown.current=true;checkpoint();e.currentTarget.setPointerCapture(e.pointerId);paint(e);}}
             onPointerMove={paint} onPointerUp={()=>{pointerDown.current=false;}}
             onPointerCancel={()=>{pointerDown.current=false;}} /></figure>
       </div>
       <Section title="3D surface preview">
         <canvas className="sc-laser-3d" ref={threeCanvas} aria-label="Simulated rotatable shaded 3D surface preview"/>
         <div className="sc-laser-controls">
           <Slider label="Rotate" min={-180} max={180} value={yaw} onChange={setYaw} unit="°"/>
           <Slider label="Tilt" min={15} max={85} value={pitch} onChange={setPitch} unit="°"/>
         </div>
         <p className="sc-laser-muted">Visualization only: contrast and Z are exaggerated. Color is a material simulation, not a promise of metal or wood engraving results.</p>
       </Section>
       <Section title="Machine, size and export">
         <div className="sc-laser-form-grid">
           <label>Machine<select value={project.machine_type} onChange={e=>{change('machine_type',e.target.value);change('material_recipe_id','');}}>
             {MACHINES.map(([id,label])=><option value={id} key={id}>{label}</option>)}
           </select></label>
           <label>Preview material<select value={settings.material} onChange={e=>{setting('material',e.target.value);change('material_name',e.target.value);}}>
             {MATERIALS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
           <label>Verified substrate / coating<input value={project.material_name} onChange={e=>change('material_name',e.target.value)} placeholder="Brass, bare stainless, maple…"/></label>
           <label>Approved material recipe<select value={project.material_recipe_id||''} onChange={e=>change('material_recipe_id',e.target.value)}>
             <option value="">No recipe selected — not production ready</option>
             {matchRecipes.map(r=><option key={r.id} value={r.id}>{r.material_name} · {r.machine_model||r.machine_type}</option>)}
           </select></label>
           <label>Width (mm)<input type="number" min={1} max={600} step="0.1" value={settings.widthMm} onChange={e=>setting('widthMm',Number(e.target.value))}/></label>
           <label>Height (mm)<input type="number" min={1} max={600} step="0.1" value={settings.heightMm} onChange={e=>setting('heightMm',Number(e.target.value))}/></label>
           <label>Design relief range (mm)<input type="number" min={0.01} max={20} step="0.01" value={settings.depthMm} onChange={e=>setting('depthMm',Number(e.target.value))}/></label>
           <label>Associated job<select value={project.job_id||''} onChange={e=>change('job_id',e.target.value)}>
             <option value="">No linked job</option>{jobs.map(j=><option value={j.id} key={j.id}>#{j.id} {j.job_name||j.customer_name||'Job'}</option>)}
           </select></label>
         </div>
         <div className="sc-laser-actions">
           <button type="button" disabled={!map||busy} className="sc-btn sc-btn-primary" onClick={()=>download('png16')}>LightBurn 16-bit PNG</button>
           <button type="button" disabled={!map||busy} className="sc-btn" onClick={()=>download('png8')}>xTool / 8-bit PNG</button>
           <button type="button" disabled={!map||busy} className="sc-btn" onClick={()=>download('stl')}>Relief STL</button>
           <button type="button" disabled={!map||busy} className="sc-btn" onClick={()=>download('svg')}>Outline SVG</button>
         </div>
         <p className="sc-laser-muted">Use LightBurn 3D Sliced only on supported galvo systems. P2/S1 use compatible grayscale modes where supported by the selected machine and material. STL is a rectangular relief mesh for modeling; SVG is an alignment rectangle, not an automatic traced contour.</p>
       </Section>
       <Section title="Calibration, test coupons and production approval">
         <button type="button" disabled={!map||busy} className="sc-btn" onClick={calibration}>Export 16-step calibration grid</button>
         <p className="sc-laser-muted">Engrave a small coupon at documented settings, measure the result, and save a passing test. No machine is operated from this application.</p>
         <div className="sc-laser-form-grid">
           <label>Test result<select value={trial.result} onChange={e=>setTrial(s=>({...s,result:e.target.value}))}>
             <option value="needs_adjustment">Needs adjustment</option><option value="pass">Pass</option><option value="fail">Fail</option>
           </select></label>
           <label>Measured maximum depth (mm)<input type="number" min={0} max={49.99} step="0.001" value={trial.measured_depth_mm} onChange={e=>setTrial(s=>({...s,measured_depth_mm:e.target.value}))}/></label>
         </div>
         <label>Measured test notes<textarea rows={2} value={trial.notes} maxLength={3000} onChange={e=>setTrial(s=>({...s,notes:e.target.value}))} placeholder="Coupon substrate, lens/focus, passes, ventilation, result…"/></label>
         <div className="sc-laser-actions">
           <button type="button" className="sc-btn" disabled={!canWrite||busy||!project.id} onClick={recordTest}>Record physical coupon</button>
           <button type="button" className="sc-btn sc-btn-primary" disabled={!manager||!active||busy||!project.id} onClick={approve}>Manager approval (locks design)</button>
         </div>
         <div className="sc-laser-library">{tests.map(t=><div key={t.id} className="sc-laser-test"><strong>{t.result}</strong>
           <span>{t.measured_depth_mm??'—'} mm · {new Date(t.created_at).toLocaleString()}</span><p>{t.notes}</p></div>)}</div>
       </Section>
     </div>
   </div>
 </main>;
}
