import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

// Server clients need an explicit transport on runtimes without native WebSocket.
export function createServerSupabaseClient(url, key, options = {}) {
  return createClient(url, key, {
    ...options,
    realtime: { ...options.realtime, transport: WebSocket },
  });
}
