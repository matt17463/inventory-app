# Printer activity reminders (staged development)

This feature is on branch `feature/printer-idle-monitoring-omni`; it is not a production deployment.

Operations Home shows a compact reminder card. Equipment & Remote Access shows editable reminder settings for Roland BN2-30 and xTool Omni Dual UV.

- Last successful print is entered manually. It is **not** a confirmed telemetry value.
- Reminder intervals can be 1–365 days per printer. Until a date is recorded, status is unknown rather than healthy.
- Sleep/Normal/Vacation record a **manually observed** state only. Selecting a state does not command a printer.
- Data currently persists in the signed-in user's browser. It does not synchronize among devices or with Home Assistant.
- xTool Studio's Device Health page is the official way to change Omni printhead Sleep/Wake/Vacation. Never claim the app changes this mode.
- Roland's automatic sleep and maintenance are managed by its existing onboard/Connect Hub systems; do not remote-cut power to clear inactivity.

Remaining integration: inspect and safely implement shared Supabase records, Home Assistant helpers, authenticated bridge events, xTool device capabilities, and verified physical mode control only if supported. See the included Work handoff for tasks and acceptance criteria.

References:
- https://support.xtool.com/article/3081
- https://www.home-assistant.io/integrations/input_datetime/
