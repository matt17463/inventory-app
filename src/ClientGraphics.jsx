import {useEffect,useState} from 'react';
import {supabase} from './supabaseClient';
import {Link} from 'react-router-dom';
const endpoint='/.netlify/functions/client-graphics';
async function request(entity,values,id,verified_sample=false){
 const {data:{session}}=await supabase.auth.getSession();
 if(!session?.access_token)throw Error('Sign in before opening client graphics.');
 const input=values?{entity,values,id,verified_sample}:null;
 const url=input?endpoint:endpoint+'?entity='+encodeURIComponent(entity);
 const response=await fetch(url,{method:input?'POST':'GET',headers:{Authorization:'Bearer '+session.access_token,...(input?{'Content-Type':'application/json'}:{})},...(input?{body:JSON.stringify(input)}:{})});
 const result=await response.json();if(!response.ok)throw Error(result.message||'Graphics request failed');return result;
}
export default function ClientGraphics(){
 const [families,setFamilies]=useState([]),[variants,setVariants]=useState([]),[rules,setRules]=useState([]),[bindings,setBindings]=useState([]);
 const [selected,setSelected]=useState(''),[name,setName]=useState(''),[label,setLabel]=useState(''),[visibility,setVisibility]=useState('internal');
 const [wooProductId,setWooProductId]=useState(''),[bindingMode,setBindingMode]=useState('fixed');
 const [asset,setAsset]=useState(''),[variantName,setVariantName]=useState(''),[width,setWidth]=useState(''),[height,setHeight]=useState('');
 const [ruleVariant,setRuleVariant]=useState(''),[ruleSize,setRuleSize]=useState(''),[ruleColor,setRuleColor]=useState(''),[rulePlacement,setRulePlacement]=useState('full_front'),[rulePriority,setRulePriority]=useState(100);
 const [art,setArt]=useState([]),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 async function load(){const [a,b,c,d]=await Promise.all([request('families'),request('variants'),request('rules'),request('bindings')]);setFamilies(a.records||[]);setVariants(b.records||[]);setRules(c.records||[]);setBindings(d.records||[]);}
 useEffect(()=>{load().catch(e=>setMessage(e.message));supabase.from('mockup_artwork_assets').select('id,artwork_name,preflight_status').limit(250).then(({data})=>setArt(data||[]));},[]);
 async function save(entity,values,id,verified_sample=false){setBusy(true);setMessage('');try{await request(entity,values,id,verified_sample);await load();setMessage('Saved as draft. No live storefront mapping was changed.');}catch(e){setMessage(e.message);}finally{setBusy(false)}}
 const choice=families.find(x=>x.id===selected),own=variants.filter(v=>v.family_id===selected);
 return <main className="page"><header className="page-header"><div><p className="eyebrow">Artwork · Client graphics</p><h1>Client Graphics Library</h1><p>Manage customer-facing designs and separate production files. Existing WooCommerce selections remain unchanged until transfer verification.</p></div><Link to="/manufacturing-recipes">Production recipes →</Link></header>
 {message&&<p role="status" className="message">{message}</p>}
 <section className="card"><h2>Create graphic family</h2><div className="form-grid"><label>Internal design name<input value={name} onChange={e=>setName(e.target.value)}/></label><label>Customer label<input value={label} onChange={e=>setLabel(e.target.value)}/></label><label>Storefront behavior (planning only)<select value={visibility} onChange={e=>setVisibility(e.target.value)}><option value="internal">Production only</option><option value="fixed">Fixed product graphic</option><option value="selectable">Customer choice</option></select></label></div><button disabled={busy||name.trim().length<2} onClick={()=>save('families',{name:name.trim(),storefront_label:label,storefront_visibility:visibility})}>Save graphic family</button></section>
 <section className="card"><h2>Graphic families</h2><label>Select design<select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Choose graphic family</option>{families.map(f=><option key={f.id} value={f.id}>{f.name} · {f.storefront_visibility} · {f.state}</option>)}</select></label>
 {choice&&<><p><strong>{choice.name}</strong> — {choice.storefront_label||'No customer label'}; {own.length} production file(s)</p><h3>Production file variants</h3><ul>{own.map(v=><li key={v.id}>{v.label} · {v.process} · {v.width_inches||'?'} × {v.height_inches||'?'} in · {v.state} · {rules.filter(r=>r.variant_id===v.id).length} rule(s)
{v.state==='draft'&&<button type="button" disabled={busy} onClick={()=>{if(window.confirm('Confirm the physical sample and exact artwork file have been checked?'))save('variants',{state:'approved'},v.id,true)}}>Approve verified variant</button>}</li>)}</ul>
{choice.state!=='approved'&&<button type="button" disabled={busy||!own.some(v=>v.state==='approved')} onClick={()=>save('families',{state:'approved'},choice.id)}>Approve graphic family</button>}
 <div className="form-grid"><label>File label<input value={variantName} onChange={e=>setVariantName(e.target.value)} placeholder="Youth front · 8 inch"/></label><label>Existing R2 artwork<select value={asset} onChange={e=>setAsset(e.target.value)}><option value="">Choose artwork</option>{art.map(a=><option key={a.id} value={a.id}>{a.artwork_name} · {a.preflight_status}</option>)}</select></label><label>Width (inches)<input type="number" min="0.01" step=".125" value={width} onChange={e=>setWidth(e.target.value)}/></label><label>Height (inches)<input type="number" min="0.01" step=".125" value={height} onChange={e=>setHeight(e.target.value)}/></label></div>
 <button disabled={busy||!variantName.trim()||!asset||!(Number(width)>0)||!(Number(height)>0)} onClick={()=>save('variants',{family_id:selected,label:variantName.trim(),artwork_asset_id:asset,width_inches:Number(width),height_inches:Number(height),process:'DTF'})}>Add draft production variant</button><h3>Draft automatic artwork rule</h3><p>Choose when a particular file should be used. Rules remain disabled until the physical sample and conflict checks are completed.</p>
<div className="form-grid"><label>Production variant<select value={ruleVariant} onChange={e=>setRuleVariant(e.target.value)}><option value="">Choose variant</option>{own.map(v=><option key={v.id} value={v.id}>{v.label} · {v.state}</option>)}</select></label>
<label>Garment size group<input value={ruleSize} onChange={e=>setRuleSize(e.target.value)} placeholder="Adult or Youth"/></label>
<label>Garment color (optional)<input value={ruleColor} onChange={e=>setRuleColor(e.target.value)} placeholder="Black"/></label>
<label>Application location<select value={rulePlacement} onChange={e=>setRulePlacement(e.target.value)}>{['full_front','center_chest','left_chest','right_chest','full_back','sleeve'].map(x=><option key={x} value={x}>{x.replaceAll('_',' ')}</option>)}</select></label>
<label>Rule priority<input type="number" value={rulePriority} onChange={e=>setRulePriority(Number(e.target.value))}/></label></div>
<button disabled={busy||!ruleVariant} onClick={()=>save('rules',{family_id:selected,variant_id:ruleVariant,size_group:ruleSize||null,garment_color:ruleColor||null,placement_name:rulePlacement,priority:rulePriority,enabled:false})}>Save disabled draft rule</button>
<h3>WooCommerce transfer preparation</h3><p>Stage a proposed product-to-graphic relationship here. This only saves a disabled mapping in Skilled Crafting; it does not publish options or change WooCommerce products.</p>
<div className="form-grid"><label>WooCommerce parent product ID<input inputMode="numeric" value={wooProductId} onChange={e=>setWooProductId(e.target.value)} placeholder="Numeric parent product ID"/></label>
<label>Proposed storefront behavior<select value={bindingMode} onChange={e=>setBindingMode(e.target.value)}><option value="fixed">Fixed graphic</option><option value="selectable">Customer-selectable</option><option value="internal">Production only</option></select></label></div>
<button type="button" disabled={busy||!/^\d+$/.test(wooProductId)||Number(wooProductId)<1} onClick={()=>save('bindings',{woo_product_id:Number(wooProductId),graphic_family_id:selected,mode:bindingMode,allowed:false})}>Stage disabled product mapping</button>
<h4>Proposed product mappings</h4><ul>{bindings.filter(b=>b.graphic_family_id===selected).map(b=><li key={b.id}>Woo #{b.woo_product_id} · {b.mode} · {b.allowed?'Verified active':'Inactive — transfer pending'}</li>)}</ul>
<h3>Existing rules</h3><ul>{rules.filter(rule=>rule.family_id===selected).map(rule=><li key={rule.id}>{own.find(v=>v.id===rule.variant_id)?.label||'Unknown variant'} · {rule.size_group||'all sizes'} · {rule.garment_color||'all colors'} · {rule.placement_name||'all locations'} · {rule.enabled?'Active':'Draft'} {!rule.enabled&&own.some(v=>v.id===rule.variant_id&&v.state==='approved')&&<button type="button" disabled={busy} onClick={()=>{if(window.confirm('Confirm the physical production sample has been checked and this routing rule should become active?'))save('rules',{enabled:true},rule.id,true)}}>Activate verified rule</button>}</li>)}</ul>
<p><small>Production variants and rules remain unapproved until tested against verified physical samples. No changes are sent to WooCommerce.</small></p></>}</section></main>;
}
