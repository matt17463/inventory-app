# Artwork Workflow Reliability Patch v1.4.26

This patch addresses three related Artwork System issues:

1. Mockup delete/replace protection was request-wide. It now protects the exact approved/Vault-referenced image instead of locking unrelated mockups on the same request. Replacing a protected image creates a new mockup version and retains the protected original for history/downstream integrity.
2. DTF readiness no longer requires the local WordPress Media file. It uses the local attachment when readable and otherwise downloads the durable R2-backed proxy URL to a temporary file for analysis.
3. Artwork activity now reaches the inventory application for manual requests and meaningful updates, and the inventory app Home page shows recent artwork notifications with unread state and a direct Artwork Queue link.

## WordPress versions

- Skilled Crafting Artwork System: 1.2.1
- Skilled Crafting Artwork System - Inventory Auto Sync: 1.1.0

## Inventory app

Apply `scripts/apply_artwork_workflow_notifications_v1_4_26.py` from the repository root package. It upgrades application version 1.4.25 to 1.4.26 when appropriate and adds the artwork homepage regression test.

No Supabase SQL is required. The Home notification panel reads the existing `sc_artwork_system_handoffs` table.
