import {useContext,useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {EmployeeAccessContext} from './lib/employeeAccessContext';
import {authenticatedFunctionFetch} from './lib/netlifyFunctionClient';

async function request(action){
 const response=await authenticatedFunctionFetch('/.netlify/functions/qbo-print-connect',{
  method:'POST',body:JSON.stringify({action}),
 });
 const result=await response.json().catch(()=>({}));
 if(!response.ok||!result.success)throw Error(result.error||'QuickBooks settings are unavailable.');
 return result;
}
export default function QuickBooksConnection(){
 const access=useContext(EmployeeAccessContext);
 const admin=access?.role==='admin';
 const [status,setStatus]=useState(null),[message,setMessage]=useState(''),[busy,setBusy]=useState('');
 useEffect(()=>{
  let active=true;
  if(admin)request('status').then(value=>{if(active)setStatus(value);})
   .catch(error=>{if(active)setMessage(error.message);});
  return()=>{active=false;};
 },[admin]);
 async function connect(){
  setBusy('connect');setMessage('');
  try{
   const result=await request('start');
   const url=new URL(result.authorize_url);
   if(url.origin!=='https://appcenter.intuit.com'||url.pathname!=='/connect/oauth2')throw Error('Invalid QuickBooks authorization destination.');
   window.location.assign(url.href);
  }catch(error){setMessage(error.message);setBusy('');}
 }
 async function disconnect(){
  if(!window.confirm('Disconnect QuickBooks invoice verification? Existing financial records will remain unchanged.'))return;
  setBusy('disconnect');setMessage('');
  try{
   await request('disconnect');setStatus(await request('status'));
   setMessage('QuickBooks access was revoked and the saved connection was removed.');
  }catch(error){setMessage(error.message);}finally{setBusy('');}
 }
 return <main className="page"><h1>QuickBooks connection</h1>
  <p>This connection reads original invoices for verification and printing. It does not create, edit, send or settle invoices.</p>
  {!admin?<p>An administrator must manage this connection.</p>:<section className="card">
   {message&&<p role="status">{message}</p>}
   <p>{status?.connected?'Connected':'Not connected'}{status?' · '+status.environment+' company':''}</p>
   {status&&!status.configured&&<p>Secure connection settings are not ready. Contact your administrator.</p>}
   <button type="button" disabled={Boolean(busy)||!status?.configured} onClick={connect}>
    {status?.connected?'Reconnect QuickBooks':'Connect QuickBooks'}</button>
   {status?.connected&&<button type="button" disabled={Boolean(busy)} onClick={disconnect}>Disconnect QuickBooks</button>}
  </section>}
  <p><Link to="/work-hub">Return to Work Hub</Link></p>
 </main>;
}
