# Skilled Crafting — Blank Identification Guide photo-completion handoff
**Prepared:** 2026-10-30 (America/Los_Angeles)
**Task:** Continue and finish sourcing blank product photographs from SanMar, S&S Activewear, and Augusta/Momentec, with official manufacturer image pages and carefully cropped screenshots as fallbacks. Deliver the finished warehouse guide and verified production deployment. **Do not pause for routine proceed approvals or create Netlify deployment previews.**

## Project and verified current state
- Repository: `matt17463/inventory-app`; production branch `main`; Netlify site `ephemeral-sable-cea99c`; application `https://inventory.skilledcrafting.com/inventory/identification-guide`; Supabase project `uvqxkjqxcqovhkazaxbq`; storage Cloudflare R2.
- Current on 2026-10-30: **2,001 active blank records, 754 with assigned supplier image URLs / R2 paths, 1,247 still without an assigned exact image.** The guide additionally provides **384** same-brand/same-style provisional references and **157** explicitly flagged Gildan 6400 → Gildan 64000 provisional aliases (not exact); about **706** items presently have no usable visual reference. Recount live on pickup.
- This conversation added **83** verified assigned image records: 16 from Independent Trading Co. first pass, then 34 further Independent and 33 Augusta/Momentec, and did not replace existing manual images.
- Production guide UI already includes: collapsed SKU/UPC/color/size table (expands for printing); photo coverage counts; provisional style-photo labeling; an admin/manager image editor with HTTPS source or R2 upload, applied to matching brand/style/color across all sizes; automatic exact SanMar importer and daily scheduled pass. Prior production deployment: `966654f6b34345b352d438319b80c8ef63fbf354` (PR #208).
- Staging branch created here: `feature/supplier-image-coverage-20261030`; includes snapshot `scripts/data/blank-photo-remaining-style-colors-20261030.json`, source readers `scripts/verify-vendor-photo-candidates.mjs` (Independent Trading official HTML) and `scripts/verify-momentec-catalog.mjs` (Augusta/Momentec official product metadata). These discovery scripts **only log candidates**; production DB updates were separately validated and applied with guarded exact brand/style/color joins. Refresh snapshot from live DB because some rows were subsequently populated.
- Related application files: `src/BlankIdentificationGuide.jsx`, `src/lib/blankGuidePhotos.js`, `netlify/functions/blank-guide-photo-edit.js`, `netlify/functions/supplier-photo-sync.js`, `netlify/functions/supplier-photo-scheduled-sync.js`, `src/lib/assetStorageApi.js`.

## Source-by-source retrieval plan
1. **SanMar:** Reuse the existing authenticated importer `supplier-photo-sync`. Their Shopify-style `/products/<style>.js` can return JSON with `Content-Type: text/javascript` (handled in code); confirm exact vendor + style, then variant color. For Bella+Canvas style mappings, BC3001, BC6400, BC6405 use alternate style handle. Official images previously gave reliable HTTP 200 image responses.
2. **Independent Trading / S&S stock:** Independent Trading's official pages `https://www.independenttradingco.com/products/<style>` are publicly accessible while the matching `.js` endpoint returns HTTP 404. The product HTML contains filenames like `Independent_Trading_Co._SS4500_Black_Front_High_<content hash>.jpg`; reconstruct manufacturer-hosted HTTPS image URLs under `/cdn/shop/files/` and verify with a HEAD/GET image response. Source script already matches precise manufacturer, style and color. Styles `SS4500Z`, `SS4500`, `SS3000`, `SS4001Y`, `IND4000` yielded images. For `SS4600QZ` or `EXP35SSZC`, inspect browser product image elements because the default filename pattern or product URL may differ.
3. **Augusta / Momentec / Badger / C2 Sport / Alleson:** Source listing endpoint `https://www.momentecbrands.com/ASGCatalogEntryListView` currently accepts public read requests with catalog/category query parameters in the source scanner. Each listing page includes `CatalogEntryData:{...}`; its `color_images` property is an **HTML-entity encoded JSON array** (replace `&quot;` with `"`, etc.). `scripts/verify-momentec-catalog.mjs` read 115 pages without errors and identified 11 exact style/brand combinations. Its direct image URL checks produced exact matches for C2 Sport 510000, 520000, 560000 and Augusta Nexgen 790 (33 inventory variants), plus catalog entries for Badger 710200, 710100, 230100, 272500, 272600 and Alleson LP001A/LP001Y. Some `static.momentecbrands.com` or `static.augustasportswear.com` URLs return HTTP 403; **never save a broken image**. In Work browser, try the vendor image via the actual product page; if visible only in the browser, use a tight screenshot crop of the product for this internal reference guide.
4. **S&S Activewear:** Official `https://www.ssactivewear.com/marketing/edi` provides on-demand product data and a nightly image ZIP (~1 GB), and `https://api.ssactivewear.com/v2/products/` provides `mediaAssets` by style, color and asset type. API requires S&S account number plus API key, with approximately 60 requests/minute. Check existing business account/connected browser and securely configured app secrets first; do **not** log credentials or embed them in frontend. Avoid downloading and retaining the entire 1 GB asset library unless needed; prioritize the 1,247 unpictured SKUs and reuse one image across size variants. If API access is unavailable, navigate authorized public/product pages in Work browser and capture images as described below.
5. **Screenshots as fallback:** If a clear product image is visible on an official supplier page but no functional direct URL can be saved, use Work's browser/computer to select the correct color/size, screenshot the product image only (crop surrounding UI), preserve the original product's silhouette, store in R2 via app workflow. Record original URL, supplier, style, color, capture date and evidence. Confirm source-image usage is permitted for an internal employee guide; don't publicly redistribute supplier imagery. Do not invent or use synthetic product photos.

## Matching and assignment safety
- First choice: brand + exact style + exact supplier color, image URL responds with actual image MIME; apply to all size variants, `image_url IS NULL AND image_storage_path IS NULL` guard.
- Second: high-confidence synonym or equivalent **only with independent title/description/variant validation**; flag as *likely/needs review*. Do not silently equate different cuts, youth/adult, sleeves, or brands.
- Third: same brand/style but different available color: **provisional style image only** as the guide already supports; never save a different-color photo as an exact image.
- Fourth: manufacturer/style conflicts: set aside for product-data repair. Examples from live inventory include Gildan 6400 vs 64000; overlapping `8717` across J America/Richardson/NA, `SF000` across Gildan/Richardson/NA, brand `NA`, and 28 no-brand/no-style records. These should not receive potentially false exact product images.
- **Manual override takes priority forever**: existing image URLs or R2 paths must never be overwritten by automatic sourcing, even on later nightly sync.
- Add durable image provenance: `supplier_name`, `source_product_url`, `source_image_url`, `capture_type` (direct, screenshot, manual), `match_confidence` (exact, likely, provisional), `review_status`, `reviewed_by/at`, `locked_manual_override`. Use a protected table keyed by blank ID or family/color plus migration and appropriate RLS. Show confidence and a **Review / Replace / Approve** queue in the guide. Ensure no public write endpoints.
- Keep all image files under R2 in an appropriate product-image prefix; avoid duplicate per-size copies; save references to all matching size records or a shared style/color asset. Retain server-side media validation and file size limits.

## Execution plan for Work
1. Reopen repo, check latest `main` and this branch; inspect committed scanners. Re-query all live unpictured `blank_products` joined to brands, product_types, colors and sizes. Generate an exact live coverage dashboard (direct, likely, provisional, missing), grouped by brand/style/color. Record starting numbers, preserve existing images.
2. Prioritize largest groups by variant count (e.g. Adidas AT203 68, Colortone, C2 5100/5200/5600, Gildan 6400/64000, Richardson 112, Badger, Independent, J America, Nexgen, missing brands) and resolve real style/brand identities before matching.
3. Run SanMar/Independent/Momentec source retrieval and extend for S&S API/Data Library or browser capture. Search official supplier sites by style; use browser with product/color selection and screenshot fallback. Batch and retry with respectful rate limits/backoff, avoid blocked/terms-prohibited scraping.
4. For each candidate, retain source evidence and categorize exact/likely/provisional. Validate downloadable image HTTP GET/MIME/decoding or actual screenshot. Upload to R2 where durable copy is needed and assign with guarded updates, no changes to stock, barcode, prices, Woo or orders.
5. Extend UI with source/confidence labels, review queue and manual lock. Respect existing admin/manager edit permissions. Confirm cover photo prefers exact. Make "missing image" filter distinguish truly missing from provisional.
6. Add regression tests: source credentials never logged; no SSRF in arbitrary URL ingestion; source identity checking; exact-color matching; manual override invariants; UI source labels; broken-image fallback; multi-SKU image edit; printable full SKU table; 4x6 etc unaffected. Run `npm test`, `npm run lint`, `npm run build`, security checks, and end-to-end guided UI test.
7. Merge to main and **production deploy only** (no Netlify previews). Confirm published Netlify commit, app route loading, thumbnail GET, printing in Chrome and at least one staff user correction. Verify database counts, and produce a per-brand exception list with remaining missing images and reasons. Continue until practical coverage is exhaustive; do not stop merely because some images need screenshots or browser work.

## Queries for verification
```sql
select count(*) total,
  count(*) filter(where image_url is not null or image_storage_path is not null) assigned,
  count(*) filter(where image_url is null and image_storage_path is null) unassigned
from public.blank_products where sc_is_archived=false;

select coalesce(b.name,'(unset)') brand, coalesce(t.name,'(unset)') style,
       coalesce(c.name,'(unset)') color, count(*) missing_variants
from public.blank_products p
left join public.brands b on b.id=p.brand_id
left join public.product_types t on t.id=p.product_type_id
left join public.colors c on c.id=p.color_id
where p.sc_is_archived=false and p.image_url is null and p.image_storage_path is null
group by 1,2,3 order by missing_variants desc;
```

## Definition of done
- Complete catalog coverage where credible supplier photos exist; remaining exceptions each have a documented cause (ambiguous brand/style, vendor access restriction, no image, or manual physical verification required).
- All exact/likely/screenshot images have source evidence and can be corrected in the UI; provisional images are unmistakably marked.
- Manual edits cannot be undone by scheduled supplier import.
- No broken source URLs; print guide contains expected photographs with SKU details expanded in print.
- Fully tested and **published to production**, with final photographed / provisional / missing counts and named remaining exceptions.

**Operational note:** Prior supplier-image verification work used GitHub Actions to get outbound access to public supplier catalog pages. Remove diagnostic-only workflows before merging; do not commit secrets or temporary image binaries.