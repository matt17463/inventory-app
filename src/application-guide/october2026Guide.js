// October 29, 2026 source-informed application and business-integration guide.
// Labels and workflows come from navigation, application components, and companion docs.
// A source-visible button is not proof that a production integration is enabled.
const section=(id,title,summary,options={})=>({id,title,summary,...options});
export const october2026GuideChapters=[
{
 id:'oct-creative-operations',title:'Creative Operations Suite: Five Connected Workspaces',
 description:'Start from Dashboard > Creative Operations Suite. This is a guide to existing tools, not a second order database.',
 sections:[
  section('oct-creative-tabs','Choose the correct workspace','The five tabs bring together shop priorities, artwork preparation, customer design, packages, and knowledge.',{
   relatedRoutes:['/creative-operations','/command-center','/mockup-studio','/product-event-center'],
   steps:['Open Creative Operations Suite. Select Command Center for urgent work and overdue orders.','Select Artwork Engineer to examine dimensions, 300 PPI size, white borders and alpha before opening DTF Prep Studio.','Use Customer Design for the quote-only public design process. Confirm any submission in Client Orders.','Use Product & Package Creator to compare estimated cost, setup, quantity and sale price for weddings, coach awards and business gifts.','Use Knowledge Assistant to search approved manuals, then review the cited pages before applying settings.'],
   scenario:'A wedding planner requests 60 engraved glasses and place cards. Draft both package costs, gather logo approvals, then quote through the existing order system.',
   warnings:['Package math is an estimate until supplier costs, spoilage, labor and tax are reviewed.','A concept, AI answer or customer quote request does not authorize production.']
  }),
  section('oct-creative-costs','Package cost fields and draft copy','Unit material cost, decoration cost, packaging cost, quantity, setup cost and proposed sale price help estimate gross contribution.',{
   relatedRoutes:['/creative-operations','/quote-builder','/job-costing'],
   steps:['For each line, enter a meaningful product title, quantity, blank/material unit cost, decoration unit cost and package unit cost.','Enter one-time setup costs separately from per-unit costs.','Use the calculation/readout to inspect estimated total cost, selling total and gross contribution.','Review draft package wording for accuracy. Never use draft text as proof of supplier availability or validated production settings.','Take confirmed figures into Quote Builder; save the final client quote there.'],
   scenario:'A coach recognition package combines a patch, engraved plaque and drinkware item. Compare 10-unit and 25-unit production costs before quoting.'
  })
 ]},
{
 id:'oct-public-design-knowledge',title:'Public Design Requests, Local AI and Manual Indexing',
 description:'Public concept intake is separate from approved production. The knowledge library can cite private manuals; an optional local model requires a secured workshop gateway.',
 sections:[
  section('oct-public-configurator','Public customer design form /design','A customer may describe a design, select product/color/size/quantity and optionally provide artwork, then submit a quote request. No payment is collected.',{
   relatedRoutes:['/client-orders','/mockup-studio','/creative-operations'],
   steps:['Share the public /design page only when its Netlify feature and rate limits are confirmed.','Customer chooses the product concept, quantities and colors, describes artwork and uploads an approved format when offered.','Customer submits a quote request; this must appear in the Client Orders review queue.','Review the contact, product, artwork, supplied notes and legal usage rights. Correct missing fields before generating a quote.','Route approved concept through Mockup Studio, real customer approval and the regular order/recipe workflow.'],
   scenario:'A local company requests 24 polos with a small left-chest logo. Use the design request as a starting point, not an automatically billable order.',
   warnings:['Never promise a live WooCommerce product, automated price or printed traveler from a design form alone.']
  }),
  section('oct-knowledge-index','Knowledge manual library','Staff with the right role can upload approved business PDF manuals to a private library and search indexed page excerpts.',{
   relatedRoutes:['/creative-operations','/device-product-library','/equipment-center'],
   steps:['Open Creative Operations > Knowledge/Manuals. Use approved equipment manuals only; do not upload customer records or confidential personnel information.','Choose Upload PDF and confirm the file size and index state. A file waiting for indexing is not searchable yet.','Enter product, material or machine terms in Search. Inspect each source document and page citation before relying on an answer.','If a manual shows OCR needed, prepare a reviewed searchable PDF using the optional local-only OCR helper and re-index it; the hosted indexer does not automatically recognize image-only text.','For NAS imports, configure the explicitly allowlisted business-manuals folder and run the reviewed sync tool on an authorized private host.'],
   scenario:'Search for Roland media loading instructions before preparing a new roll of printable HTV.',
   warnings:['A local language model cannot answer with reliable source citations until the private HTTPS gateway, Ollama model and employee login are actually active.','Do not expose Ollama, gateway ports, private R2 keys or Supabase service-role keys to the internet.']
  })
 ]},
{
 id:'oct-ai-product-discovery',title:'AI Product Discovery and Marketing Integrations',
 description:'AI research proposes reviewable product opportunities; it does not make verified prices, automatically contact customers, or publish live products.',
 sections:[
  section('oct-discovery-controls','Discover and save product ideas','In Product & Event Center > 00 AI Discovery, choose focus, quantity and review a run result.',{
   relatedRoutes:['/product-event-center','/supplier-catalog','/marketing','/manufacturing-recipes'],
   steps:['Select the research focus (weddings/events, sports/coaches, business gifts, or combined).','Enter a candidate count between 4 and 20. Press Discover and save products. A queued response means accepted, not completed.','Watch run status (queued, running, complete, partial or failed). Open the run to inspect sources, shop fit and provisional scores.','Choose Review candidate & sources. Check original public links, actual vendor catalog entries, physical feasibility, real profit and potential customers.','Record material tests, the approved recipe and commercial decision before using any candidate in a quote or store.'],
   scenario:'Find potential graduation and coach-recognition products, then narrow to items supported by a verified xTool/laser production method.',
   warnings:['Source links are reference leads, not verified wholesale prices.','A failed API key or provider quota must not silently switch to a paid model.']
  }),
  section('oct-ai-marketing','AI-assisted marketing and client research','CRM prospect discovery and draft writing can help prepare outreach, but the shop must verify contacts and approve messages.',{
   relatedRoutes:['/marketing','/campaign-forecast','/team-stores'],
   steps:['In Marketing & Client Growth, create or open an organization and opportunity. Set owner, contact preferences, desired products, estimated value and next action.','Use approved AI research for public organization context; check names, web pages and evidence. Do not assume private contact details are accurate.','Review the proposed email, flyer or package copy. Confirm pricing, spelling, claims and consent preferences.','Record sent outreach in the client activity timeline; copying a draft is not sending it.','Link the won opportunity to a Woo store campaign or one-time Client Order; do not create the same job in both systems.'],
   scenario:'Research a school PTO, prepare a mockup and draft an introductory message about seasonal spiritwear.',
   warnings:['External AI may process prompts; do not include customer confidential details, bank information or unapproved artwork.','Check server-side provider configuration before troubleshooting a research failure.']
  })
 ]},
{
 id:'oct-dtf-studio',title:'DTF Prep Studio: Artwork Tools and Button Reference',
 description:'Source is the original file; Proof is the transformed preview. Background removal must preserve the intended foreground and transparent pixels.',
 sections:[
  section('oct-dtf-source','Source file, project and sizing','The Source pane is read-only original art. Proof shows the working recipe; zoom and backdrop do not change exported artwork.',{
   relatedRoutes:['/dtf-studio','/mockup-studio','/artwork-preflight'],
   steps:['Choose Upload customer artwork, or select a Customer/mockup project and Existing project artwork, then Load selected R2 artwork.','Set Width (in) and Height (in), or select Quick size. Standard 12 x 12 inches at 300 PPI is 3600 x 3600 pixels; check the actual source quality.','Use Crop transparent source margins only when the trimmed art remains centered as intended.','Set Proof background to checkerboard, RGB/CMYK color or the garment blank selected from the project. These are preview tools, not export background settings.','Enable Before/after split to compare original and proof.'],
   scenario:'A customer provides a low-resolution black-backed hoodie logo. Save an untouched source before making a 12-inch production copy.'
  }),
  section('oct-dtf-mask','AI Remove Background, local selection and repair','AI provides suggested foreground/background points; connected-color masking does the actual removal without redrawing the artwork.',{
   relatedRoutes:['/dtf-studio'],
   steps:['Choose AI intent: exterior-only when enclosed white is part of the logo; include gaps when white interior openings should also disappear.','Press AI Remove Background only after checking that Google transmission is allowed and the service is active. Review the preview; AI results are never automatically production-approved.','Use Source interaction > Click to remove region to erase an unwanted connected area, or Click to keep/restore region to recover missing letters and borders.','If removal misses an edge, use Removal method, Background RGB color, Removal coverage, and Decontaminate edge colors. For true white holes, use Remove enclosed white/off-white areas too cautiously.','Use brush controls on the original to refine the mask. Undo, Redo, Clear manual mask, and Apply reviewed mask are separate controls.','Zoom in to confirm edges and all interior cutouts before any export or R2 save.'],
   scenario:'A green school emblem has white letters that must remain while the outside white rectangle must become transparent. Preserve the letters with Keep/restore before exporting.',
   warnings:['AI mask guidance is not a photorealistic matte or a substitute for visual QC.','Never delete meaningful white ink just because it matches the background color.']
  }),
  section('oct-dtf-export','Halftone, color, preflight and export','Processing changes can affect print appearance; proof on the actual garment color.',{
   relatedRoutes:['/dtf-studio','/artwork-preflight','/mockup-studio'],
   steps:['Choose Quick preset, Final alpha, Halftone style, Knockout and Shirt RGB only when required by the print job.','Adjust CMYK color channel enable switches, angles and dot shape when using multicolor halftones. Proof channel controls the preview only.','Inspect alpha fringe and white outlines at high zoom. Confirm transparent outside the art and no unwanted semi-transparent haze.','Export transparent 300 PPI PNG for multicolor DTF. One-color SVG silhouette is appropriate only when the design truly supports single-color output.','If using R2, Save prepared copy in the linked project; submit the derivative to DTF Artwork Preflight, mockup and artwork approval.'],
   scenario:'Prepare a cream-colored 3 x 2-inch graphic for an approved patch and keep the 1/8-inch safety margin outside the decoration.'
  })
 ]},
{
 id:'oct-catalog-variation-graphics',title:'Woo Catalog Readiness, Artwork Bindings and Variations',
 description:'Exact variations, artwork selection and approved production recipes must agree before a traveler is valid.',
 sections:[
  section('oct-variation-readiness','Product certification and blank mappings','A parent product being ready does not mean every size/color variation is ready.',{
   relatedRoutes:['/catalog-production-readiness','/product-blank-mappings','/catalog-modernization'],
   steps:['Open Catalog Production Readiness and select a Woo product family. Review every size/color variation, blank mapping, price and active approval.','Use blank mapping fields to select the exact stocked brand/style/color/size. Do not reuse a wrong-size blank just to clear a warning.','Review approved decoration recipe, artwork placement, proof and preflight for each applicable variation.','Generate or review certification for the exact variation. If a blank, graphic or recipe revision changes, the certificate may be invalidated.','Run a non-order readiness check before publishing the product or generating its first traveler.'],
   scenario:'A school tee offers youth and adult sizes. Youth graphics use a narrower placement, so separate reviewed recipe assignments are required.',
   warnings:['Certification represents reviewed configuration, not physical production QC.']
  }),
  section('oct-graphic-binding','Graphics mapping and WordPress selector','Keep graphic choice separate from size/color attributes when the managed graphic selector takes ownership.',{
   relatedRoutes:['/woo-artwork-mapping','/client-graphics','/order-graphics','/artwork-bridge'],
   steps:['Map Existing Woo Artwork: identify the original product, current variations, legacy logo metadata and approved client graphic asset.','Review the product-to-graphic binding and all available options. Use the app approval process; do not auto-approve an uncertain match.','Check the installed Skilled Crafting Graphic Choices plugin and its own enable setting. Confirm exact mapped product choices in WordPress before enabling public selection.','In test checkout, select a specific logo, verify Woo line metadata, webhook extraction, order graphic resolution, and exact traveler for that order line.','If capture is disabled or a mapping is unresolved, stop the traveler and use the manual review path rather than guessing a logo.'],
   scenario:'The EPO shirt has three customer-selectable logos. A real paid order must preserve the chosen logo and not use the other two artwork files.',
   warnings:['Plugin installation does not mean graphic selection is enabled for live checkout.','Do not remove legacy Woo logo attributes until staging and production migration checks establish no orders will lose selections.']
  }),
  section('oct-client-graphics','Client graphic records and inheritance','One approved organization logo can be used across several products without losing change history.',{
   relatedRoutes:['/client-graphics','/order-graphics','/mockup-studio'],
   steps:['Create or find the correct client, use the approved primary graphic and give the asset a meaningful version name.','Review original file, placement and process type; record proof and customer approval explicitly.','Bind the approved graphic to relevant products/placements; prefer a shared source asset rather than many unrelated uploads.','When replacing a shared logo, inspect every dependent product and invalidate stale approvals before new production.','For each order, verify that the selected graphic and exact approved revision appear in the traveler.'],
   scenario:'A business refreshes its logo; its polo, cap and mug must each be reviewed before the next reorder.'
  })
 ]},
{
 id:'oct-woocommerce-plugins',title:'WordPress and WooCommerce Plugin Operations',
 description:'WooCommerce handles public checkout. The Skilled Crafting app handles shop workflow and review. Some legacy plugins overlap; do not assume two plugins can safely write the same field.',
 sections:[
  section('oct-wp-store','Client Storefronts, season cloning and publishing','Recurring organizations have Woo product-category storefront pages; one-time jobs use the online group order form and QuickBooks.',{
   relatedRoutes:['/team-stores','/product-event-center','/woo-sync'],
   steps:['In Team Stores, choose a client, campaign template, school colors, logo, cutoff date, pickup/shipping copy and approved product category.','Create a WordPress draft and review category-restricted products, variation choices, terms, pricing and mobile display.','Record manager and customer approval before publishing. A saved draft is not a live store.','Complete a controlled checkout using approved test procedures and verify paid Woo line items arrive in Work Hub.','For a new season, clone design and instructions into a new draft without carrying over old orders, approvals or deadlines.'],
   scenario:'A PTO needs a fall spiritwear store; orders go through Woo checkout and later school-distribution labels.',
   warnings:['SiteGround restrictions and WordPress Application Password configuration can prevent actual publishing; failure should leave a draft.']
  }),
  section('oct-wp-plugin-fields','Skilled Crafting plugin controls explained','Product Options adds product-specific text/choice fields; Mockup Variation Selector connects approved variation graphics; Print Documents makes existing Woo documents.',{
   relatedRoutes:['/mockup-studio','/print-center','/product-integrity'],
   steps:['In WordPress Products, open the product edit screen. Review SC Product Options: field label, input type, required flag, allowed values, fee, limits, and the customer-facing output. Save only after testing a sample variation.','For variation images, check each exact size/color and approved mockup association; do not overwrite multiple logo selections with a single image.','For an invoice or packing slip, use the WordPress Print Documents option appropriate to the order and paper size; verify personalization and variation image before distributing.','On the checkout page, verify order item metadata includes name/number/teacher/coach information exactly as requested, and that required fields block empty submission.','If Graphic Choices manages logo selection, ensure any older extra option does not create a duplicate or conflicting selector.'],
   scenario:'A school order needs Student name and Teacher fields on a 4 x 6 distribution label, even when the product is bought through WooCommerce.',
   warnings:['Product add-on options and graphics selectors are distinct systems; renaming an option does not migrate old paid-order metadata.']
  }),
  section('oct-wp-integrity','SKU writers, coupons, shipping and sync','Commerce changes can affect live customer orders even when they look like simple settings changes.',{
   relatedRoutes:['/wordpress-integrity','/product-integrity','/woo-sync'],
   steps:['Before editing SKU, note current Woo product and variation IDs and the original SKU. Identify the intended sole SKU writer.','Use WordPress Commerce Integrity for current reported shipping-rule conflicts and duplicate SKU writers. Confirm staging fixtures before remediation.','Test local pickup, school distribution, ordinary shipping, coupon exceptions and mixed shipping classes with test carts around the configured threshold.','Use Woo Sync Health to compare source records, webhook processing, product mapping and resulting job records.','Never regenerate SKUs, change published coupon rules or disable a shipping plugin based only on source-detected controls.'],
   scenario:'A $200 order with a coupon must not accidentally receive unintended shipping when the customer’s checkout mode is local pickup.',
   warnings:['The October 22 WordPress plugin inventory was partial; recheck plugin activation and version before interpreting these instructions.']
  })
 ]},
{
 id:'oct-production-job-print',title:'Work Hub, Digital Travelers, QC and Printed Documents',
 description:'The same order must travel from intake to production with verified blanks, chosen graphics, approved recipes and reliable print documents.',
 sections:[
  section('oct-workhub-states','Work Hub stages and evidence','Review order, Resolve blockers, On hold, Production ready, In production, QC, Ready for pickup and Completed describe job progress.',{
   relatedRoutes:['/work-hub','/production-board','/qc-checklist','/order-risk'],
   steps:['In Work Hub, search customer, Woo order number or job. Check status, requested date, item count and exact personalization.','Read readiness evidence. A blank-only order may not require a decoration recipe; do not mark a blocked step complete just to advance.','Resolve purchasing shortages, wrong blanks, unapproved artwork and missing traveler lines in the responsible specialist screen.','Move to production only with valid lines, approved placement, documented inventory and a current traveler.','At QC, record defect checks and any rework. Use packing signoff, photos and pickup/shipping confirmation before closing.'],
   scenario:'A school distribution job contains four garments with two logo choices. The Work Hub must show which specific lines remain uncovered.',
   warnings:['Stage labels are not substitutes for authoritative stock movements, customer approval or saved QC evidence.']
  }),
  section('oct-traveler-groups','Group order lines into correct QR travelers','Digital Travelers supports selection of multiple lines and saved groups with a recipe for each group.',{
   relatedRoutes:['/production-travelers','/manufacturing-recipes','/work-hub'],
   steps:['Open QR Job Travelers; choose an open production job. Closed jobs are not intended for new traveler creation.','Select the exact lines for one logo, process and placement. Group compatible sizes only if they share the same approved recipe version.','Choose Recipe for this group. Review existing travelers and skip already claimed line IDs.','Use Verify and create or Save only after graphic evidence, placement and certification gates pass.','For mixed-logo orders repeat for the second group. Confirm every inventory-required line is represented once and counts agree with Work Hub.','Use Print / Save PDF from the saved traveler; compare its image and recipe revision with the record before printing.'],
   scenario:'Eight hoodies: five youth sizes with logo A and three adult sizes with logo B should form two compatible traveler groups, not eight and not one misleading traveler.',
   warnings:['Unverified legacy SKU hints never prove actual selected artwork.','Replacing a traveler should include a reviewed difference and a clear reason.']
  }),
  section('oct-print-order','Print Order, invoice verification, labels and printer routing','Customer invoices, internal shop copies, 4 x 6 distribution labels and separate saved travelers have different required evidence.',{
   relatedRoutes:['/work-hub','/print-center','/production-travelers'],
   steps:['Open the order in Work Hub and choose Print Order. Select Customer invoice, Shop invoice, 4 x 6 distribution labels, and any available saved travelers separately.','Choose Label template and Number of packages. In custom school fields enter Student, Teacher, Coach, Applied name or any approved override; Auto from order populates when available.','Press Preview selected documents. Inspect totals, paid/balance state, artwork and fields, and compare chosen 4 x 6 template with the displayed output.','For a QuickBooks-billed manual order, Customer invoice requires verified original QuickBooks invoice totals. If unverified, shop copy may be DRAFT; never present it as a paid customer invoice.','Use Print selected to shop printers only after onsite printer/CUPS queues, templates, PDF preview and feature flags are verified. Queue acceptance alone is not physical printing.'],
   scenario:'A QuickBooks order like CO-1006 is blocked from customer-invoice printing until its billing totals match the authoritative QuickBooks invoice.',
   warnings:['An Epson or D530 Pro connected to the network is not proof the Pi queue and direct-print service are ready.','Always check school-distribution customization against an actual order preview.']
  })
 ]},
{
 id:'oct-purchasing-inventory',title:'Inventory, Purchasing, Supplier Matching and Returns',
 description:'Blank stock exists by exact product and bin. Purchasing proposals are not stock on hand.',
 sections:[
  section('oct-purchasing-flow','Shortage to purchase order to receipt','Check inventory pairing before buying; common wrong-pairing symptoms look like stock shortages.',{
   relatedRoutes:['/purchasing','/purchase-orders','/supplier-catalog','/add-item','/waiting-on'],
   steps:['Read purchasing recommendations by job, exact blank SKU, size, color, demand, available quantity and existing pending purchase orders.','Investigate a suggestion for an already-stocked item: verify the product-to-blank association, reservations, bin on hand and supplier mappings before creating another PO.','Use Supplier Catalog Review and Vendor Prices to compare known costs. An imported vendor row is not guaranteed availability.','Create a PO only for the remaining shortage; record vendor, cost and shipment/ETA.','On physical delivery, receive the actual units into a real bin, preserving the supplier and reference; resolve Waiting On once the stock is truly available.'],
   scenario:'Six adult-black hoodies already in inventory should not appear as new purchases merely because the Woo order still points to an outdated variation mapping.'
  }),
  section('oct-inventory-moves','Counting, transferring, sales and spoilage','Physical movements must match bins, reservations and finished products.',{
   relatedRoutes:['/inventory/blanks','/bins','/transfer','/inventory-audit','/onsite-sales','/spoilage'],
   steps:['On Inventory Overview, check On hand, reserved and available separately. Pending Stock represents shortage demand, not physical stock.','Use Add Item to Bin for receiving and Transfer Between Bins for a real movement; barcode scans must match the exact size/color SKU.','Count with Inventory Audit/Cycle Count before making adjustments. Explain variances in the audit record.','For on-site sales, record actual sold items and any personalization; verify stock deductions against the source.','Log misprints/spoilage with the affected blank or finished item, reason, quantity and cost so inventory and job costing stay coherent.'],
   scenario:'A DTF hoodie was pressed with the wrong name. Log the misprint, allocate replacement blank and reprint through the correct reviewed traveler.'
  })
 ]},
{
 id:'oct-business-integration',title:'Equipment Recipes, QuickBooks, Storage and Administration',
 description:'Specialized shop tools use approved machine settings and secure integrations, not guessed production recipes.',
 sections:[
  section('oct-device-recipes','Equipment Center, material settings and device library','Use settings by machine, material and product; test conditions before saving a recipe as approved.',{
   relatedRoutes:['/device-product-library','/material-settings','/equipment-center','/uv-studio','/manufacturing-recipes'],
   steps:['Choose the exact machine, including xTool S1, P2, Omni UV, MOPA, Roland BN2-30, Sawgrass or heat press.','Select the actual material and operation; distinguish manufacturer defaults from user-tested shop settings.','Record machine software, project size, speed, power, pass count, processing temperature, fixture and focus settings when applicable.','Run a small labeled test coupon. Record adhesion, color, detail, time and required safety setup.','Approve a recipe only after actual measurement and sample checks; never assume an AI suggestion is certified on the machine.'],
   scenario:'Before 100 stainless challenge coins on the Omni UV, test one coin, record the xTool Studio values and revise the approved recipe.',
   warnings:['Machine manuals and local exhaust requirements override generic advice; new hardware must complete installation and safety checks.']
  }),
  section('oct-integration-health','Financial, web, storage and access integrations','Shop operations depend on distinct systems: WooCommerce, QuickBooks, Supabase, Netlify, Cloudflare R2, NAS, Pi printers and Home Assistant.',{
   relatedRoutes:['/deployment-health','/woo-sync','/asset-storage-health','/user-management','/audit-trail','/operations-calendar'],
   steps:['Use Woo Sync Health to inspect webhooks and product mapping; use QuickBooks connection status for invoice source verification, never to infer payment from the app draft.','Use Asset Storage Health to confirm private R2 artwork availability and durable backups before removing a file.','Check Netlify deployments and private server-side environment flags in the authorized dashboard, not browser client source.','Review each user role and active account. Grant the minimum access necessary, and remove inactive sessions.','Check Operations Calendar and employee account connections separately; a calendar route does not mean a Google OAuth account is active.','Use Audit Trail when investigating supplier changes, manual stock adjustments, artwork approvals and failed integrations.'],
   scenario:'After a site update, a Woo order appears with the wrong logo. Review Woo order meta, webhook and mapping history before touching the paid order.',
   warnings:['A NAS backup should supplement, not automatically replace, private R2 storage or database backups.','Do not place QuickBooks, Gemini, Woo or Supabase service-role credentials in browser-local VITE variables.']
  })
 ]},
{
 id:'oct-scenarios',title:'Business Scenarios: Follow the Customer from First Contact to Delivery',
 description:'Practice on fictional accounts in safe training mode. Verify each authority handoff before performing the same sequence on a live order.',
 sections:[
  section('oct-scenario-pto','Scenario 1: New PTO spiritwear storefront','Marketing lead to a recurring WooCommerce school store.',{
   relatedRoutes:['/marketing','/mockup-studio','/team-stores','/work-hub','/print-center'],
   steps:['Add the PTO to Marketing and record contact permission, needs, season and next follow-up.','Create two approved mockups (tee/hoodie), clear artwork rights, define products and a reviewed wholesale/retail split.','Start a new Team Store campaign; attach category, landing copy, logo, delivery method and cutoff date.','Create draft, obtain school approval, publish after checkout verification, and monitor real Woo orders.','Use Work Hub to verify each size, logo and optional student/teacher fields. Reserve/purchase correct blanks.','Produce with approved travelers, complete QC, print customer/shop records and individualized 4 x 6 distribution labels.','Hand off labeled orders to the school, reconcile store results and schedule next-season review.'],
   scenario:'24 soccer players order team apparel in several sizes; the PTO wants classroom pickup rather than home shipping.'
  }),
  section('oct-scenario-group','Scenario 2: One-time soccer hoodie order','Marketing opportunity to an online team-order form and QuickBooks invoice.',{
   relatedRoutes:['/team-order','/client-orders','/manual-orders','/production-travelers','/print-center'],
   steps:['Enter coach contact and requirements in Marketing. Share the group order form, not a recurring checkout store.','Review quantity, youth/adult sizes, player names/numbers, logos and deadline in Client Orders.','Confirm prices, sales-tax treatment, design proof and production terms before sending the QuickBooks invoice.','Verify the authoritative QBO invoice number, total and payment state; convert only once into the manual shop job.','Map exact blanks, split the selected logo/recipe groups, generate valid QR travelers and schedule work.','Print verified customer invoice plus shop copy and packaging labels; complete QC and pickup signoff.'],
   scenario:'Ten hoodies for one soccer team, with two different approved chest graphics and a coach collecting all orders.'
  }),
  section('oct-scenario-wedding','Scenario 3: Wedding and event package','Draft, sample, invoice, manufacture, then reconcile a mixed-material package.',{
   relatedRoutes:['/creative-operations','/product-event-center','/quote-builder','/device-product-library','/work-hub'],
   steps:['Record customer date, venue, delivery address, design theme and quantity.','Build a package for drinkware, engraved name settings and table signage; estimate setup, materials, labor and spoilage.','Show a physical sample and approve designs/engraving spelling. Verify safe, tested machine settings for every material.','Create the approved quote and proper invoice. For a one-time order use the manual/QuickBooks channel.','Create separate process recipes or travelers for different operations; check personalization and product counts.','Use QC on every name and date, package by table, arrange pickup and capture actual costs for the next quote.'],
   scenario:'A reception needs 60 glasses, 12 table signs and 1 welcome plaque; engraving cannot use one shared recipe for every material.'
  }),
  section('oct-scenario-coach','Scenario 4: Coach recognition gift set','Turn a marketing package into a controlled small-batch job.',{
   relatedRoutes:['/creative-operations','/marketing','/quote-builder','/manufacturing-recipes'],
   steps:['Save organization preferences and award list; verify all coach names.','Choose a sample-tested recognition package with unit costs and decoration steps.','Make proof images and confirm personalized spelling before invoicing.','Record each job line, physical stock and process recipe for plaque, patch or cup.','Perform final QC, photograph finished samples and note presentation/packaging instructions.'],
   scenario:'A youth league orders 18 recognition sets, including engraved plaques and team-branded drinkware.'
  }),
  section('oct-scenario-corporate','Scenario 5: Corporate logo change and reorder','Protect old orders while deploying a new shared artwork revision.',{
   relatedRoutes:['/marketing','/client-graphics','/catalog-modernization','/customer-reorders'],
   steps:['Open the existing CRM organization instead of making a duplicate.','Preserve prior logo as historical revision; upload new source and obtain explicit approval.','Review every product using the shared asset and the affected placement/preflight/variation certification.','Use Customer Reorders to copy approved specifications only where unchanged.','Create new job/travelers pointing to the updated approved artwork; finish QC before release.'],
   scenario:'A company updates its emblem and reorders polos, caps and mugs.'
  }),
  section('oct-scenario-event','Scenario 6: On-site event sale and mistake recovery','Record a real sale and the cost of rework.',{
   relatedRoutes:['/onsite-sales','/spoilage','/inventory-audit','/job-costing'],
   steps:['Count event blanks and pre-made inventory by SKU and bin before setup.','Enter each sale with the right product, quantity and approved name/number personalization.','Process production and QC under the approved machine recipe.','When an item is misprinted, use Spoilage/Misprints and assign a replacement blank instead of hiding the error.','Reconcile event sales and remaining stock through a physical count and job-costing review.'],
   scenario:'A weekend soccer tournament requests last-minute player names while several items are sold from existing finished stock.'
  })
 ]},
{
 id:'oct-release-gates',title:'Feature Readiness and Planned-Work Boundaries',
 description:'Code, source documentation and a visible button do not prove that connected services or live commerce are active.',
 sections:[
  section('oct-current-vs-planned','How to interpret a feature status','Separate coded, configured, tested and actually used. A feature can be implemented in source while remaining disabled or incomplete in the workshop.',{
   relatedRoutes:['/application-guide','/deployment-health','/woo-sync','/product-event-center'],
   steps:['For any new feature, verify code in production, latest database migration, server secrets/feature flags, employee role, functional test and actual business-record output.','Woo graphic selector: test plugin activation, product mapping approval, public choice display, live-safe checkout, webhook resolution and traveler identity separately.','Printer integration: confirm CUPS, network device, correct paper, D530 Pro/Epson queue, agent status and signed preview before enabling automatic dispatch.','Local AI: verify approved business-manual indexing, private gateway, Tailscale, model availability and cited answers.','AI Product Discovery: only run manually within provider quotas; scheduled unattended discovery is not part of the current documented release.','If one check is missing, label the feature Pending setup, Unverified or Not implemented, rather than Complete.'],
   warnings:['Do not deploy a schema migration, rotate API keys, activate payments or route printers just to complete a documentation checklist.','Verify these statuses against current environment; these notes are not a live configuration audit.']
  })
 ]
}
];
