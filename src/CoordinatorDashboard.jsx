import {useEffect,useState} from 'react';
import {useParams} from 'react-router-dom';
const cash=n=>Number(n||0).toLocaleString('en-US',{style:'currency',currency:'USD'});
export default function CoordinatorDashboard(){
 const {token}=useParams();
 const [data,setData]=useState(null),[error,setError]=useState('Opening your team dashboard…');
 useEffect(()=>{
  let mounted=true;
  fetch('/.netlify/functions/team-store-coordinator',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'view',token}),cache:'no-store'})
   .then(async r=>{const d=await r.json();if(!r.ok||!d.success)throw Error(d.error||'Invitation unavailable');return d;})
   .then(d=>{if(mounted){setData(d);setError('');}}).catch(e=>{if(mounted)setError(e.message)});
  return()=>{mounted=false;};
 },[token]);
 const c=data?.campaign,s=data?.summary;
 return <main style={{minHeight:'100vh',padding:'35px 22px',background:'#f8fafc',color:'#172033',fontFamily:'system-ui'}}>
  <div style={{maxWidth:960,margin:'auto'}}>
   <div style={{borderBottom:'3px solid #0f766e',paddingBottom:18,marginBottom:22}}>
    <p style={{color:'#0f766e',fontWeight:800,letterSpacing:'.12em',fontSize:12}}>SKILLED CRAFTING • COORDINATOR VIEW</p>
    <h1>{c?.workflow_name||'Team order dashboard'}</h1>
    {c&&<p>{c.customer_name} {c.season_label?'• '+c.season_label:''}</p>}
   </div>
   {!data?<p role="status">{error}</p>:<>
    <p>Order channel: <strong>{c.order_channel==='woocommerce'?'Recurring WooCommerce storefront':'Occasional group order • QuickBooks invoicing'}</strong></p>
    <p>Ordering deadline: {c.store_close_date||'Not set'} • Fulfillment: {c.fulfillment_method||'Confirm with Skilled Crafting'}</p>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(185px,1fr))',gap:16,margin:'28px 0'}}>
     {Object.entries(s).map(([key,value])=><div key={key} style={{padding:22,background:'#fff',border:'1px solid #d5dee6',borderRadius:9}}>
      <div style={{fontSize:13,textTransform:'capitalize',color:'#64748b'}}>{key.replaceAll('_',' ')}</div>
      <strong style={{display:'block',fontSize:28,marginTop:8}}>{['net_eligible_sales','fundraiser_estimated'].includes(key)?cash(value):value}</strong>
     </div>)}
    </div>
    <p style={{maxWidth:740,lineHeight:1.6,color:'#475569'}}>{data.notice}</p>
    {c.last_reconciled_at&&<p><small>Last Woo reconciliation: {new Date(c.last_reconciled_at).toLocaleString()}</small></p>}
    {c.order_channel==='woocommerce'&&c.wp_store_url&&<a href={c.wp_store_url} target="_blank" rel="noreferrer"
      style={{display:'inline-block',padding:'12px 19px',background:'#0f766e',color:'#fff',borderRadius:8,textDecoration:'none',fontWeight:700}}>Shop official team store ↗</a>}
    <p style={{fontSize:12,color:'#64748b',marginTop:35}}>This view is private. It contains campaign-level summaries, not customer names or payment details. Do not distribute the invitation publicly.</p>
   </>}
  </div>
 </main>;
}
