/**
 * Operator-and-CI release dossier. This checks evidence completeness, not
 * authenticity: reviewers must verify linked artifacts and identities.
 * NO production action is performed by this module.
 */
export const MARKETING_RELEASE_WORKFLOWS=Object.freeze([
 "Validate Inventory App","Marketing Document Builder Regression",
 "Marketing school flyer visual fixtures","Graphical theme gallery",
 "Isolated production activation acceptance","Product & Event Center Regression",
 "Creative Operations local inference smoke","Variation certification PostgreSQL integration"
]);
export const MARKETING_VISUAL_CASES=Object.freeze([
 "sequim-high-school","greywolf-elementary","helen-haller-elementary",
 "team","business","nonprofit","wedding","event","general"
]);
const filled=value=>typeof value==="string"&&value.trim().length>3;
const validSha=value=>typeof value==="string"&&/^[a-f0-9]{40}$/i.test(value);
export function evaluateMarketingReleaseEvidence(evidence={},expectedCommit=""){
 const errors=[],add=(message)=>errors.push(message);
 if(!validSha(expectedCommit)||evidence.commit!==expectedCommit)add("Release evidence must match the exact, validated 40-character Git commit SHA.");
 const checks=evidence.workflows&&typeof evidence.workflows==="object"?evidence.workflows:{};
 for(const workflow of MARKETING_RELEASE_WORKFLOWS)
  if(checks[workflow]!=="success")add("CI must pass: "+workflow);
 const visual=Array.isArray(evidence.visualReviews)?evidence.visualReviews:[];
 for(const key of MARKETING_VISUAL_CASES){
  const record=visual.find(item=>item&&item.case===key);
  if(!record||!filled(record.reviewer)||!filled(record.reviewArtifact)||!record.approvedIdentity||!record.approvedMerchandise||!record.comparedAtPrintSize)
   add("Missing human-reviewed, approved-asset US Letter proof for "+key);
 }
 const tenants=evidence.tenantStaging||{};
 if(!filled(tenants.runArtifact)||!filled(tenants.clientA)||!filled(tenants.clientB)||tenants.clientA===tenants.clientB||
    tenants.crossClientAssetDenied!==true||tenants.crossClientDraftDenied!==true||tenants.approvalDeniedForPending!==true||
    tenants.privateUrlExpiryChecked!==true)
  add("Authenticated two-client staging evidence must prove both asset and draft isolation, approval denial and URL expiry.");
 const print=evidence.printProof||{};
 if(!filled(print.reviewArtifact)||print.paper!=="US Letter"||print.actualPrinterChecked!==true||
    print.bordersAndTrimChecked!==true||print.imageDpiChecked!==true||print.fontsAndContrastChecked!==true)
  add("Inspect a physical US Letter print proof with margins, DPI, font and contrast measurements.");
 const document=evidence.nativeDocumentParity||{};
 if(document.templateCount!==35||document.docxPassed!==true||document.pdfPassed!==true||!filled(document.testArtifact))
  add("Provide successful native Word/PDF parity evidence for all 35 legacy marketing templates.");
 if(!filled(evidence.rollback?.procedure)||!filled(evidence.rollback?.testedBy))
  add("Document and validate the production rollback procedure.");
 if(evidence.ownerSignoff?.approved!==true||!filled(evidence.ownerSignoff?.approvedBy)||
    !filled(evidence.ownerSignoff?.approvedAt)||evidence.ownerSignoff?.commit!==expectedCommit)
  add("Owner must explicitly approve this exact commit after reviewing the finished marketing documents.");
 return {ready:errors.length===0,errors,commit:expectedCommit,checkedCases:MARKETING_VISUAL_CASES.length,checkedWorkflows:MARKETING_RELEASE_WORKFLOWS.length};
}
