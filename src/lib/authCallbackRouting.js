export function shouldDetectSupabaseCallback(url) {
  // Home Assistant owns this authorization code; Supabase must preserve it.
  return !(url.pathname === '/equipment-center' && url.searchParams.get('auth_callback') === '1');
}
