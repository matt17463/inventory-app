import { authorizeEmployee, jsonResponse } from './_shared/security.js';
import {
  buildCalendarAuthorizationUrl,
  calendarAdminStatus,
  disconnectGoogleCalendar,
  runCalendarSync,
  saveCalendarSettings,
} from './_shared/googleCalendar.js';

function bodyJson(event) {
  try { return JSON.parse(event.body || '{}'); } catch { throw new Error('The request body is not valid JSON.'); }
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return jsonResponse(204, {}, event);
  if (!['GET', 'POST'].includes(event.httpMethod)) {
    return jsonResponse(405, { success: false, error: 'Use GET or POST.' }, event);
  }

  const authorization = await authorizeEmployee(event, {
    functionName: 'google-calendar-admin',
    allowedRoles: ['admin', 'manager'],
  });
  if (!authorization.ok) {
    return jsonResponse(authorization.statusCode, { success: false, error: authorization.message }, event);
  }

  try {
    if (event.httpMethod === 'GET') {
      return jsonResponse(200, { success: true, ...(await calendarAdminStatus()) }, event);
    }

    const body = bodyJson(event);
    if (body.action === 'authorization_url') {
      return jsonResponse(200, {
        success: true,
        authorization_url: buildCalendarAuthorizationUrl({ userId: authorization.user.id, role: authorization.role }),
      }, event);
    }
    if (body.action === 'sync' || body.action === 'rebuild') {
      const result = await runCalendarSync({
        triggerSource: body.action === 'rebuild' ? 'manual_rebuild' : 'manual',
        requestedBy: authorization.user.email || authorization.user.id,
        force: body.action === 'rebuild',
      });
      return jsonResponse(200, { success: true, result, ...(await calendarAdminStatus()) }, event);
    }
    if (body.action === 'save_settings') {
      const status = await saveCalendarSettings({
        timeZone: body.time_zone,
        ownerEmployeeId: body.owner_employee_id,
        minimumPriority: body.owner_task_priority_min,
        targetSettings: body.targets,
      });
      return jsonResponse(200, { success: true, ...status }, event);
    }
    if (body.action === 'disconnect') {
      await disconnectGoogleCalendar();
      return jsonResponse(200, { success: true, ...(await calendarAdminStatus()) }, event);
    }
    return jsonResponse(400, { success: false, error: 'Unknown Google Calendar administration action.' }, event);
  } catch (error) {
    console.error('google-calendar-admin error:', error);
    const schemaMissing = /sc_google_calendar_|relation .* does not exist/i.test(error.message || '');
    return jsonResponse(schemaMissing ? 503 : 500, {
      success: false,
      error: schemaMissing
        ? 'Google Calendar Phase 1 SQL is not installed. Run deployment/sql/17_GOOGLE_CALENDAR_PHASE1.sql first.'
        : (error.message || 'Google Calendar operation failed.'),
    }, event);
  }
};
