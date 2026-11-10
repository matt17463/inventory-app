import { useState } from 'react';
import { supabase } from './supabaseClient';
import { passwordProblem } from './lib/passwordSecurity';

export default function AccountSecurity() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function changePassword(event) {
    event.preventDefault();
    const problem = passwordProblem(password, confirmation);
    if (problem) { setError(problem); return; }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const { data, error: userError } = await supabase.auth.getUser();
      if (userError || !data?.user?.email) throw new Error('Please sign in again to change your password.');
      // Check the current password before replacing it; no admin keys are used in the browser.
      const { error: currentError } = await supabase.auth.signInWithPassword({ email: data.user.email, password: current });
      if (currentError) throw new Error('Current password is incorrect.');
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setCurrent('');
      setPassword('');
      setConfirmation('');
      setOpen(false);
      setMessage('Password changed successfully.');
    } catch (caught) {
      setError(caught.message || 'Password change failed.');
    } finally {
      setBusy(false);
    }
  }

  return <>
    <div className="employee-security-action">
      <button type="button" onClick={() => { setOpen(!open); setError(''); setMessage(''); }}>
        {open ? 'Close security' : 'Change password'}
      </button>
      {message && <span role="status">{message}</span>}
    </div>
    {open && <div className="employee-security-dialog" role="dialog" aria-modal="true" aria-label="Change password">
      <section className="auth-card employee-security-card">
        <h2>Change your password</h2>
        <p>Enter your current password and choose a new password (12+ characters, a letter and a number).</p>
        <form onSubmit={changePassword}>
          <label>Current password
            <input type="password" autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} required />
          </label>
          <label>New password
            <input type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} minLength={12} required />
          </label>
          <label>Confirm new password
            <input type="password" autoComplete="new-password" value={confirmation} onChange={e => setConfirmation(e.target.value)} minLength={12} required />
          </label>
          {error && <p role="alert" className="message error-message">{error}</p>}
          <div className="auth-actions">
            <button type="submit" disabled={busy}>{busy ? 'Saving...' : 'Update password'}</button>
            <button type="button" className="secondary" disabled={busy} onClick={() => { setOpen(false); setCurrent(''); setPassword(''); setConfirmation(''); }}>Cancel</button>
          </div>
        </form>
      </section>
    </div>}
  </>;
}
