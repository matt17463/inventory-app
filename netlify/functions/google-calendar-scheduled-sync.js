import { runCalendarSync } from './_shared/googleCalendar.js';

export const scheduledGoogleCalendarSync = async () => {
  try {
    const result = await runCalendarSync({
      triggerSource: 'netlify_schedule',
      requestedBy: 'netlify_schedule',
      force: false,
    });
    console.log('Scheduled Google Calendar sync:', JSON.stringify(result));
  } catch (error) {
    console.error('Scheduled Google Calendar sync failed:', error?.message || error);
  }
};

export default scheduledGoogleCalendarSync;
