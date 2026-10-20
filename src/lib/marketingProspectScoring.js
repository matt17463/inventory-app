/** Explainable, provisional marketing fit score. Not a purchase-intent prediction.
 * Evidence must be manually verified; this never invents company size or contacts.
 */
export function scoreMarketingProspect(prospect, {industry="",region="",query=""}={}) {
  const name=String(prospect?.name||"").trim();
  const site=String(prospect?.website||"").trim();
  const location=String(prospect?.location||"").toLowerCase();
  const reason=String(prospect?.reason||"").toLowerCase();
  if(!name||!/^https?:\/\//i.test(site))return {score:0,priority:"Review needed",reasons:["No usable organization website or name"],provisional:true};
  let score=20;
  const reasons=["Public organization website provided (+20)"];
  const words=s=>String(s||"").toLowerCase().split(/[^a-z0-9]+/).filter(w=>w.length>=4);
  const geo=words(region);
  if(geo.length&&geo.some(w=>location.includes(w))){score+=25;reasons.push("Location overlaps requested territory (+25)");}
  const category=words(industry);
  if(category.length&&category.some(w=>reason.includes(w)||name.toLowerCase().includes(w))){score+=25;reasons.push("Organization activity aligns with requested category (+25)");}
  const terms=words(query);
  if(terms.length&&terms.some(w=>reason.includes(w))){score+=15;reasons.push("Research summary aligns with additional criteria (+15)");}
  if(/team|uniform|school|spirit|club|event|volunteer|branded|fundrais/i.test(reason)){score+=15;reasons.push("Possible apparel or merchandise use in research summary (+15)");}
  return {score:Math.min(score,100),priority:score>=75?"High potential fit":score>=45?"Potential fit":"Research further",reasons,provisional:true};
}
