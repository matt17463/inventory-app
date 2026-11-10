import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { passwordProblem } from './lib/passwordSecurity';
import logo from './assets/logo.png';

export default function ResetPassword() {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState(null);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    let mounted = true;
    const parameters = new URLSearchParams(window.location.search);
    const linkError = parameters.get('error_description') || parameters.get('error');
    if (linkError) setError('This link has expired or cannot be used. Request a new reset link.');

    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      if (mounted) {
        setSession(next);
        setReady(true);
      }
    });
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!mounted) return;
      if (sessionError) setError('Unable to validate this link. Request another reset email.');
      setSession(data?.session || null);
      setReady(true);
    }).catch(() => {
      if (mounted) {
        setError('Unable to validate this link. Request another reset email.');
        setReady(true);
      }
    });
    return () => { mounted = false; listener?.subscription?.unsubscribe(); };
  }, []);

  async function save(event) {
    event.preventDefault();
    const problem = passwordProblem(password, confirmation);
    if (problem) { setError(problem); return; }
    if (!session) { setError('Your recovery link is no longer valid. Request a new one.'); return; }
    setBusy(true);
    setError('');
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setCompleted(true);
      setPassword('');
      setConfirmation('');
      // End the recovery session; require a normal employee sign-in.
      await supabase.auth.signOut();
    } catch (caught) {
      setError(caught.message || 'Unable to save password. Please request another link.');
    } finally {
      setBusy(false);
    }
  }

  return <main className="auth-page">
    <section className="auth-card">
      <img src={logo} alt="Skilled Crafting" />
      <p className="eyebrow">Employee Account Security</p>
      <h1>{completed ? 'Password updated' : 'Set your password'}</h1>
      {completed ? <>
        <p role="status">Your password was saved. Sign in using your new password.</p>
        <a href="/">Return to sign in</a>
      </> : !ready ? <p>Checking your secure link...</p> : !session ? <>
        <p role="alert">{error || 'No valid invitation or recovery session was found. The link may have expired.'}</p>
        <a href="/">Return to sign in to request a new link</a>
      </> : <>
        <p className="helper-text">Choose a password with at least 12 characters, including a letter and a number.</p>
        <form onSubmit={save}>
          <label>New password
            <input type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} required minLength={12} />
          </label>
          <label>Confirm new password
            <input type="password" autoComplete="new-password" value={confirmation} onChange={e => setConfirmation(e.target.value)} required minLength={12} />
          </label>
          <button type="submit" disabled={busy}>{busy ? 'Saving...' : 'Save password'}</button>
        </form>
        {error && <p role="alert" className="message error-message">{error}</p>}
      </>}
    </section>
  </main>;
}
