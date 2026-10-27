export const certificationGuideChapter={
 id:'variation-certification-operations',title:'Product certification: first setup to the shop floor',
 description:'One exact garment variation, reviewed artwork file, tested recipe and customer proof. Follow this before making managed products.',
 sections:[
  {id:'catalog-artwork-mapping',title:'Map existing Woo artwork before production review',summary:'Use Map Existing Woo Artwork for the whole catalog. Draft migration does not require customer approval or physical measurements.',relatedRoutes:['/woo-artwork-mapping','/catalog-production-readiness'],steps:[
   'Select one or many existing Woo families in the mapping queue and choose Inspect selected products. The tool reads actual Woo variations, saves a recoverable baseline and resumes unchanged source revisions without rewriting products.',
   'For each legacy logo choice, select the exact artwork file and either a shared graphic family or a new draft family. Review existing variation images side by side. Save partial drafts whenever information is missing.',
   'Import mapped artwork as draft Client Graphics. This creates draft file revisions with unspecified measurements and disabled product associations; it grants no approval or live selector activation.',
   'Reuse a saved mapping as a template for another product. Only exact legacy terms copy; image associations, retained physical variation IDs and approvals remain product-specific.',
   'Export the baseline, mapping and historic variation crosswalk. Complete genuine production reviews later. Checking activation readiness reports remaining source, recipe, mockup and customer evidence without preventing draft mapping.'
  ]},
  {id:'certification-start',title:'1. Open the product setup wizard',summary:'Start in Product Setup & Readiness. One family can contain many independently certified variations.',relatedRoutes:['/catalog-production-readiness','/product-blank-mappings'],steps:[
   'Search for the WooCommerce parent product. Compare the live parent ID, purchased variation ID, color, size and SKU with the physical product. A duplicate synchronized variation must be reconciled before certification; do not delete an old row merely to clear a blocker.',
   'Open Match physical blanks. Select the exact brand, style, color and size from the blank catalog. A similar name or SKU is only a candidate. Confirm the actual blank label before saving.',
   'Legacy fulfillment stays legacy until deliberately reviewed. Opening the wizard or marking a Work Hub review N/A does not issue a manufacturing certificate.'
  ]},
  {id:'certification-artwork',title:'2. Establish artwork permission and file identity',summary:'An uploaded picture and a passing technical preflight do not prove permission or customer approval.',relatedRoutes:['/client-graphics','/mockup-studio','/artwork-preflight'],steps:[
   'Use the existing artwork link and Client Graphics library. Record who authorized use, the exact graphic family/variant, garment restrictions and the source of that authorization.',
   'Keep Exact artwork locked for logos and text that must remain unchanged. Review transparency, white ink and physical print dimensions in preflight.',
   'In the final wizard step, open Artwork file revision and integrity. A manager enters the source revision inspected and chooses Register reviewed file bytes. The server computes SHA-256; the registration is an immutable file record, not an approval.',
   'Upload revised artwork as a new file/object. Preserve earlier files and evidence. Register the new file and obtain new source approvals before recertifying. A changed byte stream at an already registered object blocks preflight; do not repin changed bytes under the old key.'
  ],warnings:['Never impersonate a customer portal response or infer ownership from a filename. Managers may document genuine externally received approval with its source. Direct R2/NAS administrators can still alter objects outside the application; use restricted credentials and inspect backup/restore health.']},
  {id:'certification-recipe-proof',title:'3. Verify the recipe and customer proof',summary:'The recipe must describe a physically tested process and the proof must show this exact blank and every decoration.',relatedRoutes:['/manufacturing-recipes','/material-settings','/mockup-studio'],steps:[
   'Choose or draft the manufacturing recipe. Record the method, exact blank restrictions, each placement, width AND height, reference landmark, offsets, machine/material settings, process sequence and packaging.',
   'Perform and inspect the actual sample. A manager approves the immutable recipe revision after the real sample is verified. Starter dimensions and example machine parameters are not production instructions.',
   'Create or open the linked Mockup Studio project. Pair each placement with the exact blank catalog ID and artwork. Choose the intended output and record internal review.',
   'Obtain the customer decision through the existing customer-review workflow. Share a review link only as part of authorized customer communication. Customer approval must be current after the latest artwork, blank, placement and mockup change.',
   'If genuine approval was already received outside the portal, a manager may record the exact output, approving party, source reference and verified facts under Record an approval received outside the customer portal. This is visibly a manager-recorded external decision, not a customer login. Record withdrawals as a new decision; never alter history or fabricate consent.'
  ]},
  {id:'certification-issue',title:'4. Save the exact configuration and certify',summary:'A family recipe assignment is a routing choice. Certification belongs to an individual synchronized variation.',relatedRoutes:['/catalog-production-readiness'],steps:[
   'In the final wizard step select the exact variation, approved recipe revision and one exact mockup output for each recipe placement, in placement order.',
   'Enter only review facts you actually verified. Save exact configuration and check evidence. Read every blocker and correct it in its source screen. Do not change customer or sample decisions to make a check pass.',
   'When all evidence is current, an administrator or manager may choose Certify this exact variation. Record the certificate ID. Operators and viewers cannot grant certification.',
   'Expand certification and audit history to inspect the saved evidence and later revocations. Repeat for each additional variation; one size or color does not certify the family.'
  ]},
  {id:'certification-traveler',title:'5. Prepare and print an actual order',summary:'Work Hub coordinates the order; Production Travelers freezes the approved shop instructions.',relatedRoutes:['/work-hub','/production-travelers','/print-center'],steps:[
   'Open the actual Woo or manual job in Work Hub. Verify quantities, personalization and blank pairing. Follow a checkpoint to its specialist screen; Return to Work Hub brings you back to the same job.',
   'Manager review states such as In progress, Blocked and Not applicable describe work. They never replace the certificate, customer decision, stock check or official QC.',
   'Select only the intended job lines and exact approved recipe. Traveler creation checks the certificate, order specifications, graphic selection and fresh artwork storage verification. Missing or revoked evidence blocks managed production.',
   'Open the generated traveler. Compare its frozen order context, names/numbers, placements, dimensions, recipe revision and artwork with the order. Print this approved traveler through the existing print controls.',
   'Use Print Center for the customer invoice, internal shop packet and packing labels. Inspect paper size, scaling, QR readability and personalization on a physical sample. Paper output does not grant production approval, deduct stock or prove shipment.'
  ]},
  {id:'certification-recovery',title:'6. Stop, review and recover after a change',summary:'A revoked certificate or outdated traveler is a hold requiring source review.',relatedRoutes:['/production-travelers','/catalog-production-readiness','/asset-storage-health'],steps:[
   'Stop affected managed work and read the revocation reason and traveler check. Record an exception if necessary. Do not use an old printed copy to bypass a hold.',
   'Correct the source evidence, obtain actual new approvals and recertify the exact variation. A fresh customer decision may restore approval; it must never be fabricated for recovery.',
   'If physical instructions and the original order specification are unchanged, a manager may use reviewed traveler revalidation. Changed artwork, garment, placement, personalization or quantities requires a reviewed replacement.',
   'Create the replacement with a clear reason. Preserve the original traveler and audit history, and remove superseded paper copies from active work. Reorders use the same comparison; a prior sale alone never proves approval.',
   'Check Storage Administration. NAS success is an agent report, not a restore guarantee. Investigate stale reports and independently test restoration before relying on backups.'
  ]}
 ]
};
export const certificationTutorial={
 id:'exact-variation-certification',title:'Exact variation certification and safe production recovery',
 roles:['new-employee','artwork','production','manager','owner-admin'],level:'Required',minutes:30,safeMode:'read-only-practice',
 summary:'Rehearse one product from exact identity to certification, traveler and revision hold without changing a customer job.',
 outcome:'Employee can identify the real approving party, explain every hold and preserve superseded instructions.',
 steps:[
  {title:'Confirm the exact item',instruction:'Find a product in the setup wizard. Read parent/variation IDs, SKU, color, size and physical blank.',route:'/catalog-production-readiness',verify:'Explain how duplicate identities and a wrong blank block certification.'},
  {title:'Review artwork evidence',instruction:'Locate the permission source, immutable checksum registration, preflight and exact mockup output.',route:'/mockup-studio',verify:'A checksum confirms file identity; it supplies no customer consent.'},
  {title:'Read a tested recipe',instruction:'Inspect an approved revision, physical-sample evidence, width/height, placements and material settings.',route:'/manufacturing-recipes',verify:'Do not approve an example or untested starter during practice.'},
  {title:'Explain certification blockers',instruction:'Identify a missing customer proof or configuration in the final wizard step. Explain the authorized correction without saving.',route:'/catalog-production-readiness',verify:'Only a real customer decision and manager-reviewed exact evidence can resolve their corresponding blockers.'},
  {title:'Compare shop instructions',instruction:'Inspect a historical traveler and its frozen order context. Locate its current check and replacement controls.',route:'/production-travelers',verify:'Describe approval-only revalidation versus changed-instruction replacement. Preserve the original.'},
  {title:'Follow Work Hub and printing',instruction:'Use the return link from a specialist screen and inspect Print Center paper settings without printing a real job.',route:'/work-hub',verify:'N/A and training completion do not override production evidence. Physical printer acceptance remains a separate check.'}
 ]
};
