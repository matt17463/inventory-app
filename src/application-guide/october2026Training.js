// October 29, 2026 lessons. All practice is read-only or fictional unless a supervisor
// separately authorizes a live customer action.
const step=(title,instruction,options={})=>({title,instruction,...options});
export const october2026Tutorials=[
 {id:'oct2026-creative-suite',title:'Creative Operations: Choose a Workspace',roles:['new-employee','marketing','artwork','manager','owner-admin'],level:'Beginner',minutes:20,safeMode:'guided-read-only',summary:'Use the five workspaces without creating duplicate orders.',outcome:'Identify the right source record for a design, package, quote, order and production job.',steps:[
  step('Explore the suite','Open Creative Operations Suite and name each of its five tabs.',{route:'/creative-operations',verify:'You can identify Command Center, Artwork Engineer, Customer Design, Package Creator and Knowledge.'}),
  step('Inspect a draft package','Compare example costs for a coach gift and a wedding set without saving real prices.',{route:'/creative-operations',verify:'You can explain why setup is separate from per-unit cost.'}),
  step('Trace the order path','Follow the navigation to Quote Builder, Client Orders, Woo stores and Work Hub.',{verify:'You know one-time and recurring store orders take different routes.'}),
  step('Locate blockers','In a fictional example, identify missing customer approval, exact blank and print recipe.',{verify:'A sample product idea is not an approved manufacturing job.'})
 ]},
 {id:'oct2026-ai-research',title:'AI Product Discovery and Evidence Review',roles:['marketing','manager','owner-admin'],level:'Intermediate',minutes:30,safeMode:'guided-read-only',summary:'Distinguish an AI-suggested product from a real, approved opportunity.',outcome:'Review provider source citations, shop fit, supplier price evidence and manufacturing acceptance.',steps:[
  step('Open discovery','Go to Product & Event Center and locate 00 AI Discovery.',{route:'/product-event-center',verify:'You can identify research focus and candidate-count fields.'}),
  step('Interpret run status','Explain queued, running, partial, failed and complete without submitting a live request.',{verify:'Queued means accepted, not saved results.'}),
  step('Inspect evidence','Compare public citations, imported supplier prices and speculative demand.',{verify:'You do not invent a supplier price or confirmed customer demand.'}),
  step('Explain approval','Follow an idea to supplier check, sample, recipe, pricing and optional storefront.',{verify:'No AI suggestion is automatically published or invoiced.'}),
  step('Know the AI limits','Review free-tier project limits and provider selection with the owner.',{warning:'Never place API credentials in a client-side setting or force an unapproved paid fallback.'})
 ]},
 {id:'oct2026-dtf-prep',title:'DTF Prep: Preserve Artwork While Removing Backgrounds',roles:['artwork','production','owner-admin'],level:'Intermediate',minutes:35,safeMode:'guided-read-only',summary:'Practice background masking, alpha inspection and export on a sample logo.',outcome:'Produce a visually checked transparent proof without deleting white ink or changing the source.',steps:[
  step('Inspect Source and Proof','Locate file upload, project asset, width/height, quick sizes and preview background.',{route:'/dtf-studio',verify:'A garment-colored proof does not export an opaque shirt-colored background.'}),
  step('Contrast mask tools','Locate AI Remove Background, local removal, keep/restore and brush, and explain different purposes.',{verify:'Keep/restore is for original foreground pixels.'}),
  step('Handle enclosed white','Describe when Remove enclosed white/off-white areas too is dangerous.',{verify:'Important white logo letters remain.'}),
  step('Check channel and output','Locate CMYK channels, dot shape, halftone styles, final alpha and 300 PPI PNG.',{verify:'The user can tell proof-only settings from export settings.'}),
  step('Run preflight','Describe customer approval, correct 3600 x 3600 output for a 12-inch square, and safe R2 save.',{verify:'Source file stays unchanged and derivative is identified.'})
 ]},
 {id:'oct2026-woo-graphics',title:'Woo Product Graphics: Approved Selection to Traveler',roles:['artwork','production','manager','owner-admin'],level:'Advanced',minutes:35,safeMode:'guided-read-only',summary:'Map per-product graphic choices without losing old order selections.',outcome:'Explain and verify the sequence from graphic binding to metadata to exact production traveler.',steps:[
  step('Check exact variations','Open Catalog Production Readiness and name variation/blank/recipe/certificate inputs.',{route:'/catalog-production-readiness',verify:'Every relevant variation has appropriate evidence.'}),
  step('Review graphic map','Open Map Existing Woo Artwork and describe binding to an approved client graphic.',{route:'/woo-artwork-mapping',verify:'An unverified legacy SKU hint is not customer approval.'}),
  step('Understand plugin switches','Explain separate WordPress selector and Netlify capture enable flags.',{verify:'Installed is not equal to public active.'}),
  step('Trace checkout','Diagram Woo chosen logo > item meta > webhook > approved artwork > QR traveler.',{verify:'Two different logos create correctly separated traveler groups.'}),
  step('Stop on mismatch','State what to do when a requested option does not map to an approved revision.',{warning:'Do not guess the logo or remove old variation fields in production.'})
 ]},
 {id:'oct2026-travelers',title:'Production Travelers: Mixed Logos and Multi-Line Groups',roles:['new-employee','production','artwork','manager','owner-admin'],level:'Intermediate',minutes:30,safeMode:'guided-read-only',summary:'Use grouped travelers for orders containing multiple approved processes or graphics.',outcome:'Count saved traveler coverage and read production evidence correctly.',steps:[
  step('Open current jobs','Open QR Job Travelers and identify the open job chooser.',{route:'/production-travelers',verify:'Do not start new travelers for closed jobs.'}),
  step('Choose matching lines','For a fictional eight-hoodie order, group five A-logo and three B-logo pieces by approved recipe.',{verify:'A group never mixes conflicting processes or artwork.'}),
  step('Review artwork and placement','Confirm exact selected logo, measured placement and physically approved recipe revision.',{verify:'Approvals and recipe versions match the order line.'}),
  step('Verify printed traveler','Compare saved traveler PDF, item count, artwork and work instructions.',{verify:'No duplicate or uncovered inventory-required line remains.'}),
  step('Report blockers','Record exception rather than bypassing certification or pretending a draft is ready.',{warning:'A production event is not a substitute for customer approval.'})
 ]},
 {id:'oct2026-print',title:'Print Order: Verified Invoices and School Labels',roles:['new-employee','production','warehouse','manager','owner-admin'],level:'Intermediate',minutes:30,safeMode:'guided-read-only',summary:'Select the correct documents, templates and printer routes.',outcome:'Differentiate authoritative customer invoice, DRAFT shop copy and 4 x 6 labels.',steps:[
  step('Review print options','Open an example Work Hub order and locate Print Order and document checkboxes.',{route:'/work-hub',verify:'Customer invoice, shop copy, labels and saved travelers are distinct.'}),
  step('Verify financial evidence','Describe QuickBooks exact invoice totals, paid balance and the blocked customer-copy state.',{verify:'CO-1006-type mismatch never becomes a final customer invoice by ignoring the warning.'}),
  step('Build label proof','Locate Label template, Number of packages and school-field overrides.',{verify:'Student/Teacher/Coach values appear on the actual preview for that order.'}),
  step('Check output','Use preview first and explain CUPS, Epson and D530 Pro routing.',{verify:'Queued or spooled does not mean the printer physically produced a correct label.'}),
  step('State fallback','Describe what records must be kept when the print agent or live verification is unavailable.',{warning:'Do not switch on untested dispatch flags in training.'})
 ]},
 {id:'oct2026-woo-store',title:'Woo Client Storefront and Plugin Safeguards',roles:['marketing','artwork','manager','owner-admin'],level:'Advanced',minutes:35,safeMode:'guided-read-only',summary:'Recognize Woo store, options, shipping and other plugin boundaries.',outcome:'Distinguish a published category store from a one-time QuickBooks order.',steps:[
  step('Choose order channel','For school and one-time coach requests, decide Woo storefront or team-order form.',{route:'/team-stores',verify:'No duplicate financial/customer-order records.'}),
  step('Review product add-ons','Identify SC Product Options labels, required fields, size upcharges and selected graphic controls.',{verify:'One intended option is not displayed twice by competing plugins.'}),
  step('Review store draft','Describe category products, approval, season copy and site publishing.',{verify:'Publishing requires actual WordPress success and tested checkout.'}),
  step('Explain shipping risks','Compare $199.99, $200, $200.01 carts, coupon, class and pickup variants hypothetically.',{verify:'You know why overlapping shipping extensions are risky.'}),
  step('Protect SKU ownership','Review WordPress Commerce Integrity and document what must be tested in staging.',{warning:'No SKU rebuild, live coupon edit, payment submission or plugin disablement in this tutorial.'})
 ]},
 {id:'oct2026-public-design',title:'Public Design Requests and Quote Conversion',roles:['marketing','artwork','manager','owner-admin'],level:'Beginner',minutes:25,safeMode:'guided-read-only',summary:'Convert customer design submissions into reviewed quotes.',outcome:'Identify the form choices and correct handoff to client order and artwork approval.',steps:[
  step('Inspect quote-only form','Review public /design fields for product, color, size, quantity, notes and possible artwork.',{verify:'The form does not accept a customer payment or publish product.'}),
  step('Find request queue','Open Client Orders and inspect how an incoming request is reviewed.',{route:'/client-orders',verify:'The operator checks contact, sizes, artwork and required delivery date.'}),
  step('Prepare mockup','Identify Mockup Studio, artwork approval and quote-building handoff.',{route:'/mockup-studio',verify:'A proof image is not automatically an approved logo.'}),
  step('Keep authorization boundary','Trace the record to QuickBooks invoice and job conversion.',{verify:'One request yields no duplicate Woo order.'})
 ]},
 {id:'oct2026-manual-index',title:'Search Equipment Manuals and Activate Private Local AI',roles:['manager','owner-admin','production','artwork'],level:'Intermediate',minutes:25,safeMode:'guided-read-only',summary:'Use cited manuals and know what is still required for a local AI gateway.',outcome:'Locate authorized PDFs, recognize OCR gaps and distinguish configured from running services.',steps:[
  step('Review knowledge library','Choose the Knowledge tab and list file title, index status and page citations.',{route:'/creative-operations',verify:'Read source pages before accepting settings.'}),
  step('Inspect privacy boundaries','Explain private knowledge/manuals prefix, allowlisted NAS sync and staff-only access.',{verify:'No customer/personal NAS folder is indexed by default.'}),
  step('Interpret OCR status','State what to do for scanned/image-only PDFs.',{verify:'OCR is a separate reviewed process.'}),
  step('Review local gateway','Describe workshop Ollama, private HTTPS/Tailscale gateway and employee JWT.',{verify:'Code deployed does not mean inference is reachable from the browser.'}),
  step('Practice safety','Explain where machine vendor instructions and physical test results override a model answer.',{warning:'Never open local AI service ports to the public internet.'})
 ]},
 {id:'oct2026-complete-shop-scenarios',title:'Full-Shop Cases: PTO, Group Hoodies, Wedding and Reorders',roles:['new-employee','warehouse','production','artwork','marketing','manager','owner-admin'],level:'Intermediate',minutes:45,safeMode:'guided-read-only',summary:'Practice marketing to production to reconciliation using four fictional customer cases.',outcome:'Navigate the entire business and identify each source of truth.',steps:[
  step('PTO store','Write the path Marketing > Mockup > Team Stores > Woo checkout > Work Hub > QC > distribution.',{route:'/marketing',verify:'Classroom/teacher fields reach actual 4 x 6 label.'}),
  step('Soccer coach order','Write Team Form > Client Orders > QuickBooks invoice > Manual job > grouped travelers.',{route:'/client-orders',verify:'Ten items with two logos are correctly separated.'}),
  step('Wedding products','Write Package Estimate > Samples > Quote > distinct machine recipes > QC/packing.',{route:'/creative-operations',verify:'Glassware, signage and engraving are not treated as one process.'}),
  step('Company logo revision','Trace prior approved asset > new approval > affected products > reorders > final QC.',{route:'/client-graphics',verify:'Old historical orders retain historical evidence.'}),
  step('Find the exception','For each scenario list one blocker and the exact specialist page that resolves it.',{verify:'You did not bypass the protected order or accounting workflow.'})
 ]}
];
