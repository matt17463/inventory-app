export const GUIDE_VERSION = '1.4.25';

const section = (id, title, summary, options = {}) => ({
  id,
  title,
  summary,
  ...options,
});

export const guideChapters = [
  {
    id: 'start-here',
    title: 'Start Here: How Skilled Crafting Uses the System',
    description: 'The operating model, daily rhythm, roles, terminology, and the fastest way to understand how the entire system fits together.',
    sections: [
      section(
        'system-purpose',
        'What the system is designed to do',
        'The Skilled Crafting system is an operating system for a custom apparel business. WooCommerce captures online demand; the inventory app turns demand into inventory, purchasing, artwork, production, quality-control, and fulfillment actions.',
        {
          useWhen: [
            'Training a new employee or manager.',
            'Explaining why a screen or workflow exists.',
            'Deciding which system should be updated when information changes.',
          ],
          scenario:
            'A school places a spirit-wear order online. WooCommerce records what the customer purchased. The inventory app determines which physical blanks are required, where those blanks are stored, whether shortages need to be purchased, whether artwork is ready, and what production work must happen before the order can be completed.',
          steps: [
            'Use WooCommerce as the customer-facing product and online-order source.',
            'Use the inventory application as the operational source for blanks, bins, reservations, purchasing, production, and internal workflow.',
            'Use Supabase as the structured operational database behind the inventory application.',
            'Use Cloudflare R2 for durable artwork and Mockup Studio image storage where the app is configured to do so.',
            'Use the custom WordPress/WooCommerce plugins to connect customer-facing activity to operational workflows.',
          ],
          tips: [
            'When there is a conflict between what is physically in the shop and what the app says is in a bin, treat the physical count as the fact to investigate, then use the appropriate audit/receiving/transfer workflow to correct the application rather than editing totals directly.',
            'When a WooCommerce product looks right to the customer but pull-sheet behavior is wrong, investigate product-to-blank mapping before changing inventory quantities.',
          ],
        }
      ),
      section(
        'four-questions',
        'The four questions the app should answer every day',
        'The application is most useful when it is treated as a command center rather than as a collection of unrelated tools.',
        {
          scenario:
            'At the beginning of the day, you should be able to determine whether any customer order is at risk without opening WooCommerce, Supabase, R2, and several spreadsheets separately.',
          steps: [
            'What do we have? Review on-hand, reserved, available, finished, sample, and bin-level inventory.',
            'What do we need? Review shortages, Pending Stock, purchase orders, vendor pricing, and Waiting On.',
            'What should we make next? Review due dates, Order Risk, Production Board, Shop TV/Touch Mode, and employee tasks.',
            'What problems need attention? Review the Exception Center, Product Data Health, Product Integrity, Operations Integrity, Deployment Health, and Asset Storage Health.',
          ],
        }
      ),
      section(
        'daily-rhythm',
        'Recommended daily operating rhythm',
        'A repeatable rhythm keeps problems from becoming emergency work.',
        {
          useWhen: ['Opening the shop for the day.', 'Training a manager.', 'Building a checklist for staff.'],
          steps: [
            'Morning: Open Daily Command Center and Exception Center. Resolve critical customer, inventory, purchasing, or integration problems first.',
            'Review Production → Order Risk and Pull Sheet Due Dates. Identify jobs due soon, jobs blocked by blanks, and jobs blocked by artwork or QC.',
            'Review Purchasing → Waiting On and Purchase Orders. Confirm expected arrivals and late supplier orders.',
            'As supplier boxes arrive, receive them through Add Item to Bin, PO receiving, or supplier-confirmation receiving. Put the physical goods in the same bins recorded in the app.',
            'Before production begins, open the pull sheet, verify the blank pairing, confirm the source bin, and confirm artwork is approved.',
            'During production, record spoilage immediately and use Complete + Deduct only when the blank has actually been consumed for production.',
            'At end of day, review unfinished jobs, unresolved exceptions, unusual inventory movements, and any receiving that has not yet been put away.',
          ],
          tips: ['The goal is not to visit every page daily. The goal is to use the app at the checkpoints where operational truth can change.'],
        }
      ),
      section(
        'roles',
        'Suggested responsibilities by role',
        'Different users should understand different parts of the application, even when the same person performs several roles.',
        {
          steps: [
            'Owner/Admin: Understand all screens, integrations, health tools, product mapping, Woo sync, costing, pricing, and deployment controls.',
            'Manager: Focus on Command Center, Production Board, Order Risk, Purchasing, jobs, QC, exceptions, capacity, and customer deadlines.',
            'Receiving/Warehouse: Focus on Add Item to Bin, supplier receiving, bins, scanning, transfers, audits, labels, and purchase-order receiving.',
            'Production: Focus on pull sheets, reservations, Production Board, Shop TV, QC, spoilage, photo proof, and completion/deduction actions.',
            'Artwork/Admin: Focus on Artwork Requests, Mockup Studio, approvals, R2 assets, product creation, customer review links, and artwork handoff.',
          ],
          warnings: [
            'Bulk mapping changes, direct database edits, unit-cost changes, non-inventory rules, and integration configuration should be limited to users who understand downstream effects.',
          ],
        }
      ),
      section(
        'core-terms',
        'Core terminology',
        'Many application problems come from confusing inventory, reservations, mappings, and jobs.',
        {
          steps: [
            'Blank product: one exact undecorated item defined by Brand + Style + Color + Size.',
            'Finished product: a decorated item intentionally held in inventory for later fulfillment or sale.',
            'Bin: the physical storage location where an item is actually kept.',
            'On Hand: how many physical units the app believes exist.',
            'Reserved: units committed to open work.',
            'Available: On Hand minus Reserved.',
            'Pending Stock: a planning location/status for required units that are not physically available. It is not real inventory.',
            'Job: the production work record.',
            'Pull sheet: the employee-facing list of what must be pulled and produced for a job.',
            'Mapping: the durable connection between a WooCommerce/source product and the correct physical blank.',
            'Inventory movement: the audit record created when quantity changes because of receiving, transfer, completion, adjustment, return, or spoilage.',
            'Non-inventory item: a fee, service, customer-supplied item, or other line that should not create blank-inventory demand.',
          ],
        }
      ),
    ],
  },

  {
    id: 'inventory',
    title: 'Inventory Operations',
    description: 'Receiving, bins, scanning, transfers, audits, samples, low stock, valuation, and blank-product maintenance.',
    sections: [
      section(
        'inventory-overview',
        'Inventory Overview',
        'Inventory Overview is the quickest place to answer what the shop currently has, where it is, and how much is available after reservations.',
        {
          useWhen: [
            'Checking whether an item is physically available before promising a rush order.',
            'Looking up inventory by SKU, product name, brand, style, color, or size.',
            'Investigating why a pull sheet says an item is unavailable.',
          ],
          scenario:
            'A coach asks whether you can add two Adult Large black Gildan 18500 hoodies to an order today. Search Inventory Overview for the style/color/size, verify On Hand and Available, then check the bin before committing to the change.',
          tips: [
            'Available quantity is more useful for new commitments than raw On Hand because units may already be reserved for other jobs.',
            'If the search result is surprising, check the bin and Inventory Audit rather than creating a duplicate blank product.',
          ],
          relatedRoutes: ['/inventory/blanks', '/reservations', '/inventory-audit'],
        }
      ),
      section(
        'add-item',
        'Add Item to Bin / Manual Receiving',
        'Use Add Item to Bin when physical blank inventory enters the building and is not being received directly against another specialized receiving workflow.',
        {
          useWhen: [
            'Receiving a small supplier order.',
            'Adding stock bought locally.',
            'Receiving replacements or samples.',
            'Entering several sizes of the same style/color into one or more bins.',
          ],
          scenario:
            'A SanMar box contains 6 black Gildan 18500 hoodies: 2 Medium, 2 Large, 1 XL, and 1 2XL. Enter each size as its own receiving line, choose the real destination bin, confirm the product match, and receive the lines. Do not enter all six as one generic hoodie line.',
          steps: [
            'Choose the destination bin that will physically contain the item.',
            'Select the blank product or enter Brand, Style, Color, and Size as required by the screen.',
            'Enter the actual received quantity, not the ordered quantity.',
            'Enter receiving notes when the shipment is unusual, short, damaged, or tied to a specific order.',
            'Run match validation before receiving when the screen offers it.',
            'Receive only complete, correctly matched lines.',
            'Physically put the goods in the recorded bin immediately so the app and shop remain synchronized.',
          ],
          warnings: [
            'Do not create a new blank simply because search did not immediately find the item. First verify spelling, color aliases, product type, and existing product records.',
            'Receiving into Pending Stock is incorrect. Pending Stock represents shortage planning, not a physical shelf.',
          ],
          relatedRoutes: ['/add-item', '/inventory/edit-blanks', '/color-pairings'],
        }
      ),
      section(
        'supplier-confirmation-receiving',
        'Supplier Confirmation Receiving',
        'Supplier confirmation receiving is designed for larger supplier documents where the application parses line items and helps match them to blank products.',
        {
          useWhen: [
            'Receiving from a supplier confirmation PDF or spreadsheet.',
            'Processing many line items more quickly than manual receiving.',
            'Re-opening a partially received supplier order.',
          ],
          scenario:
            'A supplier confirmation contains 38 garment lines. Upload the file, inspect yellow/red rows, correct any Brand/Style/Color/Size mismatch, choose destination bins, and receive only the units that actually arrived. If the shipment is partial, leave the unreceived quantity open rather than forcing the PO complete.',
          steps: [
            'Upload the supplier confirmation or supported spreadsheet.',
            'Review every unmatched or warning row before saving.',
            'Correct supplier color names with the canonical color or Color Pairings when needed.',
            'Confirm quantity actually received.',
            'Confirm the physical destination bin.',
            'Receive selected/valid rows.',
            'If the same supplier order is reopened later, verify the screen shows previously received quantities so only remaining units are received.',
          ],
          warnings: [
            'A supplier line that lacks enough reliable identity data should not silently create a new blank product.',
            'If the request times out, verify the receiving result before retrying so a successful backend receipt is not duplicated.',
          ],
        }
      ),
      section(
        'edit-blanks',
        'Edit Blank Items',
        'Edit Blank Items is for maintaining product identity and inventory metadata; it is not the normal way to receive stock.',
        {
          useWhen: [
            'Correcting brand, style, color, size, barcode, unit cost, supplier, image, or low-stock threshold.',
            'Applying a safe bulk update to a known group of blank products.',
          ],
          scenario:
            'You discover that every C2 510000 Kelly shirt has an outdated unit cost. Search for that exact brand/style/color family, select the affected sizes, update Unit Cost, and then verify Inventory Valuation and Job Costing.',
          warnings: [
            'Changing Brand, Style, Color, or Size changes product identity and may affect mappings. Use Product Integrity afterward if the change could create a duplicate.',
            'Do not use Edit Blank Items merely to make inventory totals match a physical count. Use audit/adjustment workflows so there is an inventory movement record.',
          ],
          relatedRoutes: ['/inventory/edit-blanks', '/product-integrity', '/valuation'],
        }
      ),
      section(
        'new-product-line',
        'New Product Line Setup',
        'Use New Product Line Setup when adding a new blank style or a family of color/size combinations before stock exists.',
        {
          scenario:
            'Skilled Crafting decides to begin carrying a new Independent Trading hoodie. Create the product-line matrix, define the brand/style/product type, choose supported colors and sizes, create zero-on-hand blank records, then establish WooCommerce pairings as products are created.',
          steps: [
            'Confirm the manufacturer/brand and style number.',
            'Assign the correct product type such as Hoodie, Tee, Sweatshirt, Bag, or Drinkware.',
            'Create the required color/size matrix.',
            'Create blank-product rows with zero on hand if the application workflow supports it.',
            'Add supplier/catalog data and unit costs when known.',
            'Pair WooCommerce variations only to the exact physical blank each variation requires.',
          ],
          tips: ['Preparing the blank catalog before customer orders arrive prevents emergency mapping repair later.'],
          relatedRoutes: ['/new-product-line', '/product-type-manager', '/product-blank-mappings'],
        }
      ),
      section(
        'bins-transfers',
        'Bins and Transfers',
        'Bins represent real physical locations. Transfers change location without changing total inventory.',
        {
          scenario:
            'A size bin is overcrowded, so 20 Adult Large black tees are moved from AL-1 to AL-2. Record a transfer of 20 units from the original bin to the new bin, then physically move the items. Do not subtract from one inventory row and add to another manually.',
          steps: [
            'Keep bin names simple and consistent with physical labels.',
            'Use Bin Contents before moving inventory to confirm what the app expects to be there.',
            'Choose the source bin, product, quantity, and destination bin.',
            'Complete the transfer.',
            'Verify both bin balances and then move the physical goods.',
          ],
          relatedRoutes: ['/bins', '/transfer'],
        }
      ),
      section(
        'scan-labels-nfc',
        'Scanning, Barcode Labels, and NFC',
        'Scanning reduces lookup time and helps connect physical products and bins to the correct application records.',
        {
          useWhen: [
            'Receiving products with vendor UPC labels.',
            'Finding a product during an audit.',
            'Opening a bin from an NFC tag.',
            'Printing internal product/bin labels.',
          ],
          scenario:
            'During a cycle count, scan a garment UPC. Confirm the matched blank record is the exact brand/style/color/size before adjusting anything. If the barcode points to the wrong blank, correct the barcode/product data rather than changing the count for the wrong record.',
          steps: [
            'Open Scan Inventory or the relevant scan-enabled workflow.',
            'Scan the UPC/barcode or manually enter the SKU.',
            'Confirm the exact product match.',
            'Continue to receive, inspect, transfer, or audit as appropriate.',
            'For NFC, test every tag after writing it and before relying on it during production.',
          ],
          relatedRoutes: ['/scan', '/labels', '/nfc-writer', '/test-tag'],
        }
      ),
      section(
        'audit',
        'Inventory Audit, Cycle Count, and Warehouse Audit',
        'Audits reconcile system quantities to physical reality while preserving a traceable adjustment history.',
        {
          useWhen: [
            'Performing routine cycle counts.',
            'Investigating an unexpected shortage.',
            'Preparing for a full warehouse count.',
            'Verifying that receiving and production deductions are working.',
          ],
          scenario:
            'The app shows 9 Adult Medium black tees in bin AM, but only 7 are physically present. Count again, check recent movements and pull sheets, then record the verified count through the audit workflow. The resulting discrepancy becomes something you can investigate instead of silently disappearing.',
          steps: [
            'Choose the bin or audit scope.',
            'Count physical units without changing records mid-count.',
            'Compare physical count to expected count.',
            'Review suspicious differences using Audit Trail and recent inventory movements.',
            'Apply verified adjustments through the audit workflow.',
            'Export/print warehouse audit sheets when performing a larger physical count.',
          ],
          tips: [
            'Repeated discrepancies for the same style or bin often indicate a process problem in receiving, transfers, spoilage, or completion—not simply bad counting.',
          ],
          relatedRoutes: ['/audit', '/inventory-audit', '/audit/warehouse', '/audit-trail'],
        }
      ),
      section(
        'samples-lowstock-valuation',
        'Samples, Low Stock, and Inventory Valuation',
        'These tools help separate showroom/sample inventory, anticipate replenishment, and understand the financial value of stock.',
        {
          scenario:
            'Before a large school campaign, review Low Stock for core black garments and Inventory Valuation for excess slow-moving colors. Use the information to buy necessary basics without increasing dead stock unnecessarily.',
          steps: [
            'Use Sample Inventory for products intentionally held as samples rather than normal production stock.',
            'Set low-stock thresholds only for products where replenishment behavior makes sense.',
            'Review Low Stock before large campaigns and supplier orders.',
            'Maintain accurate unit costs so Inventory Valuation and Job Costing are meaningful.',
          ],
          relatedRoutes: ['/inventory/samples', '/low-stock', '/valuation'],
        }
      ),
    ],
  },

  {
    id: 'orders-production',
    title: 'Orders, Pull Sheets, Reservations, and Production',
    description: 'How customer demand becomes a production job, how inventory is reserved and pulled, and how production is completed correctly.',
    sections: [
      section(
        'order-sources',
        'Order Sources',
        'Operational work can begin in WooCommerce, a manual invoice, a quote, an artwork handoff, a reorder, or an on-site sale.',
        {
          scenario:
            'A school emails a bulk order and is invoiced in QuickBooks instead of ordering online. Enter it as a Manual Invoiced Order so the production and inventory system still sees the job, reserves blanks, creates shortages, and tracks completion.',
          steps: [
            'WooCommerce orders: customer-facing online orders and product selections.',
            'Manual Invoiced Orders: jobs billed outside WooCommerce.',
            'Quote-to-Order: approved quotes converted into operational work.',
            'Artwork handoffs/reorders: approved designs or repeat requests that need to become production work.',
            'On-site sales: event transactions where decoration and inventory deduction happen in a compressed workflow.',
          ],
          relatedRoutes: ['/manual-orders', '/quote-to-order', '/artwork-requests', '/onsite-sales'],
        }
      ),
      section(
        'manual-orders',
        'Manual Invoiced Orders',
        'Manual orders let Skilled Crafting run non-WooCommerce work through the same inventory and production controls.',
        {
          useWhen: ['QuickBooks invoice orders.', 'Email/phone orders.', 'School or team bulk orders handled outside the storefront.'],
          scenario:
            'A coach emails a roster order for 22 jerseys. Create the customer/order header, enter one line per actual blank variation, include artwork notes, due date, and invoice reference, then generate the job. Items that are fees or customer-supplied should be marked/excluded so they do not create purchasing demand.',
          steps: [
            'Enter customer/organization and invoice reference.',
            'Enter order date and realistic due date.',
            'Add one line per physical blank variation.',
            'Enter item quantity and pricing as needed for costing.',
            'Identify non-inventory lines correctly.',
            'Generate the job only after required line data is complete.',
            'Review the resulting pull sheet and purchasing demand.',
          ],
          warnings: ['A manual order can affect reservations and purchasing just like a WooCommerce order. Treat it as a real operational order, not just a note.'],
          relatedRoutes: ['/manual-orders', '/non-inventory-rules', '/pullsheets'],
        }
      ),
      section(
        'pull-sheets',
        'Pull Sheets',
        'The pull sheet is the operational bridge between the customer-facing product and the physical blank that must be pulled.',
        {
          scenario:
            'WooCommerce order #170 contains a decorated team hoodie. The pull sheet should resolve that finished variation to the exact blank hoodie required, show the physical source bin if available, and show Pending Stock if no unreserved blank is available.',
          steps: [
            'Open the pull sheet and review every line before pulling.',
            'Confirm the displayed blank is the physical item you intend to decorate.',
            'Confirm the source bin and available quantity.',
            'If the blank is wrong, use Override Blank Pairing or the appropriate mapping-repair tool.',
            'Leave Remember Mapping enabled only when the corrected relationship should apply to future occurrences of the same WooCommerce variation/SKU.',
            'If no stock is available, verify Pending Stock and purchasing demand rather than pretending inventory exists.',
            'Use completion actions only after production work has actually consumed the blank.',
          ],
          warnings: [
            'Viewing a pull sheet should be read-only. Simply opening the page should not deduct inventory.',
            'Do not fix a wrong pairing by receiving the wrong product or changing inventory counts. Fix the mapping.',
          ],
          relatedRoutes: ['/pullsheets', '/product-blank-mappings', '/bulk-pairing-repair'],
        }
      ),
      section(
        'reservations',
        'Reservations',
        'Reservations prevent two open jobs from assuming they can use the same physical blank.',
        {
          scenario:
            'There are 10 black Adult Large tees on hand. Job A needs 8 and Job B needs 5. On Hand is still 10, but Available becomes negative after both commitments. Purchasing should respond to the shortage even though the physical shelf still contains 10 units.',
          steps: [
            'Review reservations for open jobs when availability looks unexpectedly low.',
            'Confirm the reservation quantity matches the job requirement.',
            'Do not delete valid reservations simply to make availability look better.',
            'Close/release reservations through the normal job-completion or cancellation workflow.',
          ],
          tips: ['On Hand answers what is physically present. Available answers what is still free to promise.'],
          relatedRoutes: ['/reservations', '/purchasing'],
        }
      ),
      section(
        'pending-stock',
        'Pending Stock',
        'Pending Stock represents demand for an item that is not currently available in a real bin.',
        {
          scenario:
            'A pull sheet needs two Kelly Large tees, but none are available. The line is assigned to Pending Stock and should appear in purchasing. When the supplier shipment arrives, receive the actual tees into a real bin. The production line can then be fulfilled from physical inventory.',
          warnings: [
            'Pending Stock is not a physical location and should never be treated as proof that an item exists.',
            'If a Pending Stock line is caused by a bad blank pairing, fix the pairing before ordering anything.',
          ],
        }
      ),
      section(
        'production-board',
        'Production Board, Shop TV, and Order Risk',
        'These screens answer what should be produced next and what is in danger of missing a commitment.',
        {
          scenario:
            'Three team orders are in production, but one due tomorrow is waiting on a single 2XL hoodie. Order Risk should surface that job. Waiting On should show the missing blank or incoming PO. Shop TV can then show staff the jobs that are actually ready to work.',
          steps: [
            'Use Order Risk to find active jobs with due-date, stock, artwork, or progress concerns.',
            'Use Production Board to move work through operational statuses.',
            'Use Shop TV/Touch Mode as a floor-friendly display for production staff.',
            'Use Pull Sheet Due Dates and Production Calendar for schedule planning.',
            'Use Capacity Planning and Production Time Estimator when several large jobs compete for the same production window.',
          ],
          relatedRoutes: ['/production-board', '/shop-tv', '/order-risk', '/pullsheet-due-dates', '/production-calendar', '/capacity-planning', '/production-estimator'],
        }
      ),
      section(
        'complete-deduct',
        'Complete + Deduct vs. Mark Complete Only',
        'Completion actions must reflect what physically happened to the blank.',
        {
          scenario:
            'You pull one black hoodie, decorate it, inspect it, and pack it for the customer. Use Complete + Deduct so the blank leaves on-hand inventory. If a line is administrative/non-stock and no blank was consumed, do not use an inventory-deducting action.',
          steps: [
            'Use Complete + Deduct after the actual blank has been pulled/produced and should leave blank inventory.',
            'Use Mark Complete Only only when the line/job status must change without changing inventory and you intentionally understand why.',
            'If production fails because of a misprint, record spoilage so the lost blank is accounted for and replacement demand can be understood.',
            'If the finished item is intentionally kept for future use rather than delivered, use the finished-inventory workflow instead of leaving it as a blank.',
          ],
          warnings: ['Never use completion merely to make an error disappear. Incorrect completion can hide shortages and distort valuation.'],
          relatedRoutes: ['/spoilage', '/return-finished', '/finished/create'],
        }
      ),
      section(
        'qc-photo-proof',
        'Quality Control, Spoilage, and Production Photo Proof',
        'QC protects customer satisfaction and creates a record of what left the shop.',
        {
          scenario:
            'A 24-piece school order is complete. Before marking it ready, compare quantities and sizes to the order, verify logo orientation and placement, check names/numbers, photograph the completed order if useful, and record any damaged/misprinted garment through Spoilage.',
          steps: [
            'Complete the QC checklist before final fulfillment.',
            'Record defects and spoilage immediately.',
            'Use Production Photo Proof for evidence of completed/packed work when helpful.',
            'Do not reuse a spoiled blank count in another job unless the item is physically usable and has been returned through an appropriate inventory workflow.',
          ],
          relatedRoutes: ['/qc-checklist', '/spoilage', '/production-photo-proof'],
        }
      ),
      section(
        'finished-inventory',
        'Finished Inventory and Match Suggestions',
        'Finished inventory is decorated merchandise intentionally held for later sale or fulfillment.',
        {
          scenario:
            'After an event, you have three already-decorated club hoodies in common sizes. Return them to finished inventory with the correct finished-product identity and bin. On a future order, Finished Match Suggestions can help use those items before decorating new blanks.',
          steps: [
            'Only create/return finished inventory when the item will truly remain available for future fulfillment.',
            'Use a finished inventory bin that matches the physical storage location.',
            'Confirm the decorated product identity and associated blank/product data.',
            'Use finished match suggestions when fulfilling new demand to avoid unnecessary production.',
          ],
          relatedRoutes: ['/return-finished', '/finished/create', '/finished-suggestions'],
        }
      ),
      section(
        'onsite-sales',
        'On-site Sales',
        'On-site Sales supports event transactions where customers choose a product/logo and the item is decorated while they wait or shortly afterward.',
        {
          scenario:
            'At a soccer registration event, choose the correct WooCommerce category, then guide the customer through garment type, brand, style, color, size, and available logo options. Confirm inventory before the sale. Use Test Mode during setup so practice transactions do not consume stock.',
          steps: [
            'Before the event, verify WooCommerce API connectivity, product categories, product-type classification, blank mappings, available stock, artwork/logo choices, and label printer.',
            'Use Test Mode for practice transactions and staff training.',
            'Select only products that can be correctly paired to a physical blank.',
            'Confirm personalization details such as player name/number before printing or producing.',
            'Complete the sale through the event workflow so inventory deduction and purchasing reconciliation remain accurate.',
            'Print a test label before customer traffic begins and verify repeated labels do not produce blank/footer-only outputs.',
          ],
          warnings: [
            'If WooCommerce returns HTML, a CAPTCHA page, or an invalid JSON response, treat that as a hosting/API problem rather than a product-data problem.',
          ],
          relatedRoutes: ['/onsite-sales', '/deployment-health'],
        }
      ),
    ],
  },

  {
    id: 'purchasing',
    title: 'Purchasing and Supplier Workflows',
    description: 'How shortages become orders, how bad pairings are corrected, and how supplier purchases are tracked through receipt.',
    sections: [
      section(
        'purchasing-report',
        'Purchasing Report',
        'The Purchasing Report should answer what must actually be ordered—not simply what appears on a customer order.',
        {
          scenario:
            'A pull sheet has four shortage lines: three are real garment needs and one is a rush fee. The report should include the three garment shortages and exclude the fee. If one garment is paired to the wrong blank, repair the pairing before placing the supplier order.',
          steps: [
            'Review each shortage and confirm it represents a real physical blank need.',
            'Check Pending Stock lines for mapping errors before purchasing.',
            'Use inline pairing repair when the suggested blank is wrong.',
            'Use Non-Inventory Rules for fees/services that should never create blank demand.',
            'Group the real shortages into supplier orders.',
          ],
          warnings: ['Purchasing is downstream of mapping and reservations. If either is wrong, the order recommendation can be wrong.'],
          relatedRoutes: ['/purchasing', '/non-inventory-rules', '/product-blank-mappings'],
        }
      ),
      section(
        'purchase-orders',
        'Purchase Orders',
        'Purchase Orders track what Skilled Crafting intends to buy, what has been submitted, and what has actually arrived.',
        {
          scenario:
            'A recommended order shows 42 garments needed from SanMar. Build the PO, review quantities and supplier SKUs, submit the order to SanMar, mark the PO submitted, then receive only what physically arrives. If two items are backordered, keep those quantities open.',
          steps: [
            'Create a PO from validated purchasing demand or create it manually when appropriate.',
            'Review supplier, products, quantities, and expected cost.',
            'Submit to the supplier through the normal supplier channel.',
            'Mark the PO submitted so Waiting On and expected-arrival workflows have accurate status.',
            'Receive partial shipments without closing unreceived lines.',
            'Resolve damaged/short items instead of marking them received.',
          ],
          relatedRoutes: ['/purchase-orders', '/purchase-orders/new', '/waiting-on'],
        }
      ),
      section(
        'waiting-on',
        'Waiting On',
        'Waiting On is the list of production work blocked by missing materials or expected arrivals.',
        {
          scenario:
            'A team order cannot start because Adult Small jerseys are on an open supplier order. Waiting On should show the affected job and expected arrival context so the production manager does not repeatedly investigate the same shortage.',
          steps: [
            'Review Waiting On daily for due-soon jobs.',
            'Confirm every blocked item has either an open PO, a sourcing plan, or a corrected pairing.',
            'Update or resolve the item as stock arrives.',
          ],
          relatedRoutes: ['/waiting-on', '/purchase-orders', '/order-risk'],
        }
      ),
      section(
        'supplier-catalog',
        'Supplier Catalog Import, Review, and Vendor Prices',
        'Supplier catalog tools help normalize supplier data, compare sourcing options, and keep product costs current.',
        {
          scenario:
            'A supplier feed lists a color as “Athletic Heather” while WooCommerce uses a canonical value. Use catalog review and Color Pairings to normalize the relationship instead of creating a second near-duplicate color.',
          steps: [
            'Import supported supplier catalog data.',
            'Review unresolved brand/style/color/size matches.',
            'Use Color Pairings for repeatable supplier-to-canonical color normalization.',
            'Review Vendor Prices when the same blank can be sourced from multiple suppliers.',
            'Update costs carefully because they affect valuation and job costing.',
          ],
          relatedRoutes: ['/supplier-catalog/import', '/supplier-catalog', '/vendor-prices', '/color-pairings'],
        }
      ),
    ],
  },

  {
    id: 'artwork',
    title: 'Artwork Requests, Mockup Studio, and Customer Approval',
    description: 'How artwork enters the system, becomes a production-ready asset, is stored, approved, and connected to products/jobs.',
    sections: [
      section(
        'artwork-requests',
        'Artwork Requests',
        'Artwork Requests captures the customer’s design requirements, source files, garment preferences, deadlines, and other details required to create production artwork.',
        {
          scenario:
            'A soccer team requests a hoodie design with a crest on the sleeve, team graphic on the front, and player last name on the back. The artwork request should preserve those placement instructions and source files so the designer does not need to reconstruct them from email.',
          steps: [
            'Review the customer/organization, garment, colors, audience, design style, text, placement, and deadline.',
            'Review attached source files before designing.',
            'Use the generated prompt/details as a starting point, not as a replacement for customer requirements.',
            'Create or upload mockups.',
            'Send the customer review link and record approval/revision requests.',
            'Only hand off to production when the required artwork is approved and production-ready.',
          ],
          relatedRoutes: ['/artwork-requests'],
        }
      ),
      section(
        'mockup-studio',
        'Mockup Studio Projects',
        'Mockup Studio is the working area for blank photos, artwork files, placements, previews, production dimensions, WooCommerce product creation, and project asset management.',
        {
          scenario:
            'Create a school hoodie project. Add the hoodie blank photos, import the school logo, define left-chest and full-back placements, generate previews, set actual production dimensions, and then use the project to create/update the WooCommerce product without losing the original production files.',
          steps: [
            'Create/open the customer project.',
            'Add or select blank-product photos.',
            'Upload or import approved artwork into the project.',
            'Create only the placements that should actually be offered.',
            'Set production dimensions independently from how large the preview happens to look on the mockup.',
            'Generate/review previews and production images.',
            'Create or update the WooCommerce product only after blank mapping, variation structure, artwork, and product options are ready.',
            'Use Download Project Graphics when a local working copy is needed; do not delete cloud source files merely because a download succeeded.',
          ],
          warnings: [
            'A mockup preview is not automatically the production artwork. Keep the source/production asset and actual intended dimensions.',
            'Do not manually delete R2 objects used by the project. Use the app’s archive/delete controls so metadata and storage remain synchronized.',
          ],
          relatedRoutes: ['/mockup-studio', '/asset-storage-health'],
        }
      ),
      section(
        'r2-storage',
        'Cloudflare R2 Storage and Local Archives',
        'R2 stores active project images so the application can avoid repeated large-file egress from Supabase Storage while keeping project metadata in Supabase.',
        {
          scenario:
            'A legacy project still has images in Supabase Storage. Open the project’s Cloud Image Storage panel and use the project migration control. Let the application copy and verify the files before deleting the old cloud objects.',
          steps: [
            'Confirm Asset Storage Health reports R2 as ready before large artwork operations.',
            'New Mockup Studio uploads/imports should be stored in R2 when configured.',
            'When importing an Artwork Request/Reorder/Vault image, let the app create a private project copy in R2.',
            'Use Move This Project to R2 for legacy Mockup Studio projects instead of manually moving objects.',
            'For completed/inactive projects, use the verified local archive workflow only on a permanent backed-up location.',
            'Keep a second backup of any archive that will no longer exist in cloud storage.',
          ],
          warnings: ['Do not assume an empty R2 bucket means deployment failed; objects appear as projects upload, import, generate, migrate, or restore assets.'],
          relatedRoutes: ['/asset-storage-health', '/mockup-studio'],
        }
      ),
      section(
        'customer-approval',
        'Customer Review, Approval, and Reorders',
        'Customer-facing status should stay simple while internal workflow remains detailed.',
        {
          scenario:
            'A customer receives a private review link, requests a wording change, then approves the revised mockup. Record the revision and final approval. Future reorders should reuse the approved artwork rather than asking the customer to resubmit it.',
          steps: [
            'Send a review link only for the correct customer/project.',
            'Record requested changes as part of the project history.',
            'Update the status when revised artwork is ready.',
            'Record final approval.',
            'Promote/use approved artwork for future reorders when appropriate.',
            'Translate internal statuses into customer-friendly language such as Artwork Received, Mockup Ready, Approved, Waiting on Blanks, In Production, Quality Check, Ready, and Completed.',
          ],
          relatedRoutes: ['/customer-reorders', '/customer-portal-admin', '/customer-portal-preview'],
        }
      ),
    ],
  },

  {
    id: 'management',
    title: 'Management, Pricing, Quotes, Costing, and Planning',
    description: 'Tools used to prioritize work, understand profit, plan capacity, quote jobs, and manage customer opportunities.',
    sections: [
      section(
        'command-center-exceptions',
        'Daily Command Center and Exception Center',
        'Use these together: Command Center tells you what matters today; Exception Center tells you what is broken or missing.',
        {
          scenario:
            'On Monday morning, Command Center shows several due-soon jobs. Exception Center shows one of them has a missing blank mapping and another is waiting on a late PO. Fix the mapping first, confirm the late PO, then reprioritize production.',
          steps: [
            'Review critical/overdue items first.',
            'Open the related job/product/PO rather than treating the alert as the problem itself.',
            'Fix the underlying cause.',
            'Refresh and confirm the exception clears.',
          ],
          relatedRoutes: ['/command-center', '/exception-center'],
        }
      ),
      section(
        'job-costing',
        'Job Costing',
        'Job Costing helps identify whether actual blank cost, spoilage, pricing, and order structure produced an acceptable margin.',
        {
          scenario:
            'A team order generated less margin than expected. Review blank cost, quantities, spoilage, rush/service charges, and selling price. If a higher-cost blank was substituted, adjust future pricing rules or product setup rather than editing the completed job to look better.',
          steps: [
            'Review low-margin or negative-margin jobs.',
            'Check blank unit costs.',
            'Check spoilage and replacement units.',
            'Check revenue and pricing rules.',
            'Use findings to improve future quotes/products.',
          ],
          relatedRoutes: ['/job-costing', '/pricing-rules'],
        }
      ),
      section(
        'quotes-pricing',
        'Quote Builder, Pricing Rules, and Quote-to-Order',
        'These tools connect pricing decisions to operational work.',
        {
          scenario:
            'A school requests 75 shirts with a two-location print. Build the quote using known blank cost and decoration pricing, review margin, send the quote, then convert the approved quote to an order without retyping all production data.',
          steps: [
            'Build the quote with realistic product, quantity, decoration, setup, shipping, and tax assumptions.',
            'Use Pricing Rules for repeatable markup/decoration rules rather than manually guessing every order.',
            'Review expected margin before sending.',
            'Convert an accepted quote to operational work using Quote-to-Order.',
            'Confirm the generated order/job lines map to physical blanks.',
          ],
          relatedRoutes: ['/quote-builder', '/pricing-rules', '/quote-to-order'],
        }
      ),
      section(
        'forecast-reorders',
        'Campaign Forecast and Customer Reorders',
        'Historical customer behavior can help plan stock and proactively support repeat customers.',
        {
          scenario:
            'A soccer club typically reorders black hoodies every fall. Review customer reorder history and campaign forecast before the season, then maintain a sensible amount of core blank stock without overcommitting to customer-specific finished inventory.',
          tips: [
            'Forecasts inform purchasing; they do not override current reservations, real orders, or physical counts.',
            'Use customer history to anticipate likely repeat products and artwork, especially for school/team cycles.',
          ],
          relatedRoutes: ['/campaign-forecast', '/customer-reorders'],
        }
      ),
    ],
  },

  {
    id: 'data-admin',
    title: 'Product Data, Mapping, Integrity, and Administrative Repair',
    description: 'How to keep product identity clean and repair problems without creating new inconsistencies.',
    sections: [
      section(
        'woo-sync',
        'WooCommerce Sync',
        'WooCommerce Sync keeps the application aware of products, variations, attributes, SKUs, and related catalog information.',
        {
          useWhen: [
            'Creating or changing WooCommerce products/variations.',
            'Adding colors or sizes.',
            'Updating SKUs or product attributes.',
            'Diagnosing a product that is visible in WooCommerce but missing from app tools.',
          ],
          scenario:
            'You add Yellow as a WooCommerce color variation but the new variation is missing from Add Item to Bin. Run/verify WooCommerce Sync, then inspect the variation attributes and Product Data Health before creating anything manually.',
          steps: [
            'Confirm the WooCommerce product/variation is published and saved.',
            'Run the sync or wait for the configured automatic sync.',
            'Verify Brand, Style, Color, Size, SKU, and variation ID are present in the app mirror.',
            'If one attribute is missing, fix the Woo source or attribute mapping and sync again.',
            'Use Deployment Health if the sync request itself fails.',
          ],
          relatedRoutes: ['/woo-sync', '/deployment-health'],
        }
      ),
      section(
        'product-to-blank',
        'Product-to-Blank Mappings',
        'Mappings connect a customer-facing product variation to the exact physical blank used to make it.',
        {
          scenario:
            'A Woo hoodie variation is displayed as “Club Hoodie / Black / Large,” but physically you manufacture it with Independent Trading IND4000 Black Large. Create the mapping to that exact blank so pull sheets and purchasing know what to use.',
          steps: [
            'Identify the exact Woo variation/SKU.',
            'Identify the exact blank Brand + Style + Color + Size.',
            'Create/repair the mapping.',
            'Verify future pull-sheet demand resolves to the same blank.',
            'If a style is discontinued, use the supported replacement/substitution mapping workflow instead of silently changing historic product identity.',
          ],
          warnings: ['Do not map parent/aggregate Woo products to a physical blank when the actual size/color exists only at the variation level.'],
          relatedRoutes: ['/product-blank-mappings', '/mapping-repair'],
        }
      ),
      section(
        'mapping-repair',
        'Mapping Repair and Bulk Pairing Repair',
        'Repair tools are used when existing orders/jobs point to the wrong blank or when source records are incomplete/ambiguous.',
        {
          scenario:
            'Several open pull sheets for the same Woo variation all point to the wrong black tee. Fix the durable product-to-blank mapping, then use Bulk Pairing Repair for affected open job lines so reservations and purchasing reflect the corrected blank.',
          steps: [
            'Determine whether the problem is one job line or a durable Woo variation mapping.',
            'Correct the durable mapping first when future orders would otherwise repeat the problem.',
            'Use Bulk Pairing Repair for already-created affected job items when appropriate.',
            'Review reservations and Purchasing afterward.',
            'Confirm old wrong demand no longer remains as a sourceless or duplicate purchasing item.',
          ],
          relatedRoutes: ['/mapping-repair', '/bulk-pairing-repair', '/purchasing'],
        }
      ),
      section(
        'color-product-type',
        'Color Pairings, Product Color Manager, and Product Type Manager',
        'These tools normalize catalog identity so supplier data, WooCommerce, and inventory all describe products consistently.',
        {
          scenario:
            'A manufacturer calls a color “Sport Dark Navy,” WooCommerce calls it “Navy,” and an import feed uses “Dark Navy.” Use Color Pairings to establish an intentional canonical relationship rather than creating three separate blank colors.',
          steps: [
            'Use Color Pairings for supplier/manufacturer aliases to the canonical color used by the application/Woo catalog.',
            'Use Product Color Manager when adding/replacing WooCommerce color variations while preserving product/mapping integrity.',
            'Use Product Type Manager to classify Brand + Style combinations such as Tee, Hoodie, Sweatshirt, Bag, Drinkware, Jersey, or other business-specific types.',
            'Verify On-site Sales and Mockup Studio after product-type or color changes because those screens use these classifications.',
          ],
          relatedRoutes: ['/color-pairings', '/product-color-replacement', '/product-type-manager'],
        }
      ),
      section(
        'non-inventory-rules',
        'Non-Inventory Rules',
        'Non-Inventory Rules prevent fees, services, customer-supplied items, and similar lines from creating blank purchasing demand.',
        {
          scenario:
            'A manual order contains a $35 rush fee. Without a non-inventory rule, the application might treat that line as something to source. Mark it using the appropriate non-inventory rule so the job can close without a fake blank shortage.',
          steps: [
            'Identify recurring line types that should never consume blank inventory.',
            'Create or activate a precise rule.',
            'Verify the affected pull-sheet/purchasing line is excluded.',
            'Avoid overly broad rules that could accidentally exclude a real product.',
          ],
          relatedRoutes: ['/non-inventory-rules', '/purchasing'],
        }
      ),
      section(
        'integrity-centers',
        'Product Data Health, Product Integrity, and Operations Integrity',
        'These tools diagnose different classes of data problems and should usually be used before direct SQL/database edits.',
        {
          scenario:
            'A pull sheet cannot match a blank and you suspect duplicate products. Start with Product Data Health for missing attributes, Product Integrity for duplicate identity/SKU conflicts, and Operations Integrity for cross-workflow reconciliation before editing database rows manually.',
          steps: [
            'Product Data Health: missing costs, barcodes, supplier data, images, attributes, or mappings.',
            'Product Integrity: duplicate/conflicting product identities, SKUs, barcodes, or canonical attributes.',
            'Operations Integrity: workflow-level reconciliation across receiving, jobs, mappings, and operational records.',
            'Use Audit Trail to understand who/what changed a record.',
          ],
          relatedRoutes: ['/product-data-health', '/product-integrity', '/operations-integrity', '/audit-trail'],
        }
      ),
      section(
        'health-pages',
        'Deployment Health and Asset Storage Health',
        'Health pages separate infrastructure failures from business-data problems.',
        {
          scenario:
            'On-site Sales suddenly reports an invalid JSON response from WooCommerce. Before editing product data, check Deployment Health and the Woo connectivity result. If the host returned a CAPTCHA/HTML response, solve the hosting/security-layer issue.',
          steps: [
            'Use Deployment Health after deployments and when Woo/API/database functions appear unavailable.',
            'Use Asset Storage Health when R2/Supabase artwork files fail to load, upload, or migrate.',
            'Record the exact failing dependency before making changes.',
          ],
          relatedRoutes: ['/deployment-health', '/asset-storage-health'],
        }
      ),
    ],
  },

  {
    id: 'woocommerce-plugins',
    title: 'Custom WordPress and WooCommerce Plugins',
    description: 'Operational instructions for the custom plugins that connect the storefront, product catalog, documents, artwork, and inventory application.',
    sections: [
      section(
        'plugin-sku-builder',
        'SKU Builder',
        'SKU Builder creates consistent identifiers from the product attributes needed by the inventory application and WooCommerce integrations.',
        {
          scenario:
            'You create a new hoodie product with Brand, Style, Color, and Size variations. Use the SKU workflow to ensure each variation has a stable, unique SKU that includes the identity required for synchronization and matching.',
          steps: [
            'Create/save the WooCommerce product and required global attributes.',
            'Create the intended variations.',
            'Run the SKU Builder after the variation structure is correct.',
            'Verify SKUs are unique and contain the expected Brand/Style/Color/Size components and variation-specific suffix when configured.',
            'Sync the product to Supabase/inventory after SKU generation.',
          ],
          warnings: ['Changing SKUs after orders/mappings exist can break durable relationships. Treat SKU changes as data migrations, not cosmetic edits.'],
        }
      ),
      section(
        'plugin-woo-supabase',
        'WooCommerce ↔ Supabase Sync Plugin',
        'The sync plugin mirrors product/variation data into Supabase and supports controlled stock/integration actions used by the inventory application.',
        {
          scenario:
            'A product color is added in WooCommerce. After saving, verify the sync mirrors the new variation and normalized attributes. If bulk sync times out, use the smaller supported batch process rather than repeatedly starting a large request.',
          steps: [
            'Save product/variation changes in WooCommerce.',
            'Allow automatic sync or run the bulk/admin sync tool when needed.',
            'Verify normalized Brand, Style, Color, Size, SKU, price, and variation identity in the app.',
            'Use the configured inventory-to-Woo stock endpoint only for the workflows designed to call it.',
            'If Woo REST requests receive CAPTCHA/HTML instead of JSON, check SiteGround/hosting security rules and the REST API path before changing plugin code.',
          ],
          tips: ['The Woo REST path used by the integrations should be allowed through host-level anti-bot/security transforms.'],
        }
      ),
      section(
        'plugin-artwork-system',
        'Artwork System Plugin',
        'The Artwork System plugin handles customer artwork intake, mockups, review links, approvals, reorders/vault behavior, and handoff into operations.',
        {
          scenario:
            'A customer submits a new team-logo request. Review the submission, create/upload mockups, send the private review link, process changes, record approval, and then hand the approved project into the inventory/production workflow.',
          steps: [
            'Review the incoming request and attached files.',
            'Prepare design/mockup assets.',
            'Upload mockups and create the customer review path.',
            'Record requested changes and final approval.',
            'Use approved artwork for future reorders/vault access when appropriate.',
            'Send an operational handoff only when the production team has enough information to act.',
          ],
        }
      ),
      section(
        'plugin-product-options',
        'SC Product Options',
        'SC Product Options is the custom replacement for WooCommerce Product Add-Ons. It controls product-specific option fields, customer inputs, option pricing, and the order metadata that production must later understand.',
        {
          scenario:
            'A team hoodie needs optional player name and number fields plus a paid sleeve print. Configure the option group once, assign it to the correct Woo product(s), verify the fields render exactly once on the product page, verify pricing affects the cart correctly, and confirm the submitted values appear in cart/order metadata for production.',
          steps: [
            'Create/edit the option group in the plugin administration screen.',
            'Add fields such as text, select, checkbox, radio, or other supported input types.',
            'Set required/optional behavior and any price adjustment.',
            'Assign the group only to the intended products/categories.',
            'Test the product page outside the editor and inside the Divi-based storefront template.',
            'Add a test item to cart and verify option values and price changes appear once.',
            'Place a test order and verify order-item metadata is preserved for packing/production.',
            'When migrating legacy Product Add-Ons configuration, keep a backup/export until every critical product has been verified.',
          ],
          warnings: [
            'If fields appear twice, investigate duplicate rendering hooks, duplicate shortcode/template insertion, or legacy Product Add-Ons still rendering before changing saved option data.',
            'If the Divi product page shows a duplicated cart/summary area, verify whether the duplication is coming from Woo hooks/plugin output rather than assuming the Divi layout contains two modules.',
          ],
        }
      ),
      section(
        'plugin-documents',
        'Skilled Crafting WooCommerce Documents Plugin',
        'The custom documents plugin replaces third-party invoice/packing-slip functionality for one-page invoices, 4×6 packing slips, and production-oriented documents.',
        {
          scenario:
            'A web order is ready to ship. Print a compact 4×6 packing slip that prioritizes customer/order identity and product lines without wasting vertical space. For bookkeeping/customer records, generate the one-page invoice. For the shop floor, generate the production document with the details staff need to make the item.',
          steps: [
            'Open the WooCommerce order.',
            'Choose Invoice, Packing Slip, or Production Document.',
            'Use packing-slip layout options optimized for 4×6 label printing.',
            'Use invoice options that preserve financial detail and readable one-page structure.',
            'Use production-document fields for manufacturing details rather than customer-facing accounting detail.',
            'Print a test after plugin/theme updates to verify headers, tables, page sizing, and browser print margins.',
          ],
          warnings: [
            'A blank print window usually indicates a fatal/rendering/output problem, not simply a printer issue. Check WordPress/PHP logs and the plugin document endpoint.',
            'Avoid using a wide desktop table layout on a 4×6 label; prefer stacked/compact line-item formats.',
          ],
        }
      ),
      section(
        'plugin-pullsheet-webhooks',
        'Pull Sheet and Manual-Order Integration',
        'Webhook and REST integration moves Woo/manual-order data into the inventory application so production can act on it.',
        {
          scenario:
            'A manual pull sheet is generated for a selected Woo order. The integration authenticates the request, creates/updates the job and lines, then maps each line to the correct blank. Any line that cannot map should be visible for repair rather than silently discarded.',
          steps: [
            'Confirm the source order is correct.',
            'Trigger the supported manual or automatic pull-sheet workflow.',
            'Verify the webhook/REST request succeeds.',
            'Review the created job/pull sheet in the inventory app.',
            'Resolve unmatched/non-inventory lines before purchasing or production.',
          ],
        }
      ),
      section(
        'plugin-safe-operations',
        'Safe Plugin Update and Test Routine',
        'Every custom plugin update should be tested through the business workflow it affects.',
        {
          steps: [
            'Back up/export plugin settings before a migration that changes stored configuration.',
            'Install the new plugin build in WordPress.',
            'Clear relevant caches.',
            'Test the plugin administration screen.',
            'Test one simple product/order scenario.',
            'Test one product/order scenario with pricing or multiple options.',
            'Verify WooCommerce cart/order metadata.',
            'Verify the inventory application still receives the information it depends on.',
            'Print or generate documents where the update touches documents.',
            'Keep the previous working ZIP available until the new build passes.',
          ],
        }
      ),
    ],
  },

  {
    id: 'troubleshooting',
    title: 'Troubleshooting by Symptom',
    description: 'Start with the visible symptom, then follow the shortest path to the underlying cause.',
    sections: [
      section(
        'wrong-pullsheet',
        'Pull sheet shows the wrong blank',
        'Most wrong-blank problems are mapping problems, not inventory problems.',
        {
          steps: [
            'Open the pull sheet and identify the Woo/source variation.',
            'Confirm the blank currently paired to the line.',
            'Use Override Blank Pairing if this single line needs correction.',
            'Update Product-to-Blank Mappings if future orders need the same correction.',
            'Use Bulk Pairing Repair if already-created open lines share the same wrong pairing.',
            'Review reservations and Purchasing after repair.',
          ],
        }
      ),
      section(
        'inventory-wrong',
        'Inventory quantity looks wrong',
        'Do not immediately overwrite the quantity. Reconstruct what happened.',
        {
          steps: [
            'Physically recount the bin.',
            'Review Inventory Audit and Audit Trail.',
            'Check recent receiving, transfers, production completions, spoilage, and returns.',
            'Check for duplicate blank products with the same identity.',
            'Apply a verified audit adjustment only after the discrepancy is understood as well as practical.',
          ],
        }
      ),
      section(
        'purchasing-wrong',
        'Purchasing suggests the wrong product or quantity',
        'Purchasing is usually reflecting upstream demand, reservations, mappings, or non-inventory classification.',
        {
          steps: [
            'Open the source pull sheet/job.',
            'Confirm the blank pairing.',
            'Confirm the reservation quantity.',
            'Confirm the line is a real inventory item.',
            'Check for duplicate/sourceless suggested demand.',
            'Repair the pairing or non-inventory rule, then refresh Purchasing before ordering.',
          ],
        }
      ),
      section(
        'supplier-timeout',
        'Supplier receiving times out or returns 504',
        'A client timeout does not prove the backend operation failed.',
        {
          steps: [
            'Do not immediately submit the same receipt again.',
            'Refresh the relevant inventory/receiving history.',
            'Check whether inventory movements were created.',
            'Check whether the supplier order shows received quantities.',
            'Retry only the units that truly remain unreceived.',
          ],
        }
      ),
      section(
        'woo-invalid-json',
        'WooCommerce returns invalid JSON, HTTP 202, or a CAPTCHA page',
        'This usually means a host/security layer transformed the REST response.',
        {
          steps: [
            'Use Deployment Health or direct REST diagnostics to confirm the endpoint result.',
            'Check whether the body is HTML rather than JSON.',
            'Verify the Woo REST API path is exempt from anti-bot/CAPTCHA transformations.',
            'If using SiteGround, request/maintain the necessary exception for the API path used by the integration.',
            'Retest before changing product-data code.',
          ],
        }
      ),
      section(
        'artwork-missing',
        'Artwork or mockups do not appear',
        'Determine whether the metadata record exists and whether the underlying file can be retrieved.',
        {
          steps: [
            'Open Asset Storage Health.',
            'Confirm R2/Supabase configuration.',
            'Confirm the project/request metadata references an object.',
            'Confirm the object exists and the signed/authorized retrieval path works.',
            'If importing external artwork, confirm the source host is allowed and the import completed.',
            'Do not manually invent database paths to missing objects.',
          ],
        }
      ),
      section(
        'duplicate-products',
        'Duplicate or conflicting products',
        'Duplicate identity can cause mapping ambiguity and incorrect inventory/purchasing behavior.',
        {
          steps: [
            'Open Product Integrity.',
            'Search for duplicate Brand + Style + Color + Size, SKU, or barcode.',
            'Determine which record is canonical based on mappings, inventory movements, and usage.',
            'Use guarded repair/merge processes when available.',
            'Re-run Product Integrity and affected mappings afterward.',
          ],
        }
      ),
      section(
        'print-failure',
        'Invoice, packing slip, production document, or label fails to print',
        'Separate document-generation failure from browser/printer formatting problems.',
        {
          steps: [
            'Determine whether the document opens at all.',
            'If blank, check WordPress/PHP/plugin errors and document endpoint output.',
            'If content appears but formatting is wrong, use the document layout controls and browser print preview.',
            'For 4×6 labels, confirm printer paper size, scale, margins, and orientation.',
            'For repeated blank/footer-only thermal labels, reload/reset the print content between jobs and verify the plugin/app is replacing rather than appending stale markup.',
          ],
        }
      ),
    ],
  },

  {
    id: 'playbooks',
    title: 'Business Playbooks',
    description: 'End-to-end scenarios showing how multiple features work together in real Skilled Crafting workflows.',
    sections: [
      section(
        'playbook-web-order',
        'Playbook: WooCommerce order to completed production',
        'Use this for a normal online customer order.',
        {
          steps: [
            'Customer places the WooCommerce order.',
            'Verify the order syncs/creates the operational job and pull sheet.',
            'Review each blank pairing.',
            'Confirm inventory reservations and Pending Stock.',
            'Use Purchasing for real shortages.',
            'Receive shortages into real bins when they arrive.',
            'Confirm artwork is approved.',
            'Pull blanks from the listed bins.',
            'Move the job into production.',
            'Record spoilage if required.',
            'Complete QC/photo proof.',
            'Use Complete + Deduct for consumed blanks.',
            'Mark the job ready/completed and fulfill the customer order.',
          ],
        }
      ),
      section(
        'playbook-manual-order',
        'Playbook: Email/QuickBooks order to production',
        'Use this when the sale is not created in WooCommerce.',
        {
          steps: [
            'Create/send the customer invoice in QuickBooks or your normal invoicing process.',
            'Create the Manual Invoiced Order in the app.',
            'Enter one line per physical product variation.',
            'Mark fees/services as non-inventory.',
            'Generate the job and reservations.',
            'Review the pull sheet and Purchasing.',
            'Receive/order shortages.',
            'Produce, QC, and complete exactly like a WooCommerce job.',
          ],
        }
      ),
      section(
        'playbook-new-product',
        'Playbook: Add a new blank product family',
        'Use this before launching a new garment line.',
        {
          steps: [
            'Identify brand, style, product type, colors, sizes, supplier SKUs, and cost.',
            'Create the blank matrix in New Product Line Setup.',
            'Verify Product Data Health.',
            'Create/configure WooCommerce product and variations.',
            'Generate/verify SKUs.',
            'Run WooCommerce Sync.',
            'Create Product-to-Blank Mappings.',
            'Test one WooCommerce variation through a test pull sheet before accepting real orders.',
          ],
        }
      ),
      section(
        'playbook-artwork-product',
        'Playbook: Artwork request to WooCommerce product',
        'Use this when a customer’s new design must become a sellable product.',
        {
          steps: [
            'Review Artwork Request and source files.',
            'Create the Mockup Studio project.',
            'Import/upload blank photos and artwork into R2-backed project storage.',
            'Create placements and production dimensions.',
            'Generate/review mockups.',
            'Get customer approval.',
            'Configure product options where personalization or add-on pricing is required.',
            'Create/update the WooCommerce product.',
            'Generate/verify SKUs and variations.',
            'Run Woo Sync and create blank mappings.',
            'Place a test order and verify the pull sheet, product options, and production details.',
          ],
        }
      ),
      section(
        'playbook-onsite',
        'Playbook: Prepare and run an on-site sales event',
        'Use this before an event where customers select and decorate products on location.',
        {
          steps: [
            'Confirm the correct WooCommerce category and products.',
            'Verify product types, color pairings, blank mappings, and on-hand inventory.',
            'Verify artwork/logo choices.',
            'Enable Test Mode and run sample transactions.',
            'Verify device layout on the actual phone/tablet/laptop.',
            'Print several sequential test labels.',
            'Disable Test Mode for live sales.',
            'For each sale, confirm product, size, artwork, and personalization before production.',
            'At event close, reconcile remaining blanks, completed sales, spoilage, and any purchasing demand.',
          ],
        }
      ),
      section(
        'playbook-audit',
        'Playbook: Warehouse audit',
        'Use this for a structured physical count.',
        {
          steps: [
            'Choose a count window and reduce unnecessary inventory movement during the count.',
            'Generate/print the Warehouse Audit report with per-bin pages if desired.',
            'Count one bin at a time.',
            'Record discrepancies without immediately guessing the cause.',
            'Review recent movements for large variances.',
            'Apply verified adjustments.',
            'Export/store the audit result and review recurring variance patterns.',
          ],
        }
      ),
    ],
  },

  {
    id: 'training-maintenance',
    title: 'Training, Safety Rules, and Guide Maintenance',
    description: 'How to train new users and keep the guide aligned with the application.',
    sections: [
      section(
        '30-day-plan',
        '30-Day Learning Plan',
        'A staged learning plan avoids overwhelming a new owner or manager.',
        {
          steps: [
            'Days 1–3: System overview, Inventory Overview, bins, receiving, and scanning.',
            'Days 4–7: Woo/manual orders, pull sheets, reservations, and Pending Stock.',
            'Week 2: Purchasing, purchase orders, Waiting On, supplier receiving, and mapping repair.',
            'Week 3: Production Board, Shop TV, completion/deduction, QC, spoilage, photo proof, finished inventory.',
            'Week 4: Artwork Requests, Mockup Studio, R2, customer approvals, costing, forecasting, Product Integrity, and deployment health.',
          ],
          tips: ['Best training exercise: run one test order end-to-end—from receiving a blank through job creation, pull sheet, reservation, production, QC, and final completion.'],
        }
      ),
      section(
        'safety-rules',
        'Operational safety rules',
        'These rules protect inventory accuracy and preserve traceability.',
        {
          steps: [
            'Do not directly edit database rows when an application workflow exists.',
            'Do not receive stock into Pending Stock.',
            'Do not fix wrong mappings by changing inventory quantities.',
            'Do not delete reservations simply to make availability positive.',
            'Do not mark goods received when they have not physically arrived.',
            'Do not delete cloud artwork objects outside the application when project metadata still references them.',
            'Do not bulk-edit Brand/Style/Color/Size without checking duplicate-product risk.',
            'Do not treat a successful browser request as proof that a business workflow succeeded; verify the resulting records.',
            'Do not retry timed-out receiving actions until you verify whether the first attempt actually completed.',
          ],
        }
      ),
      section(
        'guide-maintenance',
        'Maintaining this guide',
        'The guide should evolve with the application rather than becoming a historical PDF.',
        {
          steps: [
            'Update the relevant guide section whenever a workflow changes materially.',
            'Add a business scenario for every new feature that changes how staff should work.',
            'Update troubleshooting when a recurring failure mode is discovered.',
            'Keep the application-screen reference synchronized with navigationConfig.',
            'Update the guide version with the application release that changes documentation.',
            'Keep the old PDF as historical reference, but use this page as the current operating source of truth.',
          ],
        }
      ),
    ],
  },
];

export const guideSearchText = (chapter, sectionItem) => {
  const values = [
    chapter.title,
    chapter.description,
    sectionItem.title,
    sectionItem.summary,
    sectionItem.scenario,
    ...(sectionItem.useWhen || []),
    ...(sectionItem.steps || []),
    ...(sectionItem.tips || []),
    ...(sectionItem.warnings || []),
    ...(sectionItem.relatedRoutes || []),
  ];
  return values.filter(Boolean).join(' ').toLowerCase();
};
