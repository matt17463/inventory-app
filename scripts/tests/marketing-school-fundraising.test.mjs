import test from "node:test";
import assert from "node:assert/strict";
import {schoolFundraisingExample} from "../../src/lib/marketingSchoolFundraising.js";
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
 assert.ok(!unpriced.includes("fundraising-mini"));
 assert.ok(!unpriced.includes("$999"));
 const business=studioPrintHtml({category:"business",schoolFundraising:verified});
 assert.ok(!business.includes('class="school-callouts"'));
});
test("editor persists school fundraising and blocks export on invalid entries",()=>{
 const ui=readFileSync(new URL("../../src/MarketingAIDesignStudio.jsx",import.meta.url),"utf8");
 assert.match(ui,/schoolFundraisingExample\(schoolFundraising\)/);
 assert.match(ui,/studioVersion:5/);
 assert.match(ui,/schoolFundraising,organization/);
});
