import { createClient } from "@supabase/supabase-js";

// TEMP DEBUG — this will show what Netlify is injecting
console.log("ENV CHECK:", {
  url: import.meta.env.VITE_SUPABASE_URL,
  anon: import.meta.env.VITE_SUPABASE_ANON_KEY
});

// Load environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Hard fail if missing — prevents silent blank-screen crashes
if (!supabaseUrl) {
  throw new Error("VITE_SUPABASE_URL is missing. Check Netlify environment variables.");
}

if (!supabaseAnonKey) {
  throw new Error("VITE_SUPABASE_ANON_KEY is missing. Check Netlify environment variables.");
}

// Create the client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
