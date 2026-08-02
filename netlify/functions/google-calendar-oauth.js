import { authorizeEmployee, jsonResponse } from './_shared/security.js';
import {
  buildCalendarAuthorizationUrl,
  connectGoogleCalendar,
  verifyCalendarOAuthState,
} from './_shared/googleCalendar.js';

function htmlEscape(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function htmlResponse(statusCode, { title, message, success = false }) {
  const safeTitle = htmlEscape(title);
  const safeMessage = htmlEscape(message);
  const returnUrl = htmlEscape(`${String(process.env.SC_APP_URL || process.env.URL || 'https://inventory.skilledcrafting.com').replace(/\/+$/, '')}/google-calendar`);
  return {
    statusCode,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'",
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    },
    body: `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeTitle}</title>
<style>body{font-family:system-ui,-apple-system,sans-serif;background:#f4f7fb;color:#10233f;margin:0;display:grid;min-height:100vh;place-items:center}.card{background:#fff;border:1px solid #d7e0ec;border-radius:18px;box-shadow:0 16px 45px rgba(16,35,63,.12);max-width:560px;margin:24px;padding:36px}.status{font-weight:800;color:${success ? '#137333' : '#b3261e'}}button,a{display:inline-block;border:0;border-radius:10px;background:#0b57d0;color:#fff;padding:12px 18px;font-weight:700;cursor:pointer;text-decoration:none;margin:4px}</style></head>
<body><main class="card"><p class="status">${success ? 'Connected' : 'Connection failed'}</p><h1>${safeTitle}</h1><p>${safeMessage}</p><button onclick="window.close()">Close this window</button><a href="${returnUrl}">Return to Skilled Crafting</a></main>
<script>if(window.opener){window.opener.postMessage({type:'sc-google-calendar-oauth',success:${success ? 'true' : 'false'}},window.location.origin)}${success ? 'setTimeout(()=>window.close(),1800);' : ''}</script>
</body></html>`,
  };
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return jsonResponse(204, {}, event);

  if (event.httpMethod === 'POST') {
    const authorization = await authorizeEmployee(event, {
      functionName: 'google-calendar-oauth',
      allowedRoles: ['admin', 'manager'],
    });
    if (!authorization.ok) {
      return jsonResponse(authorization.statusCode, { success: false, error: authorization.message }, event);
    }
    try {
      const body = JSON.parse(event.body || '{}');
      if (body.action !== 'authorization_url') {
        return jsonResponse(400, { success: false, error: 'Use action authorization_url.' }, event);
      }
      const authorizationUrl = buildCalendarAuthorizationUrl({
        userId: authorization.user.id,
        role: authorization.role,
      });
      return jsonResponse(200, { success: true, authorization_url: authorizationUrl }, event);
    } catch (error) {
      console.error('google-calendar-oauth start error:', error);
      return jsonResponse(500, { success: false, error: error.message }, event);
    }
  }

  if (event.httpMethod === 'GET') {
    try {
      const params = event.queryStringParameters || {};
      if (params.error) {
        throw new Error(params.error_description || params.error);
      }
      if (!params.code || !params.state) throw new Error('Google did not return the required authorization details.');
      const state = verifyCalendarOAuthState(params.state);
      const result = await connectGoogleCalendar({
        authorizationCode: params.code,
        connectedBy: state.user_id,
      });
      return htmlResponse(200, {
        success: true,
        title: 'Google Calendar connected',
        message: `${result.connection.connected_email || 'The Google account'} is connected. Three Skilled Crafting calendars are ready. Return to the application and run the initial sync.`,
      });
    } catch (error) {
      console.error('google-calendar-oauth callback error:', error);
      return htmlResponse(400, {
        title: 'Google Calendar was not connected',
        message: error.message || 'The connection could not be completed.',
      });
    }
  }

  return jsonResponse(405, { success: false, error: 'Use GET or POST.' }, event);
};
