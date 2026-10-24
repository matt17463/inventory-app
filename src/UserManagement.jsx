import {useCallback,useContext,useEffect,useState} from 'react';
import {EmployeeAccessContext} from './lib/employeeAccessContext';
import {authenticatedFunctionFetch} from './lib/netlifyFunctionClient';
const roles=['viewer','operator','manager','admin'];
export default function UserManagement(){
 const access=useContext(EmployeeAccessContext);
 const [users,setUsers]=useState([]),[email,setEmail]=useState(''),[role,setRole]=useState('operator');
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const action=useCallback(async payload=>{
  const res=await authenticatedFunctionFetch('/.netlify/functions/user-management',{method:'POST',body:JSON.stringify(payload)});
  const json=await res.json().catch(()=>({}));if(!res.ok||!json.success)throw Error(json.error||'Request failed.');
  return json;
 },[]);
 const refresh=useCallback(async()=>{const result=await action({action:'list'});setUsers(result.users||[]);},[action]);
 useEffect(()=>{if(access?.role==='admin')refresh().catch(e=>setNotice(e.message));},[access?.role,refresh]);
 async function handle(callback){setBusy(true);setNotice('');try{await callback();await refresh();}catch(e){setNotice(e.message);}finally{setBusy(false);}}
 if(access?.role!=='admin')return <main className="page"><h1>User management</h1><p>Administrator access required.</p></main>;
 return <main className="page"><div className="page-header"><div><p className="eyebrow">Tools &amp; Admin · Access</p><h1>User Management</h1><p>Invite staff, assign access roles, and disable application access without deleting historical records.</p></div></div>
 {notice&&<p role="status" className="message">{notice}</p>}
 <section className="card elevated-card"><h2>Invite a user</h2><form onSubmit={e=>{e.preventDefault();handle(async()=>{const r=await action({action:'invite',email,role});setEmail('');setNotice(r.message);});}}>
 <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
 <label>Email<input type="email" value={email} required onChange={e=>setEmail(e.target.value)} placeholder="employee@example.com"/></label>
 <label>Role<select value={role} onChange={e=>setRole(e.target.value)}>{roles.map(r=><option key={r} value={r}>{r}</option>)}</select></label>
 </div><button type="submit" disabled={busy||!email.trim()}>Send invitation</button></form>
 <p><small>Invitations are sent via Supabase Auth. Configure Supabase email delivery and allowed redirect URLs before inviting staff.</small></p></section>
 <section className="card elevated-card"><h2>Employee accounts ({users.length})</h2><button type="button" disabled={busy} onClick={()=>handle(async()=>{})}>Refresh users</button>
 <div style={{overflowX:'auto'}}><table style={{width:'100%'}}><thead><tr><th>Email</th><th>Role</th><th>Status</th><th>Last sign-in</th><th>Action</th></tr></thead><tbody>
 {users.map(user=><UserRow key={user.id} user={user} busy={busy} self={user.id===access.userId} onSave={(r,a)=>handle(async()=>{await action({action:'update',user_id:user.id,role:r,is_active:a});})}/>)}
 </tbody></table></div><p><small>Deactivating blocks application authorization; it does not revoke an existing Supabase token immediately. For urgent access removal, revoke the user's sessions in Supabase Auth as well.</small></p></section></main>;
}
function UserRow({user,busy,self,onSave}){
 const [role,setRole]=useState(user.role||'viewer'),[active,setActive]=useState(user.is_active);
 useEffect(()=>{setRole(user.role||'viewer');setActive(user.is_active);},[user.role,user.is_active]);
 return <tr><td>{user.email}{self?' (you)':''}</td><td><select disabled={busy||self} value={role} onChange={e=>setRole(e.target.value)}>{roles.map(r=><option key={r} value={r}>{r}</option>)}</select></td>
 <td><label><input type="checkbox" disabled={busy||self} checked={active} onChange={e=>setActive(e.target.checked)}/> {active?'Active':'Inactive'}</label></td>
 <td>{user.last_sign_in_at?new Date(user.last_sign_in_at).toLocaleDateString():'Never'}</td>
 <td><button type="button" disabled={busy||self||(role===user.role&&active===user.is_active)} onClick={()=>onSave(role,active)}>Save</button></td></tr>;
}
