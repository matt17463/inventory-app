import { supabase } from '../supabaseClient';

async function employeeAccessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;

  const token = data?.session?.access_token || '';
  if (!token) {
    throw new Error('Your employee session has expired. Sign in again and retry.');
  }
  return token;
}

export async function authenticatedFunctionFetch(path, options = {}) {
  const token = await employeeAccessToken();
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  if (options.body != null && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(path, { ...options, headers });
  if (response.status === 401) {
    throw new Error('Your employee session is no longer authorized. Sign in again and retry.');
  }
  if (response.status === 403) {
    const payload = await response.clone().json().catch(() => ({}));
    throw new Error(payload?.error || payload?.message || 'Your employee role does not permit this action.');
  }
  return response;
}
