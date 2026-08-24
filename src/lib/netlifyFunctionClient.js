import { supabase } from '../supabaseClient';

export class AuthenticatedFunctionError extends Error {
  constructor(message, { status = 0, code = '' } = {}) {
    super(message);
    this.name = 'AuthenticatedFunctionError';
    this.status = status;
    this.code = code;
  }
}

async function employeeAccessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;

  const token = data?.session?.access_token || '';
  if (!token) {
    throw new AuthenticatedFunctionError(
      'Your employee session has expired. Sign in again and retry.',
      { status: 401, code: 'session_missing' },
    );
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
    const payload = await response.clone().json().catch(() => ({}));
    throw new AuthenticatedFunctionError(
      payload?.error || payload?.message || 'Your employee session is no longer authorized. Sign in again and retry.',
      { status: 401, code: 'session_unauthorized' },
    );
  }
  if (response.status === 403) {
    const payload = await response.clone().json().catch(() => ({}));
    throw new AuthenticatedFunctionError(
      payload?.error || payload?.message || 'Your employee role does not permit this action.',
      { status: 403, code: 'role_forbidden' },
    );
  }
  return response;
}
