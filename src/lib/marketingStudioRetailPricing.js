/** Verified client-facing product options for commercial/event collateral. No supplier cost. */
const parseCents=value=>{
 const s=String(value??"").trim();
 if(!/^(?:0|[1-9]\d{0,5})(?:\.\d{1,2})?$/.test(s))return null;
 const [whole,decimal=""]=s.split(".");
 return Number(whole)*100+Number((decimal+"00").slice(0,2));
};
const money=value=>(value/100).toLocaleString("en-US",{style:"currency",currency:"USD"});
export const blankStudioRetailRow=()=>({title:"",retail:"",quantity:"1"});
export const defaultStudioRetailPricing=()=>({enabled:false,products:[blankStudioRetailRow()]});
export function normalizeStudioRetailPricing(value={}){
 const input=value&&typeof value==="object"?value:{};
 const raw=Array.isArray(input.products)&&input.products.length?input.products.slice(0,4):[blankStudioRetailRow()];
 return {enabled:input.enabled===true,products:raw.map(row=>({
  title:String(row?.title??"").slice(0,80),retail:String(row?.retail??""),quantity:String(row?.quantity??"1")
 }))};
}
export function validateStudioRetailPricing(input={}){
 if(input?.enabled!==true)return {enabled:false,ready:true,errors:[],examples:[],grandTotal:""};
 const normalized=normalizeStudioRetailPricing(input);
 const errors=[],examples=[];
 if(!Array.isArray(input.products)||input.products.length>4||!input.products.length)errors.push("Choose between one and four verified retail pricing options.");
 for(const [index,row] of normalized.products.entries()){
  const heading="Product "+(index+1);
  const title=row.title.trim(),price=parseCents(row.retail),quantity=Number(row.quantity);
  if(!title)errors.push(heading+": enter the approved product title.");
  if(price===null)errors.push(heading+": enter an approved retail price with no more than two decimals.");
  if(!/^[1-9]\d{0,4}$/.test(row.quantity.trim())||!Number.isSafeInteger(quantity)||quantity>10000)
   errors.push(heading+": enter an illustrative quantity of 1–10,000.");
  if(title&&price!==null&&Number.isSafeInteger(quantity)&&quantity>=1&&quantity<=10000)
   examples.push({title,retail:money(price),quantity,total:money(price*quantity),totalCents:price*quantity});
 }
 return errors.length?{enabled:true,ready:false,errors,examples:[],grandTotal:""}:
  {enabled:true,ready:true,errors:[],examples,grandTotal:money(examples.reduce((sum,row)=>sum+row.totalCents,0))};
}
