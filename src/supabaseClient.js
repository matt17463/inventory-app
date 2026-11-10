import { createClient } from '@supabase/supabase-js';
import { shouldDetectSupabaseCallback } from './lib/authCallbackRouting';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
}

// Capture link presence before Supabase consumes and removes callback parameters.
export const passwordSetupLinkDetected = typeof window !== 'undefined' && (() => {
  const url = new URL(window.location.href);
  if (url.pathname !== '/reset-password') return false;
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
  return url.searchParams.has('code') ||
    (hash.has('access_token') && ['recovery', 'invite'].includes(hash.get('type')));
})();

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    detectSessionInUrl: typeof window === 'undefined' || shouldDetectSupabaseCallback(new URL(window.location.href)),
  },
});
