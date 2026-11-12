import assert from "node:assert/strict";
import test from "node:test";
import {studioPrintHtml} from "../../src/lib/marketingDesignStudio.js";
import {verifiedFundraisingRows,schoolArtworkServiceOptions} from "../../src/lib/marketingSchoolProgram.js";

const art="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==";

test("school program is client adaptive, not a Sequim recolor",()=>{
 const params={client:"Example Community School",category:"school",logo:art,colors:["#123456","#aabbcc"],headline:"SPIRIT WEAR FOR EVERYONE",description:"Program info",productImages:[art],benefits:["Funding opportunities","Online store","Local partnership"],steps:["Plan","Build","Order","Support"],artworkOptions:schoolArtworkServiceOptions(),artworkMessage:"Approved logo variations, seasonal design collections and sports/clubs art",fundraisingNote:"Support school activities with agreed prices"};
 const html=studioPrintHtml(params);
 assert.match(html,/Example Community School/);
 assert.match(html,/ONE SCHOOL\. ENDLESS SPIRIT/);
 assert.match(html,/Fall, winter &amp; spring collections/);
 assert.match(html,/Sport and team-specific artwork/);
 assert.match(html,/Clubs, activities &amp; special events/);
 assert.match(html,/PROGRAM FUNDING/);
 assert.doesNotMatch(html,/SEQUIM|WOLVES|253\.432/i);
 for(let concept=0;concept<3;concept++){
  const item=studioPrintHtml({...params,concept});
  assert.match(item,/YOUR LOGO\. MORE POSSIBILITIES/);
  assert.match(item,/Example Community School/);
 }
});

test("unverified fundraising inputs cannot create numbers or promises",()=>{
 const row={product:"Approved Hoodie",wholesale:25,retail:40,quantity:100};
 assert.deepEqual(verifiedFundraisingRows([row]),[]);
 const html=studioPrintHtml({category:"school",fundraisingNote:"Ask about approved prices.",fundraisingRows:[row]});
 assert.doesNotMatch(html,/<table class="fundraising-table">/);
 assert.doesNotMatch(html,/\$1,500\.00/);
 const verified=verifiedFundraisingRows([{...row,verified:true}]);
 assert.equal(verified[0].profit,1500);
 const approvedHtml=studioPrintHtml({category:"school",fundraisingRows:[{...row,verified:true}]});
 assert.match(approvedHtml,/<table class="fundraising-table">/);
 assert.match(approvedHtml,/\$1,500\.00/);
 assert.match(approvedHtml,/before fees, taxes and other costs/);
});

test("only approved image data can become a hero, and untrusted content is escaped",()=>{
 const html=studioPrintHtml({client:"Another School",heroImage:"https://example.com/unreviewed.jpg",artworkMessage:"<script>alert(1)</script>",artworkOptions:["<b>sports</b>"]});
 assert.doesNotMatch(html,/<img class="hero-photo"/);
 assert.doesNotMatch(html,/<script>/);
 assert.match(html,/&lt;script&gt;/);
 assert.match(html,/&lt;b&gt;sports&lt;\/b&gt;/);
});

test("local AI layout suggestions reorder verified blocks but cannot remove logo options",()=>{
 const html=studioPrintHtml({client:"Demo Academy",category:"school",logo:art,productImages:[art],colors:["#162c52","#f7c02a"],benefits:["Online orders"],steps:["Review choices"],artworkOptions:schoolArtworkServiceOptions(),plan:{sections:["hero","benefits","products","steps","cta"],composition:"editorial",emphasis:"benefits",align:"center",accent:"#ff0000"}});
 assert.ok(html.indexOf('<section class="benefits">')<html.indexOf('<div class="gallery'));
 assert.match(html,/focus-benefits/);
 assert.match(html,/align-center/);
 assert.match(html,/YOUR LOGO\. MORE POSSIBILITIES/);
 assert.doesNotMatch(html,/<style>[^]*--primary:#ff0000/);
});

test("artwork modernization only shows before/variant comparison with a supplied approved variant",()=>{
 const without=studioPrintHtml({category:"school",logo:art,artworkOptions:schoolArtworkServiceOptions()});
 assert.doesNotMatch(without,/Approved logo variation/);
 const withVariant=studioPrintHtml({category:"school",logo:art,artworkVariantImage:art,artworkOptions:schoolArtworkServiceOptions()});
 assert.match(withVariant,/Original approved school crest/);
 assert.match(withVariant,/Approved logo variation/);
 assert.match(withVariant,/ORIGINAL/);
 assert.match(withVariant,/VARIANT/);
});
