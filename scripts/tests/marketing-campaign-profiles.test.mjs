import test from "node:test";
import assert from "node:assert/strict";
import {marketingCampaignProfile,marketingCampaignMood,marketingCampaignMotif,marketingCategoryKeys} from "../../src/lib/marketingCampaignProfiles.js";
import {studioPrintHtml} from "../../src/lib/marketingDesignStudio.js";

test("category creative copy, mood and vector identity differ without duplicating reference school",()=>{
 const labels=new Set(),motifs=new Set();
 for(const category of marketingCategoryKeys()){
  const profile=marketingCampaignProfile(category);
  const html=studioPrintHtml({client:"Example Organization",category,headline:"YOUR COLLECTION",benefits:["Value one"],steps:["Plan","Approve"],artworkOptions:profile.defaultOptions,artworkMessage:profile.defaultMessage});
  assert.match(html,new RegExp("category-"+category));
  assert.ok(profile.collectionEyebrow.length>6);
  assert.ok(html.includes(profile.artwork));
  assert.ok(html.includes(profile.collection));
  assert.ok(html.includes(profile.slogan));
  assert.ok(html.includes(profile.benefits));
  assert.ok(html.includes(profile.steps));
  assert.ok(html.includes('class="hero-motif"'));
  assert.doesNotMatch(html,/SEQUIM HIGH|SEQUIM WOLVES/i);
  labels.add(profile.collection);
  motifs.add(marketingCampaignMotif(category));
 }
 assert.equal(labels.size,6);
 assert.equal(motifs.size,6);
});
test("school level cues affect mood, operator overrides always win",()=>{
 assert.equal(marketingCampaignMood("school","Example Elementary"),"playful");
 assert.equal(marketingCampaignMood("school","Example High School"),"collegiate");
 assert.equal(marketingCampaignMood("business","Example Service"),"professional");
 assert.equal(marketingCampaignMood("wedding","Example Event"),"elegant");
 assert.equal(marketingCampaignMood("school","Example Elementary","professional"),"professional");
 assert.equal(marketingCampaignMood("school","Generic School","auto",["#ef2424","#ffd500"]),"athletic");
 assert.equal(marketingCampaignMood("school","Generic School","auto",["#777777","#aaaaaa"]),"professional");
 assert.equal(marketingCampaignMood("general","Client","auto",["#ef2424","#ffd500"]),"expressive");
});
test("approved palette and escaping are preserved in every category",()=>{
 for(const category of marketingCategoryKeys()){
  const html=studioPrintHtml({category,colors:["#113355","#f0c040"],client:'Bad <script>alert(1)</script>',artworkOptions:['& club'],plan:{accent:"#FF0000"}});
  assert.match(html, /--primary:#113355/);
  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(html, /--primary:#FF0000/);
 }
});
