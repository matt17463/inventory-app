import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {supabase} from './supabaseClient';
const endpoint='/.netlify/functions/';
async function secure(name,options={}){
 const {data:{session}}=await supabase.auth.getSession();
 if(!session?.access_token)throw Error('Employee sign-in required');
 const response=await fetch(endpoint+name,{...options,headers:{Authorization:'Bearer '+session.access_token,...options.headers}});
 const data=await response.json();if(!response.ok)throw Error(data.message||'Graphic request failed');return data;
}
export default function OrderGraphicAssignment(){
 const [jobId,setJobId]=useState(''),[jobItemId,setJobItemId]=useState('');
 const [families,setFamilies]=useState([]),[source,setSource]=useState('quickbooks'),[invoice,setInvoice]=useState(''),[line,setLine]=useState(''),[family,setFamily]=useState('');
 const [color,setColor]=useState(''),[size,setSize]=useState(''),[style,setStyle]=useState(''),[placement,setPlacement]=useState('full_front');
 const [message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{secure('client-graphics?entity=families').then(r=>setFamilies((r.records||[]).filter(x=>x.state==='approved'))).catch(e=>setMessage(e.message));},[]);
 async function submit(e){
  e.preventDefault();setBusy(true);setMessage('');
  const selected=families.find(x=>x.id===family);
  try{
   const result=await secure('order-graphic-selection',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({source,jobId:Number(jobId),jobItemId:Number(jobItemId),externalOrderId:invoice,externalLineId:line,familyId:family,label:selected?.storefront_label||selected?.name,
     details:{garment_color:color,size_group:size,garment_style:style,placement_name:placement}})});
   setMessage('Approved artwork variant '+result.variant_id+' linked to order line. Confirm job and traveler details before production.');
  }catch(err){setMessage(err.message);}finally{setBusy(false)}
 }
 return <main className="page"><header className="page-header"><div><p className="eyebrow">Orders · Graphic selection</p><h1>Assign production artwork</h1><p>For QuickBooks or manual orders, connect each order line to an approved graphic. Invoice charges remain in their original system.</p></div><Link to="/client-graphics">Graphic Library</Link></header>
 {message&&<p role="status" className="message">{message}</p>}
 <form onSubmit={submit} className="card" style={{maxWidth:720}}>
 <label>Order channel<select value={source} onChange={e=>setSource(e.target.value)}><option value="quickbooks">QuickBooks invoice</option><option value="manual">Manual order</option></select></label>
 <label>Existing production job ID<input required inputMode="numeric" value={jobId} onChange={e=>setJobId(e.target.value)} placeholder="Existing job number"/></label>
 <label>Existing production job line ID<input required inputMode="numeric" value={jobItemId} onChange={e=>setJobItemId(e.target.value)} placeholder="Exact line from that job"/></label>
 <label>Invoice / order number<input required value={invoice} onChange={e=>setInvoice(e.target.value)} placeholder="Example: INV-1021"/></label>
 <label>Invoice line identifier<input required value={line} onChange={e=>setLine(e.target.value)} placeholder="Exact stable line ID, not position if lines reorder"/></label>
 <label>Approved client design<select required value={family} onChange={e=>setFamily(e.target.value)}><option value="">Choose approved graphic</option>{families.map(f=><option key={f.id} value={f.id}>{f.storefront_label||f.name}</option>)}</select></label>
 <div className="form-grid"><label>Garment color<input value={color} onChange={e=>setColor(e.target.value)}/></label><label>Size group<input value={size} onChange={e=>setSize(e.target.value)} placeholder="Adult, Youth or exact configured value"/></label><label>Garment style<input value={style} onChange={e=>setStyle(e.target.value)}/></label><label>Placement<select value={placement} onChange={e=>setPlacement(e.target.value)}>{['full_front','center_chest','left_chest','right_chest','full_back','sleeve'].map(x=><option key={x} value={x}>{x.replaceAll('_',' ')}</option>)}</select></label></div>
 <button disabled={busy||!family||!invoice.trim()||!line.trim()||!/^\\d+$/.test(jobId)||!/^\\d+$/.test(jobItemId)}>{busy?'Saving…':'Resolve and save graphic for order line'}</button>
 <p><small>Requires a matching approved variant and active selection rule. Missing or conflicting artwork blocks the assignment. This does not update the QuickBooks invoice itself.</small></p>
 </form></main>;
}
