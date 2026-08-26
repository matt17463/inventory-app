# Mockup Exact Server Hotfix v1.0.6

- Replaces browser-side Exact Clean rendering with an authenticated server-side Sharp compositor.
- Removes the browser-to-R2 download dependency that produced `Failed to fetch` despite working AI generation.
- Preserves white ink, normal/multiply/screen/overlay blending, placement coordinates, print scale, rotation, opacity, shadows, and captions.
- Saves exact outputs and previews directly to private R2.
- Records exact generation history with success or actionable failure details.
- Cleans an uploaded R2 output if its database record cannot be committed.
- Requires no database migration and no new environment variables.
