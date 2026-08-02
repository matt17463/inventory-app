import { authenticatedFunctionFetch } from './netlifyFunctionClient';

async function payload(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    throw new Error(data.error || data.message || `Google Calendar request failed (${response.status}).`);
  }
  return data;
}

export async function getGoogleCalendarStatus() {
  return payload(await authenticatedFunctionFetch('/.netlify/functions/google-calendar-admin', { method: 'GET' }));
}

export async function startGoogleCalendarConnection() {
  return payload(await authenticatedFunctionFetch('/.netlify/functions/google-calendar-oauth', {
    method: 'POST',
    body: JSON.stringify({ action: 'authorization_url' }),
  }));
}

export async function runGoogleCalendarSync({ rebuild = false } = {}) {
  return payload(await authenticatedFunctionFetch('/.netlify/functions/google-calendar-admin', {
    method: 'POST',
    body: JSON.stringify({ action: rebuild ? 'rebuild' : 'sync' }),
  }));
}

export async function saveGoogleCalendarSettings(settings) {
  return payload(await authenticatedFunctionFetch('/.netlify/functions/google-calendar-admin', {
    method: 'POST',
    body: JSON.stringify({ action: 'save_settings', ...settings }),
  }));
}

export async function disconnectGoogleCalendar() {
  return payload(await authenticatedFunctionFetch('/.netlify/functions/google-calendar-admin', {
    method: 'POST',
    body: JSON.stringify({ action: 'disconnect' }),
  }));
}
