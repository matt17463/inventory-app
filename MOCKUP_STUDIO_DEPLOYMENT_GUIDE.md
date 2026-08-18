# Mockup Studio v0.7.0 — Step-by-Step Deployment Guide

This guide deploys the complete Mockup Studio release on top of Skilled Crafting v0.6.30. The SQL is additive and the application package is a complete replacement source tree.

## What you need

- Access to the existing Supabase project and its SQL Editor.
- Access to the GitHub repository used by the inventory application.
- Access to the linked Netlify site and its environment variables.
- A WooCommerce REST API key with read/write access (the existing values may be reused).
- An OpenAI Platform API key with image-generation access and billing configured.
- Node.js 20 or newer, Git, and the Netlify CLI on the deployment computer.

Do not paste real secrets into source files, SQL, GitHub, screenshots, or support messages.

## 1. Back up the current release

1. In Netlify, open the production site and note the currently published deploy.
2. In Supabase, create a database backup or confirm that automated backups are current.
3. Save a copy of the existing GitHub repository or create a release tag:

   ```bash
   git checkout main
   git pull --ff-only
   git tag before-mockup-studio-v0.7.0
   git push origin before-mockup-studio-v0.7.0
   ```

4. Confirm that Inventory Overview and Pull Sheets load normally before changing anything.

## 2. Install the Supabase database phase

1. Open the Supabase dashboard for the production project.
2. Select **SQL Editor → New query**.
3. Open `deployment/sql/18_MOCKUP_STUDIO_ALL_PHASES.sql` from this package.
4. Copy the entire file into the SQL Editor.
5. Click **Run** once and wait for completion.
6. Review the final verification grid. Every row must say `PASS`:

   | Check | Expected |
   |---|---:|
   | `mockup_tables` | 11 |
   | `private_storage_buckets` | 3 |
   | `security_invoker_summary_view` | true |
   | `authenticated_table_policies` | 11 |
   | `anonymous_table_privileges` | 0 |
   | `required_functions` | 2 |

If any row says `STOP`, do not deploy the application. Copy only the check name and error message for troubleshooting; do not share credentials. The migration is idempotent and may be rerun after correcting a failed statement.

## 3. Configure Netlify environment variables

In Netlify, open **Site configuration → Environment variables**. Keep every existing variable and add:

| Variable | Required | Value |
|---|---:|---|
| `OPENAI_API_KEY` | Yes for AI Assist | OpenAI server API key |
| `OPENAI_IMAGE_MODEL` | Recommended | `gpt-image-1.5` |
| `SC_MOCKUP_ALLOWED_ASSET_HOSTS` | Recommended | Comma-separated hosts allowed for linked images, for example `skilledcrafting.com,www.skilledcrafting.com` |

Also verify the existing server variables are still present:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SC_ALLOWED_ORIGINS`
- `WOO_SITE_URL`
- `WC_CONSUMER_KEY`
- `WC_CONSUMER_SECRET`

The three secret values must not start with `VITE_`. `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are the only browser-side Supabase values required by this feature.

Set variables for Production and Deploy Previews if mockups will be tested in both contexts. Add each preview hostname to `SC_ALLOWED_ORIGINS` using the existing format.

## 4. Replace the application source

1. Download and unzip `inventory-app-main-complete-corrected-v0.7.0-mockup-studio.zip`.
2. Open Terminal and move into the unzipped folder:

   ```bash
   cd ~/Downloads/inventory-app-main-complete-corrected-v0.7.0-mockup-studio
   ```

3. Confirm that these files exist:

   ```bash
   test -f package.json
   test -f src/MockupStudio.jsx
   test -f netlify/functions/mockup-generate-background.js
   test -f deployment/sql/18_MOCKUP_STUDIO_ALL_PHASES.sql
   ```

4. Copy the complete contents into a new branch of the existing repository. Preserve the repository's `.git` folder. One safe approach is to create a clean branch, then copy the unzipped files using Finder and choose **Replace** when prompted:

   ```bash
   cd /path/to/your/existing/inventory-repository
   git checkout -b feature/mockup-studio-v0.7.0
   ```

5. Do not copy a `.env` file or `node_modules` into GitHub.

## 5. Install and validate locally

From the repository root, run:

```bash
npm ci
npm run check
```

`npm run check` validates function module syntax, static contracts, security helpers, Google Calendar, Mockup Studio, ESLint, the production build, and required build features. It must exit successfully.

For an interactive local test:

```bash
npx netlify dev
```

Open the local URL printed by Netlify. Sign in with an employee account and open **Artwork → Mockup Studio**. AI and WooCommerce tests require the server variables in the local Netlify environment; never put secret keys in a committed file.

## 6. Commit and push a test branch

```bash
git status
git add .
git commit -m "Add Mockup Studio all phases v0.7.0"
git push -u origin feature/mockup-studio-v0.7.0
```

Review `git status` before the commit. Files such as `.env`, secret exports, database dumps containing customer data, `node_modules`, and editor caches must not be committed.

## 7. Test a Netlify Deploy Preview

1. Open a pull request from `feature/mockup-studio-v0.7.0` to the production branch.
2. Wait for Netlify to publish the Deploy Preview.
3. Sign in and open **Tools & Admin → Deployment Health**.
4. Confirm standard checks pass, including `OPENAI_API_KEY` and the three Mockup Studio buckets.
5. Run this smoke test in the preview:

   - Create a project named `Deployment Test — delete after launch`.
   - Upload one blank tee image and one PNG logo.
   - Set a center-chest placement and create an exact mockup.
   - Add a caption and change its font, size, and color.
   - Select the output and create a customer review link.
   - Open the link in a private browser window and submit approval.
   - Add sample costs and confirm the suggested retail calculation.
   - Create a WooCommerce **draft**. Confirm it appears as a draft with the correct images; do not publish the test product.
   - Open the production packet and download both CSV and JSON.
   - If AI Assist is enabled, request one variant and verify the completed output. Review lettering carefully.
   - Delete the WooCommerce test draft and remove or archive the deployment test project.

6. Recheck existing features: Inventory Overview, Pull Sheets, Reservations, Bins, Customer Portal Preview, and Google Calendar.

## 8. Publish production

After the preview and pull request checks pass:

```bash
git checkout main
git pull --ff-only
git merge --ff-only feature/mockup-studio-v0.7.0
git push origin main
```

If your repository uses a different production branch or requires pull-request merging, follow that protected workflow instead. Wait for Netlify to mark the deploy **Published**, then repeat the standard Deployment Health check and one draft-only mockup test in production.

## 9. Recommended operating workflow

1. Start with high-resolution, evenly lit blank product photos.
2. Prefer transparent PNG artwork at production aspect ratio.
3. Use **Exact composite** for text-heavy logos, QR codes, trademarks, or color-critical artwork.
4. Use **AI Assist** to improve realism, then visually compare it with the exact output.
5. Create both clean and captioned versions. Select only customer-safe images for review.
6. Obtain approval before publishing or producing the item.
7. Create a WooCommerce draft first. Review mobile layout, captions, price, categories, colors, sizes, and variation count in WordPress.
8. Publish only after final review, then print or save the production packet with the order.

## 10. Recovery

### Application rollback

In Netlify, open **Deploys**, select the previously working production deploy, and choose **Publish deploy**. Alternatively, revert the v0.7.0 Git commit and push the production branch.

### Database recovery

The Mockup Studio schema is isolated and does not change the existing inventory/pull-sheet tables. During an application rollback, leave the new tables and buckets in place; the older app ignores them. Deleting the schema would permanently remove mockup projects and files and is not part of normal rollback.

### AI generation fails

- Confirm `OPENAI_API_KEY` exists in the active Netlify deploy context.
- Confirm the OpenAI account has image access and available billing/usage limits.
- Use PNG, JPEG, or WebP for both source images.
- Review the function log for `mockup-generate-background`.
- Create an exact composite while the provider issue is being resolved.

### WooCommerce draft fails

- Run the Deployment Health deep check.
- Confirm `WOO_SITE_URL`, `WC_CONSUMER_KEY`, and `WC_CONSUMER_SECRET` are correct.
- Confirm the key has read/write permissions.
- Confirm WooCommerce can fetch the temporary signed image URLs immediately.
- Reduce color/size combinations if the export would exceed 100 variations.

## 11. Release acceptance checklist

- [ ] Supabase verification grid contains only `PASS`.
- [ ] `npm run check` succeeds.
- [ ] Netlify production deploy is Published.
- [ ] Deployment Health passes.
- [ ] Existing inventory and pull-sheet workflows still pass.
- [ ] Exact mockup, caption, and selected output work.
- [ ] Customer approval link works without employee login.
- [ ] Pricing calculation works.
- [ ] WooCommerce draft contains correct images and metadata.
- [ ] Production packet prints and CSV/JSON downloads work.
- [ ] AI-assisted output works or is intentionally disabled pending an API key.

