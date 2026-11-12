import test from "node:test";
import assert from "node:assert/strict";
import {schoolFundraisingExample,normalizeSchoolFundraising,MAX_FUNDRAISING_PRODUCTS} from "../../src/lib/marketingSchoolFundraising.js";
import {defaultStudioServices,validateStudioServices} from "../../src/lib/marketingStudioServices.js";
import {studioPrintHtml} from "../../src/lib/marketingDesignStudio.js";
import {readFileSync} from "node:fs";

const verified={enabled:true,wholesale:"17.25",retail:"28.50",quantity:"75"};
test("fundraising example uses exact cents and verified decorated wholesale not supplier cost",()=>{
 const r=schoolFundraisingExample(verified);
 assert.equal(r.ready,true);
 assert.deepEqual(r.example,{wholesale:"$17.25",retail:"$28.50",perItem:"$11.25",quantity:75,total:"$843.75"});
});
test("school example never fabricates prices, negatives, excessive quantities, or precision",()=>{
 for(const data of [
  {wholesale:"",retail:"25.00",quantity:75},
  {wholesale:"19.00",retail:"15.00",quantity:75},
  {wholesale:"-1.00",retail:"15.00",quantity:75},
  {wholesale:"1.555",retail:"15.00",quantity:75},
  {wholesale:"3",retail:"5",quantity:"5.2"},
  {wholesale:"3",retail:"5",quantity:"10001"},
  {wholesale:"3",retail:"5",quantity:"<script>"},
 ])assert.equal(schoolFundraisingExample({...verified,...data}).ready,false);
 assert.deepEqual(schoolFundraisingExample({enabled:false,wholesale:"bogus"}),{enabled:false,ready:true,errors:[],example:null});
});
test("school flyer renders both yearly artwork options and reviewed money only",()=>{
 const html=studioPrintHtml({category:"school",client:"Test School",schoolFundraising:verified});
 assert.match(html,/ARTWORK REFRESH/);
 assert.match(html,/SEASONAL/);
 assert.match(html,/SPORT-SPECIFIC/);
 assert.match(html,/\$843\.75/);
 assert.match(html,/\$11\.25/);
 const unpriced=studioPrintHtml({category:"school",client:"Test School",schoolFundraising:{enabled:true,wholesale:"bad",retail:"999",quantity:75}});
 assert.ok(!unpriced.includes('class="fundraising-mini"'));
 assert.ok(!unpriced.includes("$999"));
 const business=studioPrintHtml({category:"business",schoolFundraising:verified});
 assert.ok(!business.includes('class="school-callouts"'));
});
test("editor persists school fundraising and blocks export on invalid entries",()=>{
 const ui=readFileSync(new URL("../../src/MarketingAIDesignStudio.jsx",import.meta.url),"utf8");
 assert.match(ui,/schoolFundraisingExample\(schoolFundraising\)/);
 assert.match(ui,/studioVersion:7/);
 assert.match(ui,/schoolFundraising,studioServices,productLabels,organization/);
});

test("four named school product options calculate exact individual and combined gross proceeds",()=>{
 const products=[
  {title:"Gildan 18500 hoodie",wholesale:"17.25",retail:"28.50",quantity:"75"},
  {title:"Gildan 5000 T-shirt",wholesale:"8.50",retail:"17.00",quantity:"100"},
  {title:"Embroidered cap",wholesale:"12.00",retail:"22.00",quantity:"40"},
  {title:"Crewneck sweatshirt",wholesale:"16.00",retail:"28.00",quantity:"50"}
 ];
 const funding=schoolFundraisingExample({enabled:true,products});
 assert.equal(MAX_FUNDRAISING_PRODUCTS,4);
 assert.equal(funding.ready,true);
 assert.deepEqual(funding.examples.map(x=>x.total),["$843.75","$850.00","$400.00","$600.00"]);
 assert.equal(funding.grandTotal,"$2,693.75");
 const html=studioPrintHtml({category:"school",schoolFundraising:{enabled:true,products}});
 assert.match(html,/Gildan 18500 hoodie/);
 assert.match(html,/Gildan 5000 T-shirt/);
 assert.match(html,/Illustrative total/);
 assert.match(html,/\$2,693\.75/);
 assert.match(html,/before taxes, payment processing/);
});
test("fundraising rejects a fifth item, empty item title, malformed amounts and malicious HTML",()=>{
 const good={title:"Hoodie",wholesale:"12.00",retail:"20.00",quantity:"75"};
 for(const products of [[good,good,good,good,good],[{...good,title:""}],[{...good,retail:"20.555"}],[{...good,quantity:"0"}]]){
  assert.equal(schoolFundraisingExample({enabled:true,products}).ready,false);
 }
 const malicious={...good,title:'<img src=x onerror=alert(1)>'};
 const html=studioPrintHtml({category:"school",schoolFundraising:{enabled:true,products:[malicious]}});
 assert.ok(html.includes("&lt;img src=x onerror=alert(1)&gt;"));
 assert.ok(!html.includes('<img src=x onerror=alert(1)>'));
});
test("old single-item drafts load without inventing a product identity",()=>{
 const old={enabled:true,wholesale:"17.25",retail:"28.50",quantity:"75"};
 const restored=normalizeSchoolFundraising(old);
 assert.equal(restored.products.length,1);
 assert.equal(restored.products[0].title,"");
 assert.equal(restored.products[0].wholesale,"17.25");
 assert.deepEqual(schoolFundraisingExample(old).example,schoolFundraisingExample(verified).example);
});
test("each campaign category has editable, escaped service descriptions",()=>{
 for(const category of ["school","team","business","nonprofit","wedding","event","general"]){
  const defaults=defaultStudioServices(category);
  assert.equal(validateStudioServices(defaults,category).ready,true);
  const html=studioPrintHtml({category,studioServices:{...defaults,heading:"SPECIAL CLIENT SERVICES",description:"Approved <custom> artwork",examples:"Seasonal, club & event variants"}});
  assert.match(html,/SPECIAL CLIENT SERVICES/);
  assert.ok(html.includes("Approved &lt;custom&gt; artwork"));
  assert.ok(html.includes("Seasonal, club &amp; event variants"));
  assert.ok(!html.includes("<custom>"));
 }
 assert.equal(validateStudioServices({enabled:true,heading:"",description:""}, "school").ready,false);
 assert.ok(!studioPrintHtml({category:"school",studioServices:{enabled:false}}).includes('class="artwork-options"'));
});
test("team and nonprofit can offer verified fundraising while business and weddings do not infer proceeds",()=>{
 const products=[{title:"Supporter tee",wholesale:"10",retail:"18",quantity:"50"}];
 for(const category of ["team","nonprofit"])assert.match(studioPrintHtml({category,schoolFundraising:{enabled:true,products}}),/\$400\.00/);
 for(const category of ["business","wedding","event"])assert.ok(!studioPrintHtml({category,schoolFundraising:{enabled:true,products}}).includes("multi-fundraising"));
});
