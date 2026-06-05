import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import logo from './assets/logo.png';

export default function AuthGate({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSession(data.session || null);
        setLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession || null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  async function signIn(event) {
    event.preventDefault();
    setMessage('');
    setBusy(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;
    } catch (err) {
      setMessage(err.message || 'Unable to sign in.');
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setMessage('');
    await supabase.auth.signOut();
  }

  if (loading) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <img src={logo} alt="Skilled Crafting" />
          <h1>Loading inventory system...</h1>
        </section>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <img src={logo} alt="Skilled Crafting" />
          <p className="eyebrow">Employee Access</p>
          <h1>Sign in to Skilled Crafting Inventory</h1>
          <p className="helper-text">
            This application is limited to employee accounts created in Supabase Authentication.
          </p>

          <form onSubmit={signIn}>
            <label>
              Email
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>

            <label>
              Password
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>

            <button type="submit" disabled={busy}>
              {busy ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {message && <p className="message error-message">{message}</p>}
        </section>
      </main>
    );
  }

  return (
    <>
      <button type="button" className="employee-signout" onClick={signOut}>
        Sign out
      </button>
      {children}
    </>
  );
}
