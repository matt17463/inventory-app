import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabaseClient';
import logo from './assets/logo.png';
import { authenticatedFunctionFetch } from './lib/netlifyFunctionClient';

const ACCESS_CHECK_TIMEOUT_MS = 8000;

export default function AuthGate({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [access, setAccess] = useState(null);
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessIssue, setAccessIssue] = useState(null);
  const [accessNotice, setAccessNotice] = useState('');
  const accessRef = useRef(null);
  const verificationSequenceRef = useRef(0);
  const sessionUserId = session?.user?.id || '';

  const rememberAccess = useCallback((nextAccess) => {
    accessRef.current = nextAccess;
    setAccess(nextAccess);
  }, []);

  const verifyAccess = useCallback(async () => {
    if (!sessionUserId) return;

    const sequence = ++verificationSequenceRef.current;
    const previousAccess = accessRef.current;
    const preserveOpenApp = previousAccess?.allowed === true && previousAccess.userId === sessionUserId;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), ACCESS_CHECK_TIMEOUT_MS);

    if (!preserveOpenApp) setAccessLoading(true);
    setAccessIssue(null);
    setAccessNotice('');

    try {
      const response = await authenticatedFunctionFetch('/.netlify/functions/application-integrity', {
        method: 'POST',
        body: JSON.stringify({ action: 'health' }),
        signal: controller.signal,
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body.success === false) {
        const error = new Error(body.message || 'Employee access could not be verified.');
        error.status = response.status;
        throw error;
      }
      if (sequence !== verificationSequenceRef.current) return;

      rememberAccess({
        allowed: true,
        role: body.data?.role || 'employee',
        userId: sessionUserId,
      });
    } catch (error) {
      if (sequence !== verificationSequenceRef.current) return;

      const status = Number(error?.status || 0);
      if (status === 403) {
        rememberAccess({
          allowed: false,
          reason: 'denied',
          message: error.message || 'This signed-in account does not have an active application role.',
          userId: sessionUserId,
        });
        return;
      }

      const issueMessage = status === 401
        ? 'Your employee session could not be renewed. Keep this page open, then retry or sign out after saving your work.'
        : 'Employee access verification is temporarily unavailable. Your account has not been marked inactive.';

      if (preserveOpenApp) {
        setAccessNotice(issueMessage);
      } else {
        setAccessIssue({ message: issueMessage, detail: error?.message || '' });
      }
    } finally {
      window.clearTimeout(timeout);
      if (sequence === verificationSequenceRef.current) setAccessLoading(false);
    }
  }, [rememberAccess, sessionUserId]);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) setMessage(error.message || 'The saved employee session could not be loaded.');
        setSession(data?.session || null);
        setLoading(false);
      })
      .catch((error) => {
        if (!mounted) return;
        setMessage(error?.message || 'The saved employee session could not be loaded.');
        setSession(null);
        setLoading(false);
      });

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;

      const nextUserId = nextSession?.user?.id || '';
      const verifiedUserId = accessRef.current?.userId || '';
      setSession(nextSession || null);
      setLoading(false);

      if (event === 'SIGNED_OUT' || !nextSession) {
        verificationSequenceRef.current += 1;
        rememberAccess(null);
        setAccessIssue(null);
        setAccessNotice('');
        return;
      }

      // TOKEN_REFRESHED and same-user SIGNED_IN events are routine when a
      // background tab wakes up. Preserve the mounted application and its
      // unsaved form state; protected server calls still validate every token.
      if (verifiedUserId && verifiedUserId !== nextUserId) {
        verificationSequenceRef.current += 1;
        rememberAccess(null);
        setAccessIssue(null);
        setAccessNotice('');
      }
    });

    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, [rememberAccess]);

  useEffect(() => {
    if (!sessionUserId) return;
    if (accessRef.current?.allowed && accessRef.current.userId === sessionUserId) return;
    verifyAccess();
  }, [sessionUserId, verifyAccess]);

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
    verificationSequenceRef.current += 1;
    rememberAccess(null);
    setAccessIssue(null);
    setAccessNotice('');
    await supabase.auth.signOut();
  }

  if (loading || (session && access === null && !accessIssue)) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <img src={logo} alt="Skilled Crafting" />
          <h1>{accessLoading ? 'Verifying employee access...' : 'Loading inventory system...'}</h1>
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

  if (access?.reason === 'denied') {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <img src={logo} alt="Skilled Crafting" />
          <p className="eyebrow">Employee Access</p>
          <h1>Account access is not active</h1>
          <p className="helper-text">{access.message}</p>
          <button type="button" onClick={signOut}>Sign out</button>
        </section>
      </main>
    );
  }

  if (!access?.allowed) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <img src={logo} alt="Skilled Crafting" />
          <p className="eyebrow">Employee Access</p>
          <h1>Access verification is temporarily unavailable</h1>
          <p className="helper-text">{accessIssue?.message}</p>
          {accessIssue?.detail && <p className="auth-technical-detail">{accessIssue.detail}</p>}
          <div className="auth-actions">
            <button type="button" onClick={verifyAccess} disabled={accessLoading}>
              {accessLoading ? 'Checking...' : 'Retry access check'}
            </button>
            <button type="button" className="secondary" onClick={signOut}>Sign out</button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <>
      {accessNotice && (
        <aside className="employee-access-notice" role="status" aria-live="polite">
          <span>{accessNotice} Open entries remain on this page.</span>
          <button type="button" onClick={verifyAccess} disabled={accessLoading}>
            {accessLoading ? 'Checking...' : 'Retry'}
          </button>
        </aside>
      )}
      <button type="button" className="employee-signout" onClick={signOut}>
        {access.role} · Sign out
      </button>
      {children}
    </>
  );
}
