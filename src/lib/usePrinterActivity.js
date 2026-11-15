import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

export default function usePrinterActivity() {
  const [account, setAccount] = useState(null);
  const [result, setResult] = useState({ rows: [], role: null });
  const [revision, setRevision] = useState(0);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAccount(session?.user?.id || '');
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!account) return undefined;
    let active = true;
    let latest = 0;
    async function load() {
      const request = ++latest;
      try {
        const [snapshot, permission] = await Promise.all([
          supabase.from('sc_printer_activity').select('*'),
          supabase.rpc('sc_current_app_role'),
        ]);
        if (!active || request !== latest) return;
        if (snapshot.error || permission.error) throw new Error('Printer activity unavailable');
        setResult({ account, rows: snapshot.data, role: permission.data });
      } catch {
        if (active && request === latest) setResult({ account, rows: [], role: null, unavailable: true });
      } finally {
        if (active) setNow(Date.now());
      }
    }
    load();
    const timer = window.setInterval(load, 60000);
    window.addEventListener('focus', load);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', load);
    };
  }, [account, revision]);

  return {
    ...(account && result.account === account
      ? result : { rows: [], role: null, loading: account !== '' }),
    now,
    refresh: () => setRevision((value) => value + 1),
  };
}
