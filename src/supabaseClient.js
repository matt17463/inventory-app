import { createClient } from '@supabase/supabase-js';
import { shouldDetectSupabaseCallback } from './lib/authCallbackRouting';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    detectSessionInUrl: typeof window === 'undefined' || shouldDetectSupabaseCallback(new URL(window.location.href)),
  },
});
