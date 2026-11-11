/**
 * Original-flyer-inspired school spirit-wear composition.
 * One editable SVG artboard shared by browser preview and printed PDF cover.
 * All school identity, artwork, garment imagery, and prices come from approved inputs.
 */
const xml=s=>String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
const clip=(s,n)=>String(s??"").slice(0,n);
const color=s=>/^#[0-9a-f]{6}$/i.test(s||"")?s:"#06457b";
const contrast=h=>{const rgb=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));return rgb.reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0)<145?"#fff":"#111a2a";};
const txt=(s,x,y,size=16,fill="#fff",weight=800,anchor="middle",extra="")=>`<text x="${x}" y="${y}" fill="${fill}" text-anchor="${anchor}" font-family="Arial,Helvetica,sans-serif" font-size="${size}" font-weight="${weight}" ${extra}>${xml(s)}</text>`;
const img=(src,x,y,w,h)=>src?`<image href="${xml(src)}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/>`:"";
const brush=(x,y,w,h,fill)=>`<path d="M${x+5} ${y+7} L${x+w-18} ${y} L${x+w} ${y+9} L${x+w-8} ${y+h-8} L${x+17} ${y+h} L${x} ${y+h-10}Z" fill="${fill}"/>`;
const tree=(x,y,h,fill)=>`<path d="M${x} ${y} l${-h*.24} ${h*.38} h${h*.11} l${-h*.19} ${h*.27} h${h*.13} l${-h*.2} ${h*.31} h${h*.78} l${-h*.2} ${-h*.31} h${h*.13} l${-h*.19} ${-h*.27} h${h*.11}Z" fill="${fill}"/>`;
const money=n=>"$"+Number(n||0).toFixed(2);
export function schoolFlyerSvg(d){
 const p=color(d.colors?.[0]),s=color(d.colors?.[1]||"#f4d51a"),bright=contrast(s),school=clip(d.organization||"YOUR SCHOOL",33).toUpperCase();
 const title=clip(d.headline||"BIG SCHOOL SPIRIT.",31).toUpperCase();
 const subtitle=clip(d.tagline||"LESS WORK FOR YOUR PTO.",39).toUpperCase();
 const products=(d.products||[]).slice(0,5);
 const treeLine=Array.from({length:18},(_,i)=>tree(i*37-5,173+(i%3)*7,47+(i*7)%39,i%2?p:s)).join("");
 const row=products.slice(0,2).map((item,i)=>{
  const tier=item.tiers?.[0]||{};
  const wholesale=Number(tier.wholesale||0),retail=Number(tier.retail||0);
  return `${i%2?'<rect x="315" y="557" width="260" height="17" fill="#e8eef4"/>':'<rect x="315" y="538" width="260" height="17" fill="#fff"/>'}${txt(clip(item.name,20),323,551+i*19,10,"#152039",700,"start")}${txt(money(wholesale),467,551+i*19,9,"#152039",700)}${txt(money(retail),522,551+i*19,9,"#152039",700)}${txt(money(retail-wholesale),565,551+i*19,9,"#c32828",900)}`;
 }).join("");
 const sample=products[1]?.tiers?.[0],profit=sample?Number(sample.retail)-Number(sample.wholesale):0;
 const garment=products.map((product,i)=>{const slots=products.length>3?[[18,277,154,118],[124,267,160,127],[245,277,154,118],[361,279,128,113],[478,288,106,102]]:[[46,263,183,130],[219,263,183,130],[392,263,183,130]];const [x,y,w,h]=slots[i];return `<g filter="url(#productShadow)">${img(product.mockup,x,y,w,h)}</g>`;}).join("");
 const benefits=[["★","BUILD SCHOOL PRIDE","Unite students, families","staff and fans."],["▰","SUPPORT PROGRAMS","Raise funds for activities","and enrichment."],["▣","EASY FOR FAMILIES","Simple ordering, production","and fulfillment."]];
 const benefitsSvg=benefits.map((b,i)=>{const x=107+i*200;return `${txt(b[0],x,424,29,s)}${txt(b[1],x,446,13,"#fff",900)}${txt(b[2],x,463,10)}${txt(b[3],x,476,10)}`;}).join("");
 const steps=[["1","PLAN","Choose apparel and prices"],["2","BUILD","Launch your school store"],["3","ORDER","Families shop online"],["4","SUPPORT","School receives proceeds"]];
 const stepsSvg=steps.map((v,i)=>{const y=542+i*24;return `<circle cx="41" cy="${y-4}" r="10" fill="${p}"/>${txt(v[0],41,y,11)}${txt(v[1],61,y,12,"#111827",900,"start")}${txt(clip(v[2],26),123,y,8.1,"#27364b",600,"start")}`;}).join("");
 const w=d.contact?.website||"skilledcrafting.com",contact=[d.contact?.phone,d.contact?.email].filter(Boolean);
 const mountains=`<path d="M0 159 L61 91 97 120 157 58 223 126 285 76 349 126 407 66 468 117 538 71 612 149V244H0Z" fill="#d9ecf7" opacity=".86"/><path d="M0 186L73 117 127 160 207 94 269 161 345 112 413 168 502 93 612 181V256H0Z" fill="${p}" opacity=".34"/>`;
 const background=d.backgroundArtwork?img(d.backgroundArtwork,0,61,612,331):mountains+treeLine;
 const brand=img(d.businessLogo,18,10,82,43);
 const logo=img(d.heroArtwork||d.schoolLogo,15,61,172,152);
 const schoolSize=school.length>24?27:school.length>16?32:38;
 const schoolBottom=school.endsWith("HIGH SCHOOL")?"HIGH SCHOOL":school.endsWith("MIDDLE SCHOOL")?"MIDDLE SCHOOL":school.endsWith("ELEMENTARY")?"ELEMENTARY":"";
 const schoolTop=schoolBottom?school.slice(0,-schoolBottom.length).trim():school;
 const headlineSize=title.length>26?15:20;
 return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="612" height="792" viewBox="0 0 612 792">
 <defs><linearGradient id="hero" x2="1" y2="1"><stop stop-color="${p}"/><stop offset=".45" stop-color="${s}"/><stop offset="1" stop-color="${p}"/></linearGradient>
 <linearGradient id="lower" x2="0" y2="1"><stop stop-color="#fff"/><stop offset="1" stop-color="#edf3fa"/></linearGradient>
 <filter id="shadow"><feDropShadow dx="1" dy="3" stdDeviation="3" flood-opacity=".35"/></filter><filter id="productShadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="1" dy="5" stdDeviation="4" flood-color="#061b30" flood-opacity=".45"/></filter><filter id="paint" x="-5%" y="-15%" width="110%" height="130%"><feTurbulence baseFrequency=".025" numOctaves="2" seed="8" result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale="5"/></filter></defs>
 <rect width="612" height="792" fill="url(#lower)"/><rect width="612" height="397" fill="url(#hero)"/>
 ${background}
 <rect width="612" height="61" fill="${p}"/>${brand}
 ${txt("SKILLED CRAFTING",114,29,19,"#fff",900,"start")}
 ${txt("CUSTOM APPAREL  |  PRINTING  |  PERSONALIZATION",115,45,8,"#fff",700,"start")}
 <rect x="444" y="11" width="3" height="39" fill="${s}"/>
 ${txt("YOUR LOCAL",461,24,10,"#fff",900,"start")}${txt("SCHOOL SPIRIT",461,36,10,"#fff",900,"start")}${txt("WEAR PARTNER",461,48,10,"#fff",900,"start")}
 <rect x="0" y="59" width="612" height="4" fill="${s}"/>
 ${logo}
 <g filter="url(#shadow)"><path d="M193 75 L592 68 L587 157 L197 159Z" fill="${p}" stroke="#fff" stroke-width="4"/></g>
 ${txt(schoolTop,394,schoolBottom?111:121,schoolSize,"#fff",900,"middle",'stroke="'+p+'" stroke-width="1.5" paint-order="stroke"')}
 ${schoolBottom?txt(schoolBottom,394,141,24,"#fff",900,"middle",'font-style="italic"'):""}
 <g filter="url(#paint)">${brush(189,171,406,60,s)}</g>
 ${txt(title,392,196,headlineSize,bright,900,"middle",'font-style="italic"')}
 ${txt(subtitle,392,218,12,bright,900,"middle",'font-style="italic"')}
 ${txt("A SIMPLE, TURNKEY SPIRIT WEAR PROGRAM",306,241,10,"#ffffff",900)}
 ${txt("THAT BUILDS PRIDE AND SUPPORTS SCHOOL PROGRAMS.",306,254,9,"#ffffff",800)}
 <rect x="22" y="260" width="568" height="135" fill="#fff" opacity=".28" rx="12"/>${garment}
 <path d="M0 397L612 390V488H0Z" fill="${p}"/><path d="M0 393L612 388" stroke="#fff" stroke-width="6"/>
 ${benefitsSvg}
 <path d="M205 418V476M406 418V476" stroke="#fff" stroke-width="1" opacity=".65"/>
 ${brush(20,490,267,27,p)}${brush(305,490,282,27,p)}
 ${txt("HOW IT WORKS",150,509,17,"#fff",900,"middle",'font-style="italic"')}
 ${txt("FUNDRAISING EXAMPLE",448,509,16,"#fff",900,"middle",'font-style="italic"')}
 <rect x="17" y="518" width="274" height="105" rx="8" fill="#fff"/>
 ${stepsSvg}
 <rect x="307" y="518" width="284" height="105" rx="8" fill="#fff"/>
 <rect x="315" y="520" width="260" height="17" fill="${p}"/>
 ${txt("ITEM",323,532,8,"#fff",800,"start")}${txt("WHOLESALE",465,532,7,"#fff",800)}${txt("RETAIL",522,532,7,"#fff",800)}${txt("PROFIT",565,532,7,"#fff",800)}
 ${row}
 ${brush(321,580,260,34,s)}
 ${txt("75 ITEMS COULD RAISE "+money(profit*75),451,594,11,bright,900)}
 ${txt("ILLUSTRATIVE SCHOOL PROCEEDS*",451,608,8,bright,800)}
 ${brush(18,631,577,33,p)}
 ${txt("ARTWORK MODERNIZATION & YEARLY DESIGNS",306,655,15,"#fff",900,"middle",'font-style="italic"')}
 <rect x="18" y="669" width="575" height="71" fill="#fff" rx="8"/>
 ${img(d.schoolLogo,31,671,80,64)}
 ${txt("»",125,718,39,s,900)}
 ${img(d.heroArtwork||d.schoolLogo,148,671,80,64)}
 ${txt("✓  Refresh and modernize school artwork",248,690,11,"#102640",800,"start")}
 ${txt("✓  Create seasonal, sport and event designs",248,708,11,"#102640",800,"start")}
 ${txt("✓  Support student and staff collections",248,726,11,"#102640",800,"start")}
 <rect x="0" y="744" width="612" height="48" fill="${p}"/>
 ${txt("LET'S BRING SCHOOL SPIRIT TO LIFE!",24,766,17,"#fff",900,"start",'font-style="italic"')}
 ${contact.slice(0,2).map((v,i)=>txt(clip(v,34),419,758+i*13,9,"#fff",700,"start")).join("")}
 ${txt(clip(w,36),419,784,9,"#fff",700,"start")}
 <text x="307" y="620" font-family="Arial" font-size="6.2" fill="#48566c">*Illustrative only. Final proceeds, taxes and terms require approval.</text>
 </svg>`;
}
export async function schoolFlyerPng(d){
 const svg=schoolFlyerSvg(d),blob=new Blob([svg],{type:"image/svg+xml;charset=utf-8"});
 const url=URL.createObjectURL(blob);
 try{
  const image=await new Promise((resolve,reject)=>{const el=new Image();el.onload=()=>resolve(el);el.onerror=()=>reject(Error("Flyer artwork could not be rendered."));el.src=url;});
  const canvas=document.createElement("canvas");canvas.width=2550;canvas.height=3300;
  const ctx=canvas.getContext("2d");if(!ctx)throw Error("Print-resolution flyer canvas is unavailable.");ctx.drawImage(image,0,0,canvas.width,canvas.height);
  return canvas.toDataURL("image/png");
 }finally{URL.revokeObjectURL(url);}
}
