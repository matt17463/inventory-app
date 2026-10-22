import {useEffect,useState} from 'react';
import {supabase} from './supabaseClient';
import {authenticatedFunctionFetch} from './lib/netlifyFunctionClient';
import {Link} from 'react-router-dom';

function csv(rows){
 const keys=['sku','brand','style','color','size','open_job_lines','open_units','catalog_available','purchasing_note'];
 const quote=v=>'"'+String(v??'').replace(/"/g,'""').replace(/^[=+\-@\t\r]/,"'$&")+'"';
 return [keys.join(','),...rows.map(row=>keys.map(k=>quote(row[k])).join(','))].join('\r\n');
}
function download(rows){
 const blob=new Blob([csv(rows)],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=url;a.download='team-consolidated-blank-demand.csv';a.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function action(path,body){
 const r=await authenticatedFunctionFetch('/.netlify/functions/'+path,{
  method:'POST',body:JSON.stringify(body),
 });
 const data=await r.json().catch(()=>({}));
 if(!r.ok||data.success===false)throw Error(data.error||'Action failed');
 return data;
}
export default function TeamCampaignOperations({campaign,canPublish,onUpdated}){
 const [rows,setRows]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [token,setToken]=useState(''),[expires,setExpires]=useState('');
 const [cloneName,setCloneName]=useState(''),[season,setSeason]=useState('');
 const isStore=campaign.order_channel==='woocommerce';
 async function refresh(){
  const {data,error:dbError}=await supabase.rpc('sc_team_campaign_purchasing',{p_campaign_id:campaign.id});
  if(dbError)throw dbError;setRows(data||[]);
 }
 useEffect(()=>{refresh().catch(e=>setError(e.message));},[campaign.id]);
 async function doWork(fn){
  setBusy(true);setError('');
  try{setError(await fn());await refresh();await onUpdated?.();}
  catch(e){setError(e.message||'Action unavailable');}
  finally{setBusy(false);}
 }
 const invite=token?window.location.origin+'/coordinator/'+token:'';
 async function inviteCopy(){
  try{await navigator.clipboard.writeText(invite);setError('Coordinator invitation link copied.');}
  catch{setError('Select the private link below and copy it manually.');}
 }
 return <section className="card elevated-card sc-team-commerce">
   <h2>Campaign purchasing and coordinator tools</h2>
   <section className="sc-team-commerce-section">
     <h3>Consolidated production blank demand</h3>
     <p>This view groups outstanding blank demand from actual paid/converted production jobs. It excludes unconverted group forms and unpaid Woo orders. Available inventory is shown for reference; **do not use this report alone as a supplier purchase order** because Purchasing may already hold reservations or supplier orders.</p>
     <div className="sc-team-controls">
       <button type="button" disabled={busy} onClick={()=>doWork(async()=>{await refresh();return 'Blank demand refreshed.';})}>Refresh blank demand</button>
       <button type="button" disabled={!rows.length} onClick={()=>download(rows)}>Download team purchasing CSV</button>
       <Link to="/purchasing">Open authoritative Purchasing Report →</Link>
     </div>
     <div className="sc-team-roster-scroll"><table><thead><tr><th>Blank SKU</th><th>Brand / style</th><th>Color</th><th>Size</th><th>Open units</th><th>Available inventory</th><th>Next action</th></tr></thead><tbody>
       {rows.map((r,i)=><tr key={r.blank_product_id+'-'+r.sku+'-'+r.color+'-'+r.size+'-'+i}>
         <td>{r.sku}</td><td>{r.brand} {r.style}</td><td>{r.color}</td><td>{r.size}</td>
         <td>{r.open_units}</td><td>{r.catalog_available??'Unknown'}</td><td>{r.purchasing_note}</td>
       </tr>)}
     </tbody></table></div>
     {!rows.length&&<p>No eligible open production demand is currently linked to this campaign.</p>}
   </section>
   {canPublish&&<section className="sc-team-commerce-section">
     <h3>Private customer coordinator dashboard</h3>
     <p>Give a school/team representative a private link with aggregate campaign progress only. It does not show customer identities, wholesale costs, individual invoices or card information. Invitations expire after 90 days and can be revoked at any time.</p>
     <div className="sc-team-controls">
       <button type="button" disabled={busy} onClick={()=>doWork(async()=>{
         const result=await action('team-store-coordinator',{action:'issue',campaign_id:campaign.id});
         setToken(result.token);setExpires(result.expires_at);return 'Coordinator invitation generated; older links are revoked.';
       })}>Issue / rotate private link</button>
       <button type="button" disabled={busy} onClick={()=>doWork(async()=>{
         if(!window.confirm('Revoke coordinator dashboard invitations for this campaign?'))return '';
         await action('team-store-coordinator',{action:'revoke',campaign_id:campaign.id});setToken('');setExpires('');
         return 'Coordinator access revoked.';
       })}>Revoke coordinator links</button>
     </div>
     {invite&&<div><label>Private coordinator URL<input readOnly value={invite} onFocus={e=>e.target.select()}/></label>
       <button type="button" onClick={inviteCopy}>Copy invitation</button>
       <p><small>Expires: {new Date(expires).toLocaleString()}. The invitation value is only displayed after issuing it; store it securely.</small></p>
     </div>}
   </section>}
   {canPublish&&isStore&&<section className="sc-team-commerce-section">
     <h3>Clone this client storefront for a new season</h3>
     <p>Copies approved brand colors, WordPress layout, artwork/logo reference and general campaign instructions into a new draft. It deliberately does **not** clone paid orders, product-category assignments, storefront publication, prices, client approval or delivery deadlines. These must be reconfirmed for the new season.</p>
     <div className="sc-team-roster-add">
       <label>New campaign title<input value={cloneName} onChange={e=>setCloneName(e.target.value)} placeholder="SK United • Fall 2027"/></label>
       <label>New season / year<input value={season} onChange={e=>setSeason(e.target.value)} placeholder="Fall 2027"/></label>
       <button type="button" disabled={busy||cloneName.trim().length<3||!season.trim()}
         onClick={()=>doWork(async()=>{
           const data=await action('team-store-site',{action:'clone',campaign_id:campaign.id,next_name:cloneName,season});
           setCloneName('');setSeason('');
           return 'New-season draft created. Select it from the campaign dropdown to configure new products and approval. Campaign ID: '+data.id;
         })}>Clone as new-season draft</button>
     </div>
   </section>}
   {error&&<p className="message" role="status">{error}</p>}
 </section>;
}
