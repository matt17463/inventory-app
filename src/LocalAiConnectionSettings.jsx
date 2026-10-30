import {useContext,useEffect,useState} from 'react';
import {EmployeeAccessContext} from './lib/employeeAccessContext';
import {loadLocalAiConnection,saveLocalAiConnection} from './lib/localAiGateway';
export default function LocalAiConnectionSettings(){
 const access=useContext(EmployeeAccessContext);const admin=['admin','manager'].includes(access?.role);
 const [url,setUrl]=useState(''),[enabled,setEnabled]=useState(false),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{loadLocalAiConnection().then(c=>{setUrl(c.endpoint||'');setEnabled(c.enabled);}).catch(e=>setMessage(e.message));},[]);
 async function save(e){e.preventDefault();setBusy(true);setMessage('');try{await saveLocalAiConnection(url,enabled);setMessage('Private gateway settings saved. The local host must be online and running Ollama.');}catch(e){setMessage(e.message);}finally{setBusy(false);}}
 return <section className="cos-card"><h3>Private workshop AI connection</h3><p>Runs an Ollama model on your own Pi or Mac. Requires an approved Tailscale Serve HTTPS address; no cloud AI fallback.</p>
 {admin?<form onSubmit={save} className="cos-knowledge-editor"><label className="cos-field">Tailscale HTTPS endpoint<input type="url" value={url} placeholder="https://your-device.tail934ae0.ts.net:8443" onChange={e=>setUrl(e.target.value)} required/></label>
 <label><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/> Enable local gateway for authorized staff</label><button type="submit" disabled={busy}>{busy?'Saving…':'Save private AI connection'}</button></form>:<p>Only an admin or manager can update the local gateway address.</p>}
 {message&&<p role="status">{message}</p>}</section>;
}