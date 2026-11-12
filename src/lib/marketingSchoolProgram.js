/** Optional financial illustration, never an auto-quoted or guaranteed fundraising figure.
 * A row is visible only after a user explicitly confirms the underlying pricing.
 */
export function verifiedFundraisingRows(rows){
 if(!Array.isArray(rows))return [];
 const result=[];
 for(const row of rows.slice(0,5)){
  if(row?.verified!==true)continue;
  const product=String(row.product||"").trim().slice(0,80);
  const cost=Number(row.wholesale),retail=Number(row.retail),qty=Number(row.quantity);
  if(!product||!Number.isFinite(cost)||!Number.isFinite(retail)||!Number.isSafeInteger(qty)||qty<1||qty>100000||cost<0||retail<cost||retail>100000||cost>100000)continue;
  const profitCents=Math.round((retail-cost)*100)*qty;
  result.push({product,wholesale:cost,retail,quantity:qty,profit:profitCents/100,perItemMargin:Math.round((retail-cost)*100)/100});
 }
 return result;
}
export function schoolArtworkServiceOptions(){
 return ["Logo refresh & alternate versions","Fall, winter & spring collections","Sport and team-specific artwork","Clubs, activities & special events"];
}
