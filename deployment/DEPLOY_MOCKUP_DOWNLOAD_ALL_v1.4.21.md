# Skilled Crafting Inventory App — Mockup Studio Download All Graphics v1.4.21

## Feature

Adds a new **Download project graphics** panel to each active Mockup Studio project.

This is intentionally different from **Local Image Archive**:

- Download Project Graphics creates a local copy only.
- It does **not** archive the project.
- It does **not** delete R2 or Supabase files.
- It does **not** change the project status.
- It does **not** alter WooCommerce.

## Download categories

The user can choose:

- Blank photos
- Original artwork
- Prepared artwork
- Generated mockups
- Production files
- Optional preview derivatives

Primary project files are selected by default. WebP preview derivatives are optional because they duplicate other graphics.

The chosen folder receives an organized project folder with:

- `Blank Photos/`
- `Artwork/Originals/`
- `Artwork/Prepared/`
- `Mockups/`
- `Production/`
- optional `Previews/...`
- `mockup-graphics-download-manifest.json`

Each downloaded file is verified after writing using file size and SHA-256. The manifest records source references, file sizes, checksums, and confirms `cloud_files_changed: false`.

Assets that only reference an external URL and are not stored in Mockup Studio are not fetched directly by the browser. Their URLs are recorded in:
`external-references-not-downloaded.json`.

## Browser requirement

Bulk folder download uses the File System Access API. Use Google Chrome or Microsoft Edge on the desktop computer where the files should be saved.

## Database / environment changes

None.

No Supabase SQL migration is required.
No new Netlify environment variables are required.

## Installation

Start from merged v1.4.20 `main`.

```bash
cd "$HOME/inventory-app" || exit 1

git switch main
git pull --ff-only origin main
git status --short

git switch -c feature/mockup-download-all-v1.4.21

unzip -o \
  "$HOME/Downloads/skilled-crafting-mockup-download-all-v1.4.21.zip" \
  -d "$HOME/inventory-app"

python3 scripts/apply_mockup_download_all_v1_4_21.py

npm run test:mockup-downloads
npm run check

git diff --check
git status --short
git diff --stat
```

Stop before committing and review the output.

## Production verification

After deployment:

1. Open Mockup Studio.
2. Select an active project with artwork and generated outputs.
3. Scroll to **Download project graphics**.
4. Leave the primary categories selected.
5. Click **Download Project Graphics**.
6. Choose a local destination folder.
7. Confirm the project subfolder contains the expected category folders.
8. Open several downloaded files.
9. Open `mockup-graphics-download-manifest.json`.
10. Confirm the Mockup Studio project remains active and its R2/cloud images still display normally.
