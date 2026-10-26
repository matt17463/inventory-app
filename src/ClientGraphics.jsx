import {useEffect,useState} from 'react';
import {supabase} from './supabaseClient';
import {Link} from 'react-router-dom';
const endpoint='/.netlify/functions/client-graphics';
async function request(entity,values,id){
 const {data:{session}}=await supabase.auth.getSession();
 if(!session?.access_token)throw Error('Sign in before opening client graphics.');
 const input=values?{entity,values,id}:null;
 const url=input?endpoint:endpoint+'?entity='+encodeURIComponent(entity);
 const response=await fetch(url,{method:input?'POST':'GET',headers:{Authorization:'Bearer '+session.access_token,...(input?{'Content-Type':'application/json'}:{})},...(input?{body:JSON.stringify(input)}:{})});
 const result=await response.json();if(!response.ok)throw Error(result.message||'Graphics request failed');return result;
}
export default function ClientGraphics(){
 const [families,setFamilies]=useState([]),[variants,setVariants]=useState([]),[rules,setRules]=useState([]);
 const [selected,setSelected]=useState(''),[name,setName]=useState(''),[label,setLabel]=useState(''),[visibility,setVisibility]=useState('internal');
 const [asset,setAsset]=useState(''),[variantName,setVariantName]=useState(''),[width,setWidth]=useState(''),[height,setHeight]=useState('');
 const [art,setArt]=useState([]),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 async function load(){const [a,b,c]=await Promise.all([request('families'),request('variants'),request('rules')]);setFamilies(a.records||[]);setVariants(b.records||[]);setRules(c.records||[]);}
 useEffect(()=>{load().catch(e=>setMessage(e.message));supabase.from('mockup_artwork_assets').select('id,artwork_name,preflight_status').limit(250).then(({data})=>setArt(data||[]));},[]);
 async function save(entity,values){setBusy(true);setMessage('');try{await request(entity,values);await load();setMessage('Saved as draft. No live storefront mapping was changed.');}catch(e){setMessage(e.message);}finally{setBusy(false)}}
 const choice=families.find(x=>x.id===selected),own=variants.filter(v=>v.family_id===selected);
 return <main className="page"><header className="page-header"><div><p className="eyebrow">Artwork · Client graphics</p><h1>Client Graphics Library</h1><p>Manage customer-facing designs and separate production files. Existing WooCommerce selections remain unchanged until transfer verification.</p></div><Link to="/manufacturing-recipes">Production recipes →</Link></header>
 {message&&<p role="status" className="message">{message}</p>}
 <section className="card"><h2>Create graphic family</h2><div className="form-grid"><label>Internal design name<input value={name} onChange={e=>setName(e.target.value)}/></label><label>Customer label<input value={label} onChange={e=>setLabel(e.target.value)}/></label><label>Storefront behavior (planning only)<select value={visibility} onChange={e=>setVisibility(e.target.value)}><option value="internal">Production only</option><option value="fixed">Fixed product graphic</option><option value="selectable">Customer choice</option></select></label></div><button disabled={busy||name.trim().length<2} onClick={()=>save('families',{name:name.trim(),storefront_label:label,storefront_visibility:visibility})}>Save graphic family</button></section>
 <section className="card"><h2>Graphic families</h2><label>Select design<select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Choose graphic family</option>{families.map(f=><option key={f.id} value={f.id}>{f.name} · {f.storefront_visibility} · {f.state}</option>)}</select></label>
 {choice&&<><p><strong>{choice.name}</strong> — {choice.storefront_label||'No customer label'}; {own.length} production file(s)</p><h3>Production file variants</h3><ul>{own.map(v=><li key={v.id}>{v.label} · {v.process} · {v.width_inches||'?'} × {v.height_inches||'?'} in · {v.state} · {rules.filter(r=>r.variant_id===v.id).length} rule(s)</li>)}</ul>
 <div className="form-grid"><label>File label<input value={variantName} onChange={e=>setVariantName(e.target.value)} placeholder="Youth front · 8 inch"/></label><label>Existing R2 artwork<select value={asset} onChange={e=>setAsset(e.target.value)}><option value="">Choose artwork</option>{art.map(a=><option key={a.id} value={a.id}>{a.artwork_name} · {a.preflight_status}</option>)}</select></label><label>Width (inches)<input type="number" min="0.01" step=".125" value={width} onChange={e=>setWidth(e.target.value)}/></label><label>Height (inches)<input type="number" min="0.01" step=".125" value={height} onChange={e=>setHeight(e.target.value)}/></label></div>
 <button disabled={busy||!variantName.trim()||!asset||!(Number(width)>0)||!(Number(height)>0)} onClick={()=>save('variants',{family_id:selected,label:variantName.trim(),artwork_asset_id:asset,width_inches:Number(width),height_inches:Number(height),process:'DTF'})}>Add draft production variant</button><p><small>Production variants and rules remain unapproved until tested against verified physical samples. No changes are sent to WooCommerce.</small></p></>}</section></main>;
}
