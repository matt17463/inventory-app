import { useCallback, useContext, useEffect, useState } from 'react';
import { EmployeeAccessContext } from './lib/employeeAccessContext';
import { authenticatedFunctionFetch } from './lib/netlifyFunctionClient';

const roles = ['viewer', 'operator', 'manager', 'admin'];

export default function UserManagement() {
  const access = useContext(EmployeeAccessContext);
  const [users, setUsers] = useState([]);
  const [history, setHistory] = useState([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('operator');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const action = useCallback(async payload => {
    const response = await authenticatedFunctionFetch('/.netlify/functions/user-management', {
      method: 'POST', body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) throw Error(result.error || 'Request failed.');
    return result;
  }, []);

  const refresh = useCallback(async () => {
    const [employees, events] = await Promise.all([
      action({ action: 'list' }), action({ action: 'reset-history' }),
    ]);
    setUsers(employees.users || []);
    setHistory(events.history || []);
  }, [action]);

  useEffect(() => {
    if (access?.role === 'admin') refresh().catch(error => setNotice(error.message));
  }, [access?.role, refresh]);

  async function handle(callback) {
    setBusy(true);
    setNotice('');
    try {
      const result = await callback();
      setNotice(result?.message || 'Changes saved.');
      await refresh();
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy(false);
    }
  }

  function sendReset(user) {
    if (!window.confirm(`Send a password reset email to ${user.email}?`)) return;
    handle(() => action({ action: 'reset-password', user_id: user.id }));
  }

  if (access?.role !== 'admin') {
    return <main className="page"><h1>User management</h1><p>Administrator access required.</p></main>;
  }

  const userEmails = new Map(users.map(user => [user.id, user.email]));
  return <main className="page">
    <div className="page-header"><div>
      <p className="eyebrow">Tools &amp; Admin · Access</p>
      <h1>User Management</h1>
      <p>Invite employees, manage roles, and send secure password recovery emails. Passwords are never displayed to administrators.</p>
    </div></div>
    {notice && <p role="status" className="message">{notice}</p>}
    <section className="card elevated-card">
      <h2>Invite an employee</h2>
      <form onSubmit={event => {
        event.preventDefault();
        handle(async () => {
          const result = await action({ action: 'invite', email, role });
          setEmail('');
          return result;
        });
      }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <label>Email
            <input type="email" value={email} required onChange={event => setEmail(event.target.value)}
              placeholder="employee@example.com" />
          </label>
          <label>Role
            <select value={role} onChange={event => setRole(event.target.value)}>
              {roles.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
        </div>
        <button type="submit" disabled={busy || !email.trim()}>Send invitation</button>
      </form>
      <p><small>New employees set their own password via the emailed invitation. Configure Supabase Auth email delivery and allow https://inventory.skilledcrafting.com/reset-password as a redirect URL.</small></p>
    </section>
    <section className="card elevated-card">
      <h2>Employee accounts ({users.length})</h2>
      <button type="button" disabled={busy} onClick={() => handle(async () => { await refresh(); return { message: 'Employee accounts refreshed.' }; })}>Refresh users</button>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%' }}>
          <thead><tr><th>Email</th><th>Role</th><th>Status</th><th>Last sign-in</th><th>Actions</th></tr></thead>
          <tbody>{users.map(user => <UserRow key={user.id} user={user} busy={busy}
            self={user.id === access.userId}
            onSave={(nextRole, isActive) => handle(() => action({
              action: 'update', user_id: user.id, role: nextRole, is_active: isActive,
            }))}
            onReset={() => sendReset(user)} />)}</tbody>
        </table>
      </div>
      <p><small>Disabling an account blocks application access; it does not immediately revoke existing Supabase tokens. Revoke sessions in Supabase Auth for urgent access removal.</small></p>
    </section>
    <section className="card elevated-card">
      <h2>Administrator password reset history</h2>
      <p><small>Records reset email requests, not password values or whether the recipient completed a reset.</small></p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%' }}>
          <thead><tr><th>Requested</th><th>Administrator</th><th>Employee</th><th>Email request</th></tr></thead>
          <tbody>{history.length ? history.map((entry, index) => <tr key={entry.created_at + index}>
            <td>{new Date(entry.created_at).toLocaleString()}</td>
            <td>{userEmails.get(entry.actor_id) || 'Former administrator'}</td>
            <td>{userEmails.get(entry.target_id) || 'Former employee'}</td>
            <td>{entry.outcome === 'sent' ? 'Sent to Supabase email service' : 'Failed'}</td>
          </tr>) : <tr><td colSpan={4}>No administrator reset requests recorded yet.</td></tr>}</tbody>
        </table>
      </div>
    </section>
  </main>;
}

function UserRow({ user, busy, self, onSave, onReset }) {
  const [role, setRole] = useState(user.role || 'viewer');
  const [active, setActive] = useState(user.is_active);
  useEffect(() => {
    setRole(user.role || 'viewer');
    setActive(user.is_active);
  }, [user.role, user.is_active]);
  return <tr>
    <td>{user.email}{self ? ' (you)' : ''}</td>
    <td><select disabled={busy || self} value={role} onChange={event => setRole(event.target.value)}>
      {roles.map(item => <option key={item} value={item}>{item}</option>)}
    </select></td>
    <td><label><input type="checkbox" disabled={busy || self} checked={active}
      onChange={event => setActive(event.target.checked)} /> {active ? 'Active' : 'Inactive'}</label></td>
    <td>{user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString() : 'Never'}</td>
    <td><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <button type="button" disabled={busy || self || (role === user.role && active === user.is_active)}
        onClick={() => onSave(role, active)}>Save access</button>
      <button type="button" className="secondary" disabled={busy || !user.email} onClick={onReset}>
        Send reset link
      </button>
    </div></td>
  </tr>;
}
