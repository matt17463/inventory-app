# Release notes — v0.7.3

## Copy-to-all placement repair

- Replaces the unverified multi-row placement upsert with one verified save per target blank photo.
- Sends an explicit placement payload instead of copying database-managed fields from the original row.
- Removes duplicate target blank IDs before copying.
- Stops and displays the affected blank ID when any copy fails.
- Confirms the number of additional blanks and total placements saved for the selected artwork.
- Requires no Supabase SQL migration or new environment variables.

After copying one saved placement in a project containing three blank photos, the application should report two additional copies and show three Generate cards for that artwork.
