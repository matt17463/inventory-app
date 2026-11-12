import assert from "node:assert/strict";
import test from "node:test";
import {evaluateMarketingReleaseEvidence,MARKETING_RELEASE_WORKFLOWS,MARKETING_VISUAL_CASES} from "../../src/lib/marketingReleaseGate.js";
const commit="a".repeat(40);
const valid=()=>({
 commit,
 workflows:Object.fromEntries(MARKETING_RELEASE_WORKFLOWS.map(x=>[x,"success"])),
 visualReviews:MARKETING_VISUAL_CASES.map(key=>({case:key,reviewer:"Staff Reviewer",reviewArtifact:"https://github.com/example/review.pdf",approvedIdentity:true,approvedMerchandise:true,comparedAtPrintSize:true})),
 tenantStaging:{runArtifact:"https://github.com/example/tenant-audit",clientA:"test-client-one",clientB:"test-client-two",crossClientAssetDenied:true,crossClientDraftDenied:true,approvalDeniedForPending:true,privateUrlExpiryChecked:true},
 printProof:{reviewArtifact:"https://github.com/example/print.pdf",paper:"US Letter",actualPrinterChecked:true,bordersAndTrimChecked:true,imageDpiChecked:true,fontsAndContrastChecked:true},
 nativeDocumentParity:{templateCount:35,docxPassed:true,pdfPassed:true,testArtifact:"https://github.com/example/native-exports"},
 rollback:{procedure:"Use version-tagged prior Netlify deploy",testedBy:"Release Operator"},
 ownerSignoff:{approved:true,approvedBy:"Business Owner",approvedAt:"2026-11-12T17:00:00Z",commit}
});
test("release remains blocked without any actual owner/visual/staging evidence",()=>{
 const r=evaluateMarketingReleaseEvidence({},commit);
 assert.equal(r.ready,false);
 assert.ok(r.errors.length>=10);
});
test("complete verified-dossier shape can be assessed without ever deploying",()=>{
 const data=valid();
 assert.deepEqual(evaluateMarketingReleaseEvidence(data,commit).errors,[]);
 assert.equal(evaluateMarketingReleaseEvidence(data,commit).ready,true);
});
test("one stale CI result or missing school comparison blocks release",()=>{
 const data=valid();data.workflows["Marketing school flyer visual fixtures"]="pending";
 assert.equal(evaluateMarketingReleaseEvidence(data,commit).ready,false);
 data.workflows["Marketing school flyer visual fixtures"]="success";
 data.visualReviews=data.visualReviews.filter(x=>x.case!=="sequim-high-school");
 assert.match(evaluateMarketingReleaseEvidence(data,commit).errors.join(" "),/sequim-high-school/);
});
test("client-scoping, printed proof and exact owner-approved commit remain mandatory",()=>{
 const data=valid();
 data.tenantStaging.clientB=data.tenantStaging.clientA;
 data.printProof.actualPrinterChecked=false;
 data.ownerSignoff.commit="b".repeat(40);
 const errors=evaluateMarketingReleaseEvidence(data,commit).errors.join(" ");
 assert.match(errors,/two-client staging/);
 assert.match(errors,/physical US Letter/);
 assert.match(errors,/Owner must explicitly approve/);
});
