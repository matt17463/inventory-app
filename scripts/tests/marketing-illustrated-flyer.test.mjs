import test from "node:test";
import assert from "node:assert/strict";
import { schoolFlyerSvg } from "../../src/lib/marketingIllustratedFlyer.js";

const school=(organization,primary,secondary)=>({
 organization,colors:[primary,secondary],headline:"BIG SCHOOL SPIRIT.",
 tagline:"LESS WORK FOR YOUR PTO.",
 schoolLogo:"data:image/png;base64,AAAA",
 heroArtwork:"data:image/png;base64,AAAA",
 businessLogo:"data:image/png;base64,AAAA",
 contact:{website:"skilledcrafting.com"},
 products:[
  {name:"School Tee",mockup:"data:image/png;base64,AAAA",tiers:[{min:1,wholesale:12,retail:20}]},
  {name:"School Hoodie",mockup:"data:image/png;base64,AAAA",tiers:[{min:1,wholesale:25,retail:38}]}
 ]
});
test("three schools share the illustrated composition but retain school identity and colors",()=>{
 for(const [name,primary,secondary] of [
  ["Greywolf Elementary","#06457b","#f4d51a"],
  ["Helen Haller Elementary","#086339","#ffd329"],
  ["Sequim High School","#4c187a","#ffdc24"]
 ]){
  const svg=schoolFlyerSvg(school(name,primary,secondary));
  assert.match(svg,/viewBox="0 0 612 792"/);
  assert.ok(svg.includes(name.toUpperCase()),name);
  assert.ok(svg.includes(primary),name);
  assert.ok(svg.includes(secondary),name);
  for(const section of ["HOW IT WORKS","FUNDRAISING EXAMPLE","ARTWORK MODERNIZATION","LET'S BRING SCHOOL SPIRIT"])
   assert.ok(svg.includes(section),name+" missing "+section);
  assert.match(svg,/\$8\.00/);
  assert.match(svg,/\$13\.00/);
  assert.match(svg,/\$975\.00/);
 }
});
test("dynamic content is XML escaped and never injected as SVG markup",()=>{
 const svg=schoolFlyerSvg(school("<script>bad</script>","#06457b","#f4d51a"));
 assert.ok(!svg.includes("<script>"));
 assert.ok(svg.includes("&lt;SCRIPT&gt;BAD&lt;/SCRIPT&gt;"));
});
