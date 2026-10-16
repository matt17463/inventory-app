export function shouldDetectSupabaseCallback(url) {
  // Home Assistant owns this authorization code; Supabase must preserve it.
  return !(['/equipment-center', '/shop-equipment'].includes(url.pathname) && url.searchParams.get('auth_callback') === '1');
}
