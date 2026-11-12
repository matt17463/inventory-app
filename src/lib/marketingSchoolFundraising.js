/** Operator-verified illustrative decorated wholesale and retail math, never supplier costs. */
const money=cents=>(cents/100).toLocaleString("en-US",{style:"currency",currency:"USD"});
const cents=value=>{
 const text=String(value??"").trim();
 if(!/^(?:0|[1-9]\d{0,5})(?:\.\d{1,2})?$/.test(text))return null;
 const [whole,decimal=""]=text.split(".");
 return Number(whole)*100+Number((decimal+"00").slice(0,2));
};
export const MAX_FUNDRAISING_PRODUCTS=4;
export const blankFundraisingProduct=()=>({title:"",wholesale:"",retail:"",quantity:"75"});
export const defaultSchoolFundraising=()=>({enabled:false,products:[blankFundraisingProduct()]});
/** Read previous v5/v6 drafts without inventing an item identity. */
export function normalizeSchoolFundraising(value={}){
 const input=value&&typeof value==="object"?value:{};
 const products=Array.isArray(input.products)?input.products.slice(0,MAX_FUNDRAISING_PRODUCTS):
  [{title:input.title||"",wholesale:input.wholesale||"",retail:input.retail||"",quantity:input.quantity??"75"}];
 return {enabled:input.enabled===true,products:(products.length?products:[blankFundraisingProduct()])
  .map(row=>({title:String(row?.title??"").slice(0,80),wholesale:String(row?.wholesale??""),
   retail:String(row?.retail??""),quantity:String(row?.quantity??"75")}))};
}
export function schoolFundraisingExample(value={}){
 const input=value&&typeof value==="object"?value:{};
 if(input.enabled!==true)return {enabled:false,ready:true,errors:[],example:null};
 const normalized=normalizeSchoolFundraising(input);
 const modern=Array.isArray(input.products);
 const errors=[];
 if(modern&&input.products.length>MAX_FUNDRAISING_PRODUCTS)errors.push("A maximum of four product pricing options is permitted.");
 const examples=[];
 for(const [index,row] of normalized.products.entries()){
  const label="Product "+(index+1);
  const title=row.title.trim();
  const wholesale=cents(row.wholesale),retail=cents(row.retail),quantity=Number(row.quantity);
  if(modern&&!title)errors.push(label+": enter the product title, such as Gildan 18500 hoodie.");
  if(modern&&title.length>80)errors.push(label+": title is too long.");
  if(wholesale===null)errors.push(label+": enter a verified decorated wholesale price with no more than two decimals.");
  if(retail===null)errors.push(label+": enter the approved retail price with no more than two decimals.");
  if(!/^[1-9]\d{0,4}$/.test(String(row.quantity).trim())||!Number.isSafeInteger(quantity)||quantity>10000)
   errors.push(label+": enter an illustrative quantity of 1–10,000.");
  if(wholesale!==null&&retail!==null&&retail<wholesale)errors.push(label+": retail price cannot be below decorated wholesale.");
  if(wholesale===null||retail===null||!Number.isSafeInteger(quantity)||quantity<1||quantity>10000||retail<wholesale)continue;
  const perItem=retail-wholesale,total=perItem*quantity;
  examples.push({title,wholesale:money(wholesale),retail:money(retail),perItem:money(perItem),quantity,total:money(total),totalCents:total});
 }
 if(errors.length)return {enabled:true,ready:false,errors,example:null,examples:[]};
 const grandTotal=money(examples.reduce((sum,row)=>sum+row.totalCents,0));
 // Keep the old single-product response stable for existing drafts/tests.
 if(!modern){
  const {wholesale,retail,perItem,quantity,total}=examples[0];
  return {enabled:true,ready:true,errors:[],example:{wholesale,retail,perItem,quantity,total}};
 }
 return {enabled:true,ready:true,errors:[],example:examples[0]||null,examples,grandTotal};
}
