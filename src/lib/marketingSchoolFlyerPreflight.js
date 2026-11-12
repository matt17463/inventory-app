/**
 * Preflight of factual client-facing school flyer content.
 * No server approval is implied: mockups and tier prices must also be confirmed
 * by an authorized human before distributing an approved document.
 */
export function schoolFlyerPreflight(d) {
 const errors=[];
 const present=v=>typeof v==="string"&&v.trim().length>0;
 const validPrice=v=>present(String(v??""))&&Number.isFinite(Number(v))&&Number(v)>=0;
 if(!present(d.organization))errors.push("Select a named school.");
 if(!present(d.schoolLogo))errors.push("Select approved school logo artwork.");
 if(!Array.isArray(d.colors)||!d.colors.some(c=>/^#[0-9a-f]{6}$/i.test(c)))errors.push("Confirm the school's brand color.");
 if(!present(d.businessLogo))errors.push("Provide the Skilled Crafting logo.");
 if(!present(d.contact?.website)&&!present(d.contact?.email)&&!present(d.contact?.phone))errors.push("Provide a verified contact method.");
 if(!Array.isArray(d.products)||!d.products.length)errors.push("Add at least one product.");
 if(Array.isArray(d.products)&&d.products.length>5)errors.push("The illustrated cover supports at most five visible product mockups; reduce the selection before preview.");
 for(const [index,p] of (d.products||[]).entries()){
  const item=`Product ${index+1}`;
  if(!present(p.name))errors.push(`${item}: enter a verified product name.`);
  if(!present(p.mockup))errors.push(`${item}: render or select an approved decorated mockup.`);
  if(!Array.isArray(p.tiers)||!p.tiers.length)errors.push(`${item}: enter approved wholesale and retail prices.`);
  for(const [j,t] of (p.tiers||[]).entries()){
   if(!Number.isInteger(Number(t.min))||Number(t.min)<1||!validPrice(t.wholesale)||!validPrice(t.retail)||Number(t.retail)<Number(t.wholesale))errors.push(`${item}, tier ${j+1}: confirm minimum quantity and nonnegative prices with retail at least wholesale.`);
  }
 }
 return {ready:errors.length===0,errors};
}
