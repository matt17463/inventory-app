# Skilled Crafting v0.6.30 — Google Calendar Phase 1

## New

- Owner-authorized Google Calendar connection using the narrow `calendar.app.created` permission.
- Three dedicated Skilled Crafting calendars for order due dates, purchase-order expected arrivals, and owner tasks.
- One-way, idempotent event synchronization with stable Google event IDs.
- Automatic Netlify sync every 15 minutes on production deployments.
- Manual **Sync Now** and **Rebuild Calendar Sync** controls.
- Calendar settings for business time zone, owner employee, minimum task priority, and enabled calendars.
- Sync history, managed-event counts, errors, health status, and disconnect controls.
- Direct links from Google events back to pull sheets, purchase-order receiving, and employee tasks.

## Security

- Google refresh tokens are encrypted at rest with AES-256-GCM.
- OAuth state is signed, time-limited, and associated with the authenticated employee.
- Client secrets and encryption keys remain in server-only Netlify variables.
- Calendar administration requires an authenticated active admin or manager role.
- Supabase calendar tables use row-level security and are unavailable to browser roles.
- The integration cannot access unrelated calendars; it manages calendars it creates.

## Sync behavior

- Completed, cancelled, voided, deleted, refunded, or received records are removed from managed active calendars.
- Date changes update the existing event instead of creating another event.
- A rebuild repairs Google-side edits without duplicating events.
- Sync runs are concurrency guarded and capped per execution; additional changes continue in later runs.
- Google Calendar edits never write back to Skilled Crafting.

## Not included

- Production-window synchronization (Phase 2).
- Backward-planned artwork, purchasing, production, QC, and delivery milestones (Phase 3).
- Bidirectional Google-to-application editing.
