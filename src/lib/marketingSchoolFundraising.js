/**
 * Illustrative school proceeds must only derive from operator-verified values.
 * "Wholesale" is the offered decorated wholesale price, not internal supplier cost.
 * Shipping, taxes, refunds and processing expenses are excluded intentionally.
 */
function cents(value){
 const text=String(value??"").trim();
 if(!/^(?:0|[1-9]\d{0,5})(?:\.\d{1,2})?$/.test(text))return null;
 const [whole,decimal=""]=text.split(".");
 return Number(whole)*100+Number((decimal+"00").slice(0,2));
}
export function schoolFundraisingExample(input={}){
 const enabled=input?.enabled===true;
 if(!enabled)return {enabled:false,ready:true,errors:[],example:null};
 const errors=[];
 const wholesale=cents(input.wholesale);
 const retail=cents(input.retail);
 const quantity=Number(input.quantity);
 if(wholesale===null)errors.push("Enter a verified decorated wholesale price with no more than two decimals.");
 if(retail===null)errors.push("Enter the approved retail price with no more than two decimals.");
 if(!/^[1-9]\d{0,4}$/.test(String(input.quantity??"").trim())||!Number.isSafeInteger(quantity)||quantity<1||quantity>10000)errors.push("Enter an illustrative quantity of 1–10,000.");
 if(wholesale!==null&&retail!==null&&retail<wholesale)errors.push("Retail price cannot be below the decorated wholesale price.");
 if(errors.length)return {enabled:true,ready:false,errors,example:null};
 const perItem=retail-wholesale;
 const total=perItem*quantity;
 const format=amount=>(amount/100).toLocaleString("en-US",{style:"currency",currency:"USD"});
 return {enabled:true,ready:true,errors:[],example:{wholesale:format(wholesale),retail:format(retail),perItem:format(perItem),quantity,total:format(total)}};
}
