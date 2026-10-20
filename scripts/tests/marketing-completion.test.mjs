import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {scoreMarketingProspect} from "../../src/lib/marketingProspectScoring.js";
const src=path=>readFileSync(new URL(path,import.meta.url),"utf8");

test("marketing fit score explains evidence and never predicts purchase intent",()=>{
 const noWebsite=scoreMarketingProspect({name:"Example"}, {industry:"soccer clubs"});
 assert.equal(noWebsite.score,0);
 const low=scoreMarketingProspect({name:"Regional Company",website:"https://organization.test",location:"Other region",reason:"Wholesale goods"}, {industry:"soccer clubs",region:"Kitsap County"});
 const high=scoreMarketingProspect({name:"Kitsap Soccer Club",website:"https://organization.test",location:"Kitsap County, Washington",reason:"Soccer club organizes teams and spirit wear"}, {industry:"soccer clubs",region:"Kitsap County",query:"spirit wear"});
 assert(high.score>low.score);assert.equal(high.provisional,true);
 assert(high.reasons.every(r=>r.includes("(+")||r.includes("provided")));
});
test("prospect workflow has human review, duplicate checks and follow-up tasks",()=>{
 const ui=src("../../src/MarketingProspectDiscovery.jsx");
 assert.match(ui,/scoreMarketingProspect/);
 assert.match(ui,/sc_growth_accounts/);
 assert.match(ui,/sc_growth_contacts/);
 assert.match(ui,/reviewedContacts/);
 assert.match(ui,/sc_growth_tasks/);
 assert.match(ui,/source.*research/i);
 assert.match(ui,/contact_permission:"unknown"/);
});
test("contact discovery does not guess personal details or save contacts by itself",()=>{
 const api=src("../../netlify/functions/marketing-public-contacts.js");
 assert.match(api,/allowedRoles:\["admin","manager","marketing"\]/);
 assert.match(api,/type:"web_search"/);
 assert.match(api,/sameSite\(x.source_url,site\)/);
 assert.match(api,/verified:false/);
 assert.doesNotMatch(api,/\.insert\(/);
});
test("new outreach scheduling is internal task creation rather than auto emailing",()=>{
 const p=src("../../src/MarketingFollowUpPlanner.jsx");
 assert.match(p,/growthWriteAllowed\(\)/);
 assert.match(p,/sc_growth_tasks/);
 assert.match(p,/\.insert\(rows\)/);
 assert.match(p,/No emails or marketing messages were sent/);
 assert.match(p,/introduction:/);
 assert.match(p,/reorder:/);
 assert.match(p,/seasonal:/);
});
test("marketing document and brochure support restricted R2 logo uploads",()=>{
 const api=src("../../netlify/functions/marketing-artwork-asset.js");
 assert.match(api,/allowedRoles:\["admin","manager","operator","marketing"\]/);
 assert.match(api,/marketing\/artwork\//);
 assert.match(api,/2_500_000/);
 assert.match(api,/getSignedUrl/);
 assert.match(api,/operationalStorageProvider/);
 assert.doesNotMatch(api,/service_role/);
 const docs=src("../../src/MarketingDocumentStudio.jsx");
 const brochure=src("../../src/MarketingBrochureStudio.jsx");
 assert.match(docs,/marketing_artwork: storedArtwork/);
 assert.match(brochure,/marketing_artwork:storedArtwork/);
 assert.match(brochure,/Download printable brochure/);
 const review=src("../../netlify/functions/marketing-review-link.js");
 assert.match(review,/doc.account_id/);
 assert.match(review,/content.logo_url/);
});
test("marketable mockup handoff and training lessons are wired in",()=>{
 const preview=src("../../src/MarketingStorePreview.jsx");
 assert.match(preview,/createMockupProject/);
 assert.match(preview,/exact_artwork_required:true/);
 assert.match(preview,/growthWriteAllowed\(\)/);
 const ws=src("../../src/MarketingWorkspace.jsx");
 for(const name of ["MarketingProspectDiscovery","MarketingBrochureStudio","MarketingFollowUpPlanner"])assert.match(ws,new RegExp(name));
 const training=src("../../src/application-guide/trainingData.js");
 assert.match(training,/marketing-research-brochure-artwork/);
 assert.match(training,/No stock or WooCommerce orders are created/);
});

test("public concept review uses the browser document rather than shadowing it with review state",()=>{
 const srcText=src("../../src/MarketingClientReview.jsx");
 assert.match(srcText,/const \[reviewData,setDocument\]/);
 assert.doesNotMatch(srcText,/const \[document,setDocument\]/);
 assert.match(srcText,/document\.createElement\("meta"\)/);
});

test("public-prospect and official-contact research must run actual web search",()=>{
 for(const path of ["../../netlify/functions/marketing-prospect-research.js","../../netlify/functions/marketing-public-contacts.js"]){
  assert.match(src(path),/tool_choice:"required"/);
 }
});
