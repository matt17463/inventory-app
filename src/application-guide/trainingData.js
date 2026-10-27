import {wordpressAuditTutorials} from './wordpressAuditTraining.js';
import {recentModernizationTutorials} from './recentModernizationTraining.js';
import {certificationTutorial} from './certificationOperations.js';
export const TRAINING_VERSION = '1.8.0';

export const trainingRoles = [
  { id:'marketing',label:'Marketing / Business Development',description:'Client relationships, prospect pipeline, outreach materials, samples, demos, client-specific pricing and design/operations handoffs.' },
  { id: 'new-employee', label: 'New Employee', description: 'Start here. Learn the daily workflow, safety rules, receiving, pull sheets, and how to avoid inventory mistakes.' },
  { id: 'warehouse', label: 'Receiving / Warehouse', description: 'Receiving, bins, scanning, transfers, audits, supplier deliveries, and physical inventory accuracy.' },
  { id: 'production', label: 'Production', description: 'Pull sheets, reservations, production sequencing, deductions, spoilage, QC, and finished goods.' },
  { id: 'artwork', label: 'Artwork / Customer Admin', description: 'Client orders, artwork requests, Mockup Studio, approvals, order details, and customer-facing handoffs.' },
  { id: 'manager', label: 'Manager', description: 'Daily command center, order risk, purchasing, production coordination, exception handling, and deadlines.' },
  { id: 'owner-admin', label: 'Owner / Admin', description: 'Full-system operations, product mapping, integrations, pricing, health tools, troubleshooting, and deployment.' },
];

const step = (title, instruction, options = {}) => ({ title, instruction, ...options });

export const trainingTutorials = [
  certificationTutorial,
  {
    id:'marketing-research-brochure-artwork',title:'Marketing: Prospect Research, Brochures & Client Artwork',
    roles:['marketing','manager','owner-admin','artwork'],level:'Required',minutes:35,safeMode:'simulated-supported',
    summary:'Practice source review, ethical contact research, lead scoring, CRM follow-ups, sector brochures, artwork versioning and client proof approvals.',
    outcome:'The employee can move from a researched organization to a verified source, editable outreach, branded presentation and manager-approved review without making live inventory changes.',
    steps:[
      step('Open AI Prospects','Open Marketing → AI Prospects. Enter soccer clubs in Kitsap County with a product-fit criterion. Web research may use an AI service even in training mode, so only run research when permitted.',{route:'/marketing',verify:'You understand that external search suggestions and provisional fit scores are not confirmed customer facts.'}),
      step('Audit source-backed results','Open each proposed organization website. Verify its name, location, and fit. Explain why guessed names, emails, purchasing intent and unverifiable leads must not be treated as facts.',{route:'/marketing',verify:'You can distinguish a source URL from independently verified evidence.'}),
      step('Review fit scores','Open How this fit score was estimated. Identify territory, category, program and supplier-independent relevance criteria.',{route:'/marketing',verify:'A high fit score never means the organization wants to buy.'}),
      step('Practice saving a CRM prospect','Use the Save prospect to CRM action while test mode is active and confirm the simulated-write message. Review the Clients tab for potential duplicates.',{route:'/marketing',verify:'Training mode did not add customer data.'}),
      step('Plan a follow-up','Choose a due date and inspect the Schedule CRM follow-up workflow. Explain why contact permission and the public business channel must be verified.',{route:'/marketing',verify:'A follow-up is an internal task, not an automatically sent email.'}),
      step('Write an outreach draft','Choose Draft outreach, then edit it to remove any unsupported claims, named contacts, urgency, or unverifiable specifics. Copying the draft does not send it.',{route:'/marketing',verify:'You would obtain approval and check do-not-contact preferences before delivery.'}),
      step('Prepare a sector brochure','Open Brochures, choose a training organization, school, club or nonprofit template. Select product categories and proofread the call to action. Export a printable HTML proof.',{route:'/marketing',verify:'Products and lead times remain subject to verification; concept proofs are not orders.'}),
      step('Store exact artwork','Open Document Studio, upload a permitted logo and build a draft. Explain private R2 artwork versions and the difference between on-screen RGB/estimated CMYK and production proofs.',{route:'/marketing',verify:'Client-owned artwork is preserved and approval/usage rights are checked before publication.'}),
      step('Review garment photography','Open Mockup Studio to choose a licensed real product photograph and upload the exact artwork. Check placement, proportions, color, and decoration method.',{route:'/mockup-studio',verify:'A flat overlay is not a substitute for a texture-aware approved production proof.'}),
      step('Manager and client approval','Review internally approved document versions, time-limited external review links and feedback. Explain that reviewing a concept cannot create an order or deduct stock.',{route:'/marketing',verify:'You can distinguish an internal manager approval from an external customer concept review.'}),
      step('Verify production handoff','Inspect the related campaign tasks and sample review. A manager approval creates a production review task—not an automatic job or blank deduction.',{route:'/marketing',verify:'No stock or WooCommerce orders are created by marketing proof review.'}),
    ],
  },
  {
    id:'marketing-client-growth-complete',title:'Marketing: Client Acquisition Through Launch',roles:['marketing','manager','owner-admin','artwork'],level:'Required',minutes:40,safeMode:'simulated-supported',
    summary:'Practice a complete client-development workflow using the Training Example School. Simulated actions do not write records, upload files, change access or create real handoffs.',
    outcome:'The partner can track a prospect, compare client pricing, prepare a complete brief and hand work to the next department.',
    steps:[
      step('Find the training client','Open the Training Example School opportunity. Identify the campaign owner, next action, follow-up date, pipeline value and weighted forecast.',{route:'/marketing',verify:'You can distinguish estimated retail sales from a probability-weighted forecast.'}),
      step('Review client defaults','Open Edit Client and inspect the client type, relationship owner, source, profit share and margin defaults. Try a different percentage and Save; confirm the training-preview message.',{route:'/marketing',verify:'Defaults are per client, and this practice save did not change live records.'}),
      step('Map the decision makers','Open Contacts. Identify the primary contact and outreach preference. Explain how a do-not-contact preference affects personalized email drafts.',{route:'/marketing',verify:'You can record the contact’s role and preference without sending outreach.'}),
      step('Record a follow-up','Open Activity. Review the introduction and try adding a follow-up task with an owner and due date. Confirm the simulated-write message.',{route:'/marketing',verify:'You know where the next action, task and relationship timeline are recorded.'}),
      step('Compare commercial models','Open Pricing and Edit Draft. Compare wholesale-retail, net-sales percentage and profit-share percentage. Adjust the client share and margin target; review client benefit and company profit.',{route:'/marketing',verify:'You can explain which percentage base is used and why company margin is calculated on retained sales.'}),
      step('Use approved proposal versions','Explain the manager approval action and below-target note. Download a practice pricing guide and confirm it excludes internal costs and company margin.',{route:'/marketing',verify:'Approved versions are immutable; later terms require a new version and approval.'}),
      step('Prepare outreach materials','Open Materials, choose the training contact and inspect the school introduction email. Copying a draft does not send it. Identify how to create a new approved revision.',{route:'/marketing',verify:'You can reuse approved content while preserving its version and contact preference.'}),
      step('Track samples and demos','Return to the opportunity and inspect Samples and the demo status. Explain which physical inventory screen records an actual sample movement.',{route:'/marketing',verify:'Marketing sample commitments and physical inventory are separate linked responsibilities.'}),
      step('Prepare the design handoff','Open Handoff. Identify the client brief, artwork request and Mockup Studio relationship. Try Prepare Design Handoff and confirm it is simulated.',{route:'/marketing',verify:'A live handoff creates or reuses linked drafts and never duplicates the customer on retry.'}),
      step('Review departmental readiness','Identify the design, catalog, storefront, purchasing, production, QC and shipping responsibilities. Explain the artwork, product mapping and checkout checks required before Live.',{route:'/marketing',verify:'Each task has an owner, date and status, with blockers visible to the next department.'}),
      step('Follow orders and repeat business','Explain automatic attribution by the exact published project product ID and the manual order-link option. Read the job status instead of creating a second production record.',{route:'/marketing',verify:'The same order continues through purchasing, production, QC and shipping.'}),
      step('Review reports and safe access','Open Reports and Follow-ups. Distinguish forecasts, promotional commitments and actual settlement. Explain the Marketing, operator and manager responsibilities.',{route:'/marketing',verify:'You can hand off the opportunity with complete context and understand your role’s limits.'}),
    ],
  },
  {
    id:'sync-recovery-catalog-cleanup', title:'Manager: Sync Recovery and Catalog Cleanup',
    roles:['manager','owner-admin'],level:'Required',minutes:15,safeMode:'read-only',
    summary:'Distinguish order failures, catalog imports, internal inventory history and genuine missing mappings.',
    outcome:'Recover the correct workflow without reopening completed work or creating duplicate inventory.',
    steps:[
      step('Review role access','Explain which actions belong to viewers, operators and managers. Do not change any account.',{route:'/catalog-workbench',readOnly:true,verify:'An active employee account is required; catalog repairs are manager actions.'}),
      step('Read sync health','Find the most recent successful order sync and inspect recent attempts without refreshing an order.',{route:'/woo-sync',readOnly:true,verify:'You can distinguish order-sync results from attribute-update timestamps.'}),
      step('Explain order recovery','Identify the WooCommerce order ID and the refresh action. Explain what remains preserved. Do not activate it.',{route:'/woo-sync',readOnly:true,verify:'Completed lines, production progress and existing pairings survive a refresh; changed quantities require review.'}),
      step('Review exact repair','Inspect cleanup results and explain why a unique brand/style/color/size match is required. Do not apply a repair.',{route:'/catalog-workbench',readOnly:true,verify:'Ambiguous records need review and physical quantities are preserved.'}),
      step('Read the complete health report','Filter an issue and use Next and Previous. Find optional barcode information.',{route:'/product-data-health',readOnly:true,verify:'Totals cover all results; barcode and cost checks use physical blank records.'}),
    ],
  },
  {
    id:'current-shop-workflows', title:'Current Workflows: Returns, Purchasing, Catalog & Equipment',
    roles:['new-employee','warehouse','production','artwork','manager','owner-admin'], level:'Core', minutes:25, safeMode:'read-only',
    summary:'Find updated workflows and explain the correct action before changing live data.',
    outcome:'Record a finished extra correctly, distinguish cancellation from deletion, and choose the right display and repair tool.',
    steps:[
      step('Navigate compact groups', 'Expand a group and find a tool with top-bar search. Review Menu Manager.', {route:'/menu-manager', verify:'You can explain how custom groups appear in the collapsible sidebar.', readOnly:true}),
      step('Inspect finished receiving', 'Find an existing finished product and identify the bin and reason. Explain why a return does not deduct another blank. Do not submit.', {route:'/finished/create', verify:'You can identify global and product-specific logo choices.', readOnly:true}),
      step('Review a supplier PO', 'Locate cancellation and deletion actions without activating them.', {route:'/purchase-orders', verify:'You can distinguish stopping outstanding demand from reversing inventory or notifying a supplier.', readOnly:true}),
      step('Inspect active production', 'Review the display and explain why completed jobs are absent from overdue lanes.', {route:'/shop-tv', verify:'You can locate active work and its due-date bucket.', readOnly:true}),
      step('Review equipment monitoring', 'Review TV and Touch views and connection status. Do not operate equipment.', {route:'/shop-equipment', verify:'You can distinguish a setup record from live data and find remote access.', readOnly:true}),
      step('Choose the repair tool', 'Follow Catalog Workbench from diagnostics to definitions, mappings and operations verification. Do not apply repairs.', {route:'/catalog-workbench', verify:'You can explain the different purposes of color, mapping and bulk-pairing tools.', readOnly:true}),
      step('Check themes', 'Compare Midnight Industrial, Copper Foundry and Evergreen Workshop in light and dark mode.', {route:'/theme-settings', verify:'You can choose a readable palette for the target screen.', readOnly:true}),
      step('Review contractor hours', 'Identify where contractors enter time and managers review reports. Do not submit or approve time.', {route:'/contractor-hours', verify:'You know where to record work and who approves it.', readOnly:true}),
    ],
  },
  {
    id: 'orientation-101',
    title: 'Orientation: Learn the System Without Breaking Anything',
    roles: ['new-employee','warehouse','production','artwork','manager','owner-admin'],
    level: 'Required',
    minutes: 20,
    safeMode: 'read-only',
    summary: 'Learn the vocabulary, where work starts, where inventory truth lives, and which actions are safe to explore.',
    outcome: 'The employee can explain the difference between WooCommerce demand, blank inventory, reservations, jobs, pull sheets, bins, Pending Stock, and finished inventory.',
    steps: [
      step('Open the Application Guide', 'Open this guide and bookmark it. Search for a task before guessing how a workflow works.', { route: '/application-guide', verify: 'You can find the Inventory, Production, Purchasing, Artwork, and Training chapters.' }),
      step('Open the Daily Command Center', 'Look at the current operational summary. Do not change anything.', { route: '/command-center', verify: 'You can identify jobs at risk, shortages, and important exceptions.' }),
      step('Open Inventory Overview', 'Search for one common blank item and inspect On Hand, Reserved, Available, and bin information.', { route: '/inventory/blanks', verify: 'You can explain why Available may be lower than On Hand.' }),
      step('Open a Pull Sheet', 'Open an existing pull sheet in read-only fashion and identify the customer/order, blank item, quantity, bin, and status.', { route: '/pullsheets', verify: 'You can point out what must be physically pulled and what is only planning data.' }),
      step('Review the safety rules', 'Read the Safety Rules section in the guide before performing any inventory-changing action.', { route: '/application-guide#safety-rules', verify: 'You know not to receive into Pending Stock and not to fix mapping problems by changing quantity.' }),
    ],
    coachNotes: ['Do this tutorial with a manager on the employee’s first day.', 'The employee should be able to explain the workflow back in their own words before moving to receiving or production tasks.'],
  },
  {
    id: 'receiving-101',
    title: 'Receiving 101: Put Physical Inventory Into the Right Bin',
    roles: ['new-employee','warehouse','manager','owner-admin'],
    level: 'Core',
    minutes: 25,
    safeMode: 'supervised-live',
    summary: 'Practice the exact decision process used when supplier goods arrive.',
    outcome: 'The employee can receive an exact Brand + Style + Color + Size into the real physical bin and verify the result.',
    steps: [
      step('Before touching the app, count the shipment', 'Separate items by exact style, color, and size. Count the physical units first.', { verify: 'You have a physical quantity for each exact variation.' }),
      step('Open Add Item to Bin', 'Use manual receiving for a small shipment or local purchase.', { route: '/add-item', verify: 'You can identify destination bin, product, quantity, and notes fields.' }),
      step('Find the exact blank', 'Search by SKU or Brand + Style + Color + Size. Never choose a near match just to continue.', { warning: 'If the exact item cannot be found, stop and ask a manager before creating a new blank.' }),
      step('Choose the real destination bin', 'Select the bin where the garment will physically be stored.', { warning: 'Pending Stock is not a physical bin and must never be used for receiving.' }),
      step('Enter actual quantity received', 'Use what physically arrived, not what the supplier invoice says should have arrived.'),
      step('Complete receiving and put away immediately', 'Finish the receiving action, then place the goods in the selected bin.', { verify: 'Inventory Overview and Bin Contents show the new quantity in the same physical location.' }),
    ],
    coachNotes: ['First live receipt should be supervised.', 'Use a small 1–3 line receipt before allowing bulk supplier receiving.'],
  },
  {
    id: 'supplier-receiving-201',
    title: 'Supplier Receiving: Larger Orders and Partial Deliveries',
    roles: ['warehouse','manager','owner-admin'],
    level: 'Intermediate',
    minutes: 35,
    safeMode: 'supervised-live',
    summary: 'Receive supplier confirmation files safely, including mismatches and partial shipments.',
    outcome: 'The employee can distinguish matched, review, and unmatched supplier lines and avoid duplicate receiving.',
    steps: [
      step('Open supplier receiving', 'Open the supplier confirmation receiving workflow and upload a supported supplier document.', { route: '/add-item', verify: 'The parsed lines show product identity and quantities.' }),
      step('Review every warning row', 'Do not bulk-receive yellow/red or uncertain matches.', { warning: 'A similar color or style is not automatically the same product.' }),
      step('Correct product identity before quantity', 'Resolve Brand, Style, Color, Size, or supplier mapping issues first.' ),
      step('Enter actual received quantities', 'If only part of an order arrived, receive only the units in the box.' ),
      step('Verify after timeouts', 'If the browser times out, check inventory/receipt history before clicking Receive again.', { warning: 'Retrying a completed receipt can duplicate inventory.' }),
    ],
  },
  {
    id: 'pullsheet-101',
    title: 'Pull Sheet 101: Pull the Correct Blank and Protect Inventory',
    roles: ['new-employee','production','manager','owner-admin'],
    level: 'Core',
    minutes: 25,
    safeMode: 'read-only-first',
    summary: 'Learn how to read a pull sheet and what each production action means.',
    outcome: 'The employee can identify the exact blank, source bin, shortage state, and the difference between pulling, producing, and completing/deducting.',
    steps: [
      step('Open Pull Sheets', 'Choose a training order or an order assigned by a manager.', { route: '/pullsheets' }),
      step('Read the line before touching inventory', 'Confirm product/SKU, Brand, Style, Color, Size, quantity, and source bin.' ),
      step('Check for Pending Stock or shortage', 'If the line points to Pending Stock or shows insufficient availability, do not substitute another garment without approval.' ),
      step('Physically pull from the recorded bin', 'Match the garment label to the pull sheet before removing it.' ),
      step('Do not complete early', 'Complete + Deduct should happen only when the blank has actually been consumed for production.', { warning: 'Completing early makes inventory inaccurate and can create false purchasing demand.' }),
      step('Escalate wrong products', 'If the pull sheet requests the wrong blank, stop and use mapping repair or ask a manager. Do not compensate by changing inventory quantities.' ),
    ],
  },
  {
    id: 'production-201',
    title: 'Production 201: From Pulled Blank to QC and Completion',
    roles: ['production','manager','owner-admin'],
    level: 'Intermediate',
    minutes: 35,
    safeMode: 'supervised-live',
    summary: 'Follow the production sequence without losing traceability.',
    outcome: 'The employee can move a job through production, record spoilage, complete/deduct correctly, and use QC.',
    steps: [
      step('Review priority', 'Use Production Board and Order Risk to confirm which job should be worked next.', { route: '/production-board' }),
      step('Confirm artwork is ready', 'Verify approved artwork and production instructions before pressing anything.' ),
      step('Produce the item', 'Follow placement, decoration size, name/number, and artwork instructions exactly.' ),
      step('Record spoilage immediately', 'If a blank is ruined or misprinted, use Spoilage / Misprints instead of silently grabbing another blank.', { route: '/spoilage' }),
      step('Complete and deduct', 'Only after the blank has been used for the job, complete the line and deduct the inventory.' ),
      step('Perform QC', 'Use the QC Checklist and photo proof workflow where required.', { route: '/qc-checklist' }),
      step('Confirm final status', 'Verify the job/line no longer shows open production work and the inventory movement is correct.' ),
    ],
  },
  {
    id: 'purchasing-101',
    title: 'Purchasing 101: Understand What the Report Is Asking You to Buy',
    roles: ['manager','owner-admin'],
    level: 'Core',
    minutes: 30,
    safeMode: 'read-only-first',
    summary: 'Learn how reservations, on-hand stock, Pending Stock, and non-inventory rules affect purchasing.',
    outcome: 'The employee can explain why an item appears on the purchasing report before creating a purchase order.',
    steps: [
      step('Open Purchasing Report', 'Review shortage lines without ordering anything yet.', { route: '/purchasing' }),
      step('Trace the demand source', 'Identify which pull sheet/client/manual order created the need.' ),
      step('Check On Hand and Reserved', 'Confirm the shortage is real rather than caused by a wrong pairing or missing receipt.' ),
      step('Check non-inventory status', 'Fees, services, and customer-supplied items should not generate blank purchasing demand.' ),
      step('Create or update a PO only after validation', 'Order the exact Brand + Style + Color + Size required.' ),
      step('Use Waiting On after ordering', 'Track expected arrivals and late supplier items.', { route: '/waiting-on' }),
    ],
  },
  {
    id: 'client-orders-101',
    title: 'Client Orders 101: Review, Price, Approve, and Convert',
    roles: ['artwork','manager','owner-admin'],
    level: 'Core',
    minutes: 35,
    safeMode: 'simulated-supported',
    summary: 'Practice the online client/team order workflow from submission through production conversion.',
    outcome: 'The employee can map products, enter pricing, create a QBO handoff, record approval/payment, and understand when production demand is created.',
    steps: [
      step('Enable Testing Mode first', 'Turn on Testing Mode and Simulate Supported Writes before training on Client Orders.', { route: '/testing-mode', verify: 'The page reports Testing Mode: Simulated Writes.' }),
      step('Open Client Orders', 'Select a submitted client request and review the customer-entered personalization carefully.', { route: '/client-orders' }),
      step('Map each requested item', 'Choose the exact blank product. Do not use a near match simply because it is available.' ),
      step('Price every line', 'Enter the sell price or apply an approved pricing rule.' ),
      step('Review invoice details', 'Verify garment color, size, name on back, name text color, jersey/employee number, quantity, and line notes.' ),
      step('Practice quote/approval/payment gates', 'In simulated mode, walk through quote sent, customer approval, and payment steps.' ),
      step('Simulate conversion', 'Use Simulate Production Conversion and inspect the preview. Confirm that no production records were written.' ),
    ],
    coachNotes: ['This is the safest full workflow for a new admin employee because supported writes are simulated.', 'Do not assume other application pages are non-mutating just because Testing Mode is enabled.'],
  },
  {
    id: 'manual-orders-101',
    title: 'Manual Invoice Orders 101: Build an Order That Bypasses WooCommerce',
    roles: ['manager','owner-admin','artwork'],
    level: 'Intermediate',
    minutes: 35,
    safeMode: 'supervised-live',
    summary: 'Create and understand a manual invoiced order used for QuickBooks/email/phone orders.',
    outcome: 'The employee can enter a production-ready manual order and understand how it creates a job and inventory demand.',
    steps: [
      step('Open Manual Invoiced Orders', 'Review the customer header and line-item structure before creating anything.', { route: '/manual-orders' }),
      step('Enter customer and invoice reference', 'Use the real QuickBooks/external invoice number when available.' ),
      step('Add exact line items', 'Use one line per exact blank variation and preserve customer personalization in line details.' ),
      step('Verify client details', 'Confirm recipient, garment color, size, name/number, personalization color, placement, artwork note, and quantity.' ),
      step('Understand Generate Job', 'Generating the job creates operational production work and can create reservations/purchasing demand.', { warning: 'Do not generate a job for a test order on production unless explicitly directed.' }),
      step('Verify after creation', 'Open the generated pull sheet and confirm the item identity and quantities are correct.' ),
    ],
  },
  {
    id: 'artwork-101',
    title: 'Artwork 101: Requests, Mockups, Approval, and Production Handoff',
    roles: ['artwork','manager','owner-admin'],
    level: 'Core',
    minutes: 40,
    safeMode: 'read-only-first',
    summary: 'Understand where artwork comes from, how mockups are reviewed, and what “approved” means for production.',
    outcome: 'The employee can locate artwork, review a request, identify the selected/approved mockup, and avoid replacing a downstream production file incorrectly.',
    steps: [
      step('Open Artwork Requests', 'Review a real or training request and identify customer requirements and uploaded files.', { route: '/artwork-requests' }),
      step('Open Mockup Studio', 'Locate the related project and identify originals, prepared artwork, mockups, and production files.', { route: '/mockup-studio' }),
      step('Distinguish selected from approved', 'A selected mockup is not automatically production approved.' ),
      step('Protect downstream files', 'When a file is already referenced by production or a completed request, create a new version instead of replacing history.' ),
      step('Confirm production readiness', 'Before production starts, verify artwork, garment, placement, size, and customer approval.' ),
    ],
  },
  {
    id: 'inventory-audit-101',
    title: 'Inventory Audit 101: Fix Counts Without Hiding the Cause',
    roles: ['warehouse','manager','owner-admin'],
    level: 'Core',
    minutes: 25,
    safeMode: 'supervised-live',
    summary: 'Learn how to reconcile physical inventory while preserving an audit trail.',
    outcome: 'The employee can count a bin, research a variance, and apply a verified adjustment using the correct workflow.',
    steps: [
      step('Choose a small bin', 'Start with one bin and count every unit physically present.', { route: '/inventory-audit' }),
      step('Compare to expected', 'Record the physical count without first changing system quantities.' ),
      step('Investigate meaningful variances', 'Review recent receiving, transfers, production deductions, and spoilage.' ),
      step('Apply only a verified adjustment', 'Use the audit workflow so the difference creates an inventory movement record.' ),
      step('Look for process patterns', 'Repeated shortages in one bin/style usually indicate a workflow problem that should be corrected.' ),
    ],
  },
  {
    id: 'troubleshooting-101',
    title: 'Troubleshooting 101: Stop, Verify, Then Repair',
    roles: ['new-employee','warehouse','production','artwork','manager','owner-admin'],
    level: 'Required',
    minutes: 20,
    safeMode: 'read-only',
    summary: 'A standard response to wrong quantities, wrong products, missing records, timeouts, and unexpected errors.',
    outcome: 'The employee knows when to stop and gather evidence instead of clicking repeatedly or “fixing” data blindly.',
    steps: [
      step('Stop repeating the action', 'If an action errors or times out, do not click it several more times.' ),
      step('Write down the exact symptom', 'Capture the order/pull sheet/PO number, product SKU, quantity, error message, and time.' ),
      step('Verify the resulting state', 'Check the destination screen, inventory movement, order, job, or receipt to determine whether the first action actually completed.' ),
      step('Use the Exception / Integrity tools', 'Check Exception Center, Product Integrity, Operations Integrity, or Deployment Health as appropriate.', { route: '/exception-center' }),
      step('Escalate with evidence', 'Give the manager the exact record number and screenshot rather than only saying “it did not work.”' ),
    ],
  },
  {
    id: 'manager-opening-closing',
    title: 'Manager Daily Opening and Closing Routine',
    roles: ['manager','owner-admin'],
    level: 'Required',
    minutes: 20,
    safeMode: 'read-only',
    summary: 'A repeatable daily control routine for catching problems before they affect customer deadlines.',
    outcome: 'The manager can identify today’s highest-risk work and leave the system in a clean state at close.',
    steps: [
      step('Morning command check', 'Review Daily Command Center and Exception Center.', { route: '/command-center' }),
      step('Review due work', 'Check Order Risk, Production Board, and Pull Sheet Due Dates.' ),
      step('Review incoming stock', 'Check Waiting On and open Purchase Orders.' ),
      step('Assign priorities', 'Confirm which production jobs and receiving tasks staff should work first.' ),
      step('Closing check', 'Review unfinished jobs, unresolved exceptions, incomplete receiving, spoilage, and unusual inventory movements.' ),
    ],
  },
  {
    id: 'admin-advanced',
    title: 'Owner/Admin Advanced: Mapping, Integrity, and Deployment',
    roles: ['owner-admin'],
    level: 'Advanced',
    minutes: 45,
    safeMode: 'read-only-first',
    summary: 'Understand the high-impact tools that should not be delegated until core workflows are mastered.',
    outcome: 'The admin can identify when a problem belongs to product mapping, data integrity, Woo sync, environment health, or application deployment.',
    steps: [
      step('Review Product-to-Blank Mappings', 'Understand that mappings determine which physical blank a source product consumes.', { route: '/product-blank-mappings' }),
      step('Review Product Integrity', 'Use duplicate SKU/barcode/identity diagnostics before editing product identity.', { route: '/product-integrity' }),
      step('Review Operations Integrity', 'Use guarded repair tools for operational inconsistencies.', { route: '/operations-integrity' }),
      step('Review WooCommerce Sync', 'Know how products/variations flow from WooCommerce into operational data.', { route: '/woo-sync' }),
      step('Review Deployment Health', 'Check environment/configuration health before assuming a workflow bug is data-related.', { route: '/deployment-health' }),
      step('Know the change-control rule', 'High-impact repairs, migrations, or bulk changes should be tested, documented, and verified before production use.' ),
    ],
  },
];


// Conditional-state exercises cover real decision rules, but NOT live write actions.
// WordPress plugin exercises remain provisional pending authorized browser audit.
trainingTutorials.push(
 {
  id:'conditional-order-to-delivery-read-only',
  title:'Conditional Dialogs: Safe Production and Customer Handoffs',
  roles:['new-employee','production','warehouse','manager','owner-admin'],
  level:'Required',minutes:30,safeMode:'guided-read-only',
  summary:'Understand why a button may be hidden/disabled and the difference between a source reference, an approval and a completed handoff.',
  outcome:'A helper can identify when actual QC, exact packing, client proof or receipt is missing without attempting to bypass an official gate.',
  steps:[
   step('Open a job read-only','In Work Hub observe the next-action label and linked evidence. Do not use production write buttons as a practice exercise.',{route:'/work-hub',verify:'You can explain why a linked file is not necessarily approved artwork.'}),
   step('Review packing checks','Study each order line, ordered quantity, latest verified quantity and what happens if the number differs.',{route:'/work-hub',verify:'You can explain that bag notes do not deduct inventory.'}),
   step('Inspect pickup availability','Find the pickup section; state which passing QC, completed packing and receipt consent requirements must exist. Do not sign for anyone.',{route:'/work-hub',verify:'You can distinguish packed from actually collected by customer.'}),
   step('Inspect artwork revision review','Find handoff, revision label and actual client approval-reference fields. Do not mark live proofs approved.',{route:'/work-hub',verify:'You can identify the precise customer-approved file version.'}),
   step('Inspect delivery and message history','Explain why a label purchase, carrier dispatch, verified delivery and customer email are different events.',{route:'/work-hub',verify:'You can explain what a manual-send confirmation does NOT do.'}),
   step('Debrief a fictional defect','Describe how to handle one mislabeled hoodie, missing blank or rejected QC result without inventing stock movement.',{verify:'You would stop the handoff, document the exception, and use the authoritative workflow.'}),
  ],
 },
 {
  id:'conditional-carrier-purchase-read-only',
  title:'Conditional Dialogs: Shipping Labels and Duplicate-Postage Prevention',
  roles:['manager','owner-admin'],level:'Advanced',minutes:20,safeMode:'guided-read-only',
  summary:'Review EasyPost rate quotes versus an existing USPS Click-N-Ship purchase, including live-cost confirmation and uncertain purchase recovery.',
  outcome:'A manager understands why cost authorization, correct package number and carrier purchase outcome must be verified before shipping.',
  steps:[
   step('Review domestic parcel fields','Examine recipient identity, ship-to address, dimensions and package weight in ounces without requesting paid rates.',{route:'/work-hub',verify:'You know the first integration handles domestic parcels only.'}),
   step('Explain purchasing safeguards','Find test/live mode, quote expiry, exact USD purchase approval and max-cost rule. Do NOT buy a label.',{route:'/work-hub',verify:'A test label is not valid live postage.'}),
   step('Compare purchase channels','Explain how a label bought in USPS Click-N-Ship can be recorded without paying EasyPost again.',{verify:'Each physical numbered package has only one postage purchase.'}),
   step('Handle uncertain purchase','Practice explaining why a timeout must be reconciled with EasyPost instead of immediately buying again.',{verify:'You can identify the recovery operation and prohibited retry.'}),
  ],
 },
 {
  id:'wordpress-conditional-audit-training',
  title:'WordPress Client Storefronts: Conditional Settings and Approval Gates',
  roles:['marketing','manager','owner-admin'],level:'Advanced',minutes:25,safeMode:'guided-read-only',
  summary:'Understand draft versus published WordPress client stores and exactly when a client WooCommerce category is checked. Live WordPress plugin controls are pending audit.',
  outcome:'A helper can identify product-category isolation, draft approval gates and the different QuickBooks group-order path.',
  steps:[
   step('Identify store type','Distinguish recurring WordPress/WooCommerce storefront campaign from occasional QuickBooks invoice/group form.',{route:'/team-stores',verify:'You would never make a second Woo order for a QuickBooks group request.'}),
   step('Review template and brand colors','Locate theme, logo, headline, client-specific Woo category and delivery instructions. Do not publish a live test store.',{route:'/team-stores',verify:'Client merchandise is limited by its verified category, but product URLs are not necessarily private.'}),
   step('Review publication conditions','Explain client artwork approval, verified catalog and management permissions, and why an unpublished draft does not create checkout orders.',{verify:'You know publication is gated by WordPress and WooCommerce verification.'}),
   step('Review administrator/plugin settings safely','Only read authenticated WordPress admin plugin details in a browser under supervision. Do not change a setting to reveal a modal during training.',{verify:'Plugin version and active state must be actually inspected, not assumed from app source.'}),
   step('Review the final WordPress audit','Compare real verified fields and dialogs to the maintained plugin audit registry when the Work audit is returned.',{verify:'You distinguish source-reviewed from live-verified documentation.'}),
  ],
 }
);

// Six safe, audit-derived WordPress training modules; no live plugin writes.
trainingTutorials.push(...wordpressAuditTutorials());


trainingTutorials.push({
 id:'wp-commerce-integrity-operator-review',
 title:'Manager: WordPress Storefront, SKU and Shipping Integrity Preflight',
 roles:['manager','owner-admin'],level:'Advanced',minutes:30,safeMode:'guided-read-only',
 summary:'Practice recognizing dated audit findings versus live configuration, conflicting SKU writer candidates and overlapping Woo shipping rules without making production changes.',
 outcome:'A manager can plan a safe storefront plugin compatibility review, select a single SKU ownership path and design shipping staging fixtures.',
 steps:[
  step('Open the integrity review','Go to Tools & Admin → WordPress Commerce Integrity. Read the dated October 22 baseline before running any checks.',{
   route:'/wordpress-integrity',verify:'You can explain why a historic snapshot is not current-state proof.'}),
  step('Run safe read-only diagnostics','Select Run read-only checks. Distinguish live observed, partial and unavailable results. Do not try to fix a 403 by disabling WordPress security.',{
   route:'/wordpress-integrity',verify:'You can identify what was observed and what needs authorized manual WordPress review.'}),
  step('Compare storefront versions','Review the earlier 0.1.2 browser audit versus current repository 0.1.4. Recheck the live installed version. Explain why equal version labels do not by themselves establish matching deployed PHP behavior.',{
   route:'/wordpress-integrity',verify:'You would inspect/compare code with a backup on staging before updating.'}),
  step('Identify SKU writers','Review WC SKU Builder, Product SKU Generator and SKU Generator candidates. Do not regenerate or disable any plugin. Distinguish a sampled collision count from a complete catalog check.',{
   route:'/wordpress-integrity',verify:'You know SKU ownership, Woo product sync and blank-master relink must each be verified.'}),
  step('Design fictional shipping fixtures','For a fictional school-store cart compare $199.99, $200 and $200.01 with and without a coupon, local and out-of-zone addresses and mixed shipping classes. No checkout submission.',{
   route:'/wordpress-integrity',verify:'You know core shipping zones and Advanced Free Shipping extension may both affect offered rates.'}),
  step('Document pending actions for the owner','Review the three action checklists. Escalate any plugin mismatch, collisions or ambiguous shipping rates to a separate authorized nonproduction test.',{
   route:'/application-guide',verify:'You can identify the highest-risk action that must NOT be used as a training exercise.',
   warning:'Never save plugin settings, create paid orders, buy postage, rebuild SKUs, synchronize inventory or repair mappings during documentation training.'}),
 ]
});


trainingTutorials.push({
 id:'wp-commerce-confirmed-risks-owner-approval-20261022',
 title:'Owner: Approving WordPress Commerce Integrity Remediation',
 roles:['manager','owner-admin'],level:'Advanced',minutes:25,safeMode:'guided-read-only',
 summary:'Review audited 0.1.2/0.1.3 differences and current 0.1.4 candidate, enabled SKU save hooks, the owner-approved intentional coupon policy, and shipping policies. Complete no transactional actions in this exercise.',
 outcome:'The owner can distinguish a source-confirmed configuration risk from an observed customer incident and authorize staged remediation without changing live transactions.',
 steps:[
  step('Identify owner decisions','Review the approval pack in the Application Guide. List decisions for the published 100% coupon, normal shipping versus free organization distribution, Heavy fallback, SKU immutability and staging setup.',{
   route:'/wordpress-integrity',verify:'You can name what needs explicit owner approval before any production action.'}),
  step('Review the confidential coupon policy','In approved owner-only discussion, recognize that the owner confirmed the 100% discount plus free-shipping coupon is intentional. Do not disclose its code, apply it or change settings as a training step.',{
   verify:'You can explain that configured eligibility is not proof of actual misuse or customer checkout behavior.'}),
  step('Explain competing SKU routes','Review custom builder save hooks, SkyVerge AJAX hooks, the dormant WP Wham internal switch and Mockup Studio publisher scheme. Do not run a batch SKU rebuild.',{
   route:'/wordpress-integrity',verify:'You can explain why plugin activation does not prove actual SKU writer authority.'}),
  step('Explain the exact-$200 discrepancy','Compare Woo core >= $200 post-discount tax-exclusive subtotal to Advanced Free Shipping exact $200 pre-discount tax-inclusive subtotal.',{
   verify:'You can distinguish a configuration mismatch from confirmed incorrect shipping on a placed order.'}),
  step('Preserve intended free distribution','Identify intentional no-fee Spirit Wear/Uniform organization delivery versus ordinary carrier shipping and fallback Heavy class handling.',{
   verify:'You would not set all class costs to a guessed number or remove legitimate team distribution.'}),
  step('Evaluate testing isolation','Review the SiteGround staging plan; identify payment, email, Woo webhook, Supabase, app, cron and carrier connections requiring isolation before any fictional save.',{
   verify:'You can explain why a Netlify preview pointing at production Supabase cannot safely run integration tests.'}),
  step('Approve only scoped next actions','Choose approvals for staging or diagnostic-only code separately from live SKU, coupon, plugin update and shipping changes. Do not authorize production modifications by selecting a training answer.',{
   verify:'You can identify the exact owner approval and rollback required for each change.'}),
 ]
});

trainingTutorials.push(...recentModernizationTutorials);

export function tutorialsForRole(roleId) {
  return trainingTutorials.filter((tutorial) => tutorial.roles.includes(roleId));
}

export function trainingTutorialSearchText(tutorial) {
  return [
    tutorial.title,
    tutorial.level,
    tutorial.summary,
    tutorial.outcome,
    tutorial.safeMode,
    ...(tutorial.roles || []),
    ...(tutorial.coachNotes || []),
    ...(tutorial.steps || []).flatMap((item) => [item.title, item.instruction, item.verify, item.warning, item.route]),
  ].filter(Boolean).join(' ').toLowerCase();
}
