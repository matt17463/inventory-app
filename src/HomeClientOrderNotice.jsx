import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from './supabaseClient';

export default function HomeClientOrderNotice() {
  const [rows,setRows]=useState([]);
  const [seenAt,setSeenAt]=useState('');
  useEffect(()=>{
    try { setSeenAt(window.localStorage.getItem('sc-client-order-seen-at')||''); } catch (_) {}
    supabase.from('sc_client_order_requests_detail')
      .select('id,order_number,organization,contact_name,total_quantity,status,submitted_at')
      .eq('status','submitted')
      .order('submitted_at',{ascending:false})
      .limit(8)
      .then(({data})=>setRows(data||[]));
  },[]);
  if(!rows.length) return null;
  const unread=rows.filter((row)=>!seenAt||new Date(row.submitted_at).getTime()>new Date(seenAt).getTime()).length;
  function markViewed(){
    const newest=rows[0]?.submitted_at||new Date().toISOString();
    setSeenAt(newest);
    try { window.localStorage.setItem('sc-client-order-seen-at',newest); } catch (_) {}
  }
  return <section className="sc-panel sc-panel-color-left">
    <div className="sc-panel-header"><div><div className="sc-kicker">Client Order Notifications</div><h3>{unread>0?`${unread} new client order request${unread===1?'':'s'}`:'Submitted client orders'}</h3><p>Online team and business order forms appear here before pricing or inventory commitment.</p></div><div className="sc-hero-actions"><Link className="sc-btn sc-btn-primary" to="/client-orders">Open Client Orders</Link>{unread>0&&<button className="sc-btn" type="button" onClick={markViewed}>Mark viewed</button>}</div></div>
    <div className="sc-workflow-list sc-workflow-list-colored">{rows.slice(0,5).map((row)=><div key={row.id} style={{padding:'10px 0'}}><strong>{(!seenAt||new Date(row.submitted_at).getTime()>new Date(seenAt).getTime())?'NEW · ':''}{row.order_number} · {row.organization}</strong><span style={{display:'block'}}>{row.contact_name} · {row.total_quantity||0} units · {new Date(row.submitted_at).toLocaleString()}</span></div>)}</div>
  </section>;
}
