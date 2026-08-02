# Read This First — Skilled Crafting v0.6.30

This release installs **Google Calendar Phase 1** on top of v0.6.29.

Do not deploy the application before running:

`deployment/sql/17_GOOGLE_CALENDAR_PHASE1.sql`

Then follow:

`GOOGLE_CALENDAR_PHASE1_DEPLOYMENT_GUIDE.md`

Phase 1 is intentionally one-way. Skilled Crafting sends dates and tasks to Google Calendar. Google Calendar never changes jobs, purchase orders, inventory, reservations, or employee tasks.

The release creates three secondary calendars owned by the Google account you connect:

- Skilled Crafting — Order Commitments
- Skilled Crafting — Purchasing
- Skilled Crafting — Owner Tasks

The production-calendar and calculated milestone work described in Phases 2 and 3 is not included yet.
