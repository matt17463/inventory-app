/** Review gates for marketing proofs. These check missing evidence; they do not grant client approval. */
export function marketingFlyerChecks({organization,logo,colors,productImages,headline,cta,contact,heroImage,category,artworkOptions=[]}={}){
 const checks=[];
 const add=(id,pass,message)=>checks.push({id,pass:Boolean(pass),message});
 const validImage=x=>/^data:image\/(?:png|jpeg|webp);base64,[a-z\d+/=]+$/i.test(x||"");
 const palette=Array.isArray(colors)?colors.filter(x=>/^#[0-9a-f]{6}$/i.test(x)):[];
 add("client",String(organization||"").trim().length>1,"A CRM client / school must be selected.");
 add("logo",validImage(logo),"An approved school logo must be selected.");
 add("palette",palette.length>=2,"Provide at least two verified school HEX colors.");
 add("products",(Array.isArray(productImages)?productImages:[]).filter(validImage).length>0,"Add at least one verified decorated merchandise photo.");
 add("headline",String(headline||"").trim().length>=8,"Review the flyer headline.");
 add("cta",String(cta||"").trim().length>=8,"Provide an actionable, verified call to action.");
 add("contact",String(contact||"").trim().length>2,"Provide verified contact details before client distribution.");
 if(category==="school")add("artwork-services",(Array.isArray(artworkOptions)?artworkOptions:[]).filter(x=>String(x||"").trim().length>3).length>=2,"Include the artwork modernization, seasonal, sports and club-specific design options.");
 // Scenery is optional because generic licensed artwork should never be substituted for a school's actual environment.
 const scenery=validImage(heroImage);
 return {checks,passed:checks.every(x=>x.pass),missing:checks.filter(x=>!x.pass),scenery};
}
export function imageDataUrlLooksSafe(value){
 return /^data:image\/(?:png|jpeg|webp);base64,[a-z\d+/=]+$/i.test(value||"");
}
