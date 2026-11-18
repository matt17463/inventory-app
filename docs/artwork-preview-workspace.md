# Artwork preview workspace

## What changed
UV Studio (Advanced Raised Stitch Designer), DTF Prep Studio and Mockup Studio placement editing keep the visual proof visible while adjusting the artwork. On wide desktop screens the proof is on the right. On smaller screens the tools fall back to their responsive layouts.

## Working with the preview
1. Open UV Studio, DTF Prep Studio or Mockup Studio placement editing.
2. Load or select the artwork. Use the usual adjustment controls. The preview changes without saving or exporting.
3. To keep a larger preview on a second monitor, click **Pop out preview** above the visual proof.
4. Move the new browser window to the other monitor. Continue editing in the original window; the companion proof is read-only.
5. Close the companion window when finished. The original project and unsaved edits remain in the main editor.

If your browser blocks the pop-out, allow pop-ups for the Skilled Crafting application and try again. The UV editor also has an **Open separate full-page editor** option: this is a separate editing session, not the read-only synchronized proof.

## Important limitations
- These are **visual proofs** and do not replace RIP/UV printer simulation, xTool Studio setup, certified artwork, or physical print quality checks.
- Changing a proof tab does not change the exported artwork or production recipe by itself.
- Pop-out windows need the same logged-in browser session and should be closed when work is finished. Do not leave private customer artwork visible on unattended second displays.
- On some tablet or small desktop resolutions, previews are stacked rather than pinned.

## Engineering notes
The React viewers use a same-origin child window to display read-only DOM clones. They do not create a second editable React application or send images to a third-party service. The UV standalone designer copies the already-rendered preview canvas to a local same-origin pop-out. No database changes or new storage tables are required.

## Release checklist
Confirm responsive layout, Chrome/Safari behavior, correct preview tab/content updates, pop-up blocker fallback, protected R2 image display, no exported-file changes and no regressions in artwork editing. Test and build must pass before enabling production.
