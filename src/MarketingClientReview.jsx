import {useEffect,useState} from "react";
export default function MarketingClientReview(){
 const token=new URLSearchParams(window.location.search).get("token")||"";
 const [reviewData,setDocument]=useState(null);
 const [message,setMessage]=useState("");
 const [feedback,setFeedback]=useState("");
 const [selectedLogoOption,setSelectedLogoOption]=useState("");
 const [busy,setBusy]=useState(false);
 useEffect(()=>{
  const meta=document.createElement("meta");
  meta.name="referrer";meta.content="no-referrer";document.head.appendChild(meta);
  return ()=>meta.remove();
 },[]);
 useEffect(()=>{
  if(!token){setMessage("Review link missing.");return;}
  let active=true;
  fetch("/.netlify/functions/marketing-review-link?token="+encodeURIComponent(token))
   .then(async r=>{const x=await r.json();if(!r.ok)throw Error(x.message||"Review unavailable.");return x;})
   .then(x=>{if(active)setDocument(x);})
   .catch(e=>{if(active)setMessage(e.message);});
  return ()=>{active=false;};
 },[token]);
 async function respond(decision){
  if(decision==="approved" && (reviewData?.content?.logo_option_urls||[]).length>1 && !selectedLogoOption){
    setMessage("Select the approved artwork option before approving this concept.");return;
  }
  try{setBusy(true);setMessage("");
   const r=await fetch("/.netlify/functions/marketing-review-response",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({token,decision,feedback:[
      ...(selectedLogoOption?["Selected logo option: "+selectedLogoOption]:[]),feedback
    ].filter(Boolean).join("\n").slice(0,2000)})
   });
   const x=await r.json();if(!r.ok)throw Error(x.message||"Review failed.");
   setDocument(null);setMessage("Thank you. Your feedback has been recorded.");
  }catch(e){setMessage(e.message);}finally{setBusy(false);}
 }
 return <main style={{maxWidth:860,margin:"40px auto",padding:24,fontFamily:"system-ui"}}>
  <p>SKILLED CRAFTING · CLIENT REVIEW</p><h1>{reviewData?.title||"Document review"}</h1>
  {message&&<p role="status">{message}</p>}
  {reviewData&&<><p>Draft for your review. Reviewing does not place an order or approve production.</p>
   <h2>{reviewData.content.organization}</h2>{reviewData.content.logo_url&&<img src={reviewData.content.logo_url} alt="Client artwork for concept review" style={{maxWidth:280,maxHeight:260,objectFit:"contain",display:"block",margin:"16px 0"}}/>}<p style={{whiteSpace:"pre-wrap"}}>{reviewData.content.description}</p>
   <p>{reviewData.content.style}</p><p>Sizes: {reviewData.content.sizes||"To be confirmed"}</p>
   <p>Colors: {reviewData.content.productColors||"To be confirmed"}</p>
   {(reviewData.content.sections || []).map(({heading,value}) => <section key={heading}>
     <h3>{heading}</h3><p style={{whiteSpace:"pre-wrap"}}>{value}</p>
   </section>)}
   {reviewData.content.aiText && <section><h3>Document copy</h3><p style={{whiteSpace:"pre-wrap"}}>{reviewData.content.aiText}</p></section>}
   {(reviewData.content.product_image_urls||[]).length>0 && <section><h3>Product catalog photographs</h3>
     <div style={{display:"flex",flexWrap:"wrap",gap:14}}>
       {reviewData.content.product_image_urls.map((url,i)=><figure key={i} style={{margin:0,padding:8,border:"1px solid #ccd5d9"}}>
         <img src={url} alt={"Catalog product "+(i+1)} style={{maxWidth:200,maxHeight:190,objectFit:"contain",display:"block"}}/>
         <figcaption>{reviewData.content.productRows?.[i]?.name||"Product "+(i+1)}</figcaption>
       </figure>)}
     </div>
   </section>}
   {reviewData.content.product_image_url && <section><h3>Selected product / approved concept image</h3>
     <img src={reviewData.content.product_image_url} alt="Client-selected product or mockup" style={{maxWidth:"100%",maxHeight:350,objectFit:"contain"}}/></section>}
   {(reviewData.content.logo_option_urls||[]).length>0 && <section><h3>Artwork options</h3><div style={{display:"flex",flexWrap:"wrap",gap:16}}>
     {reviewData.content.logo_option_urls.map((url,i)=><figure key={i} style={{margin:0,padding:12,border:"1px solid #ccd5d9",borderRadius:8}}>
       <img src={url} alt={"Artwork option "+(i+1)} style={{maxWidth:230,maxHeight:170,objectFit:"contain",display:"block"}}/>
       <figcaption><label><input type="radio" name="approved-logo-option" value={String(i+1)}
         checked={selectedLogoOption===String(i+1)} onChange={()=>setSelectedLogoOption(String(i+1))}/>
         Select option {i+1}</label></figcaption></figure>)}
   </div></section>}
   {(reviewData.content.productRows||[]).length>0 && <section><h3>Proposed products and client pricing</h3><div style={{overflowX:"auto"}}>
     <table style={{borderCollapse:"collapse",width:"100%"}}><thead><tr>{["Product","SKU","Sizes","Colors","Quantity","Client unit price","Line total"].map(h=><th key={h} scope="col" style={{textAlign:"left",padding:8,borderBottom:"1px solid #9ba8ad"}}>{h}</th>)}</tr></thead>
     <tbody>{reviewData.content.productRows.map((p,i)=><tr key={i}>
       <td style={{padding:8}}>{p.name}</td><td>{p.sku}</td><td>{p.sizes}</td><td>{p.colors}</td><td>{p.quantity??"TBC"}</td>
       <td>{p.retailPrice===null?"TBC":"$"+p.retailPrice.toFixed(2)}</td>
       <td>{p.quantity!==null&&p.retailPrice!==null?"$"+(p.quantity*p.retailPrice).toFixed(2):"TBC"}</td></tr>)}</tbody></table>
   </div></section>}
   {!(reviewData.content.productRows||[]).length && reviewData.content.retailPrice!==null &&
     <p>Client unit price: ${Number(reviewData.content.retailPrice).toFixed(2)}
       {reviewData.content.quantity?" · Quantity: "+reviewData.content.quantity:""}</p>}
   {reviewData.content.placement && <p>Proposed decoration placement: {reviewData.content.placement}</p>}
   {(reviewData.content.productSwatches||[]).length>0 && <section><h3>Product color chart</h3><div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
     {reviewData.content.productSwatches.map((c,i)=><div key={i}><span style={{display:"block",width:105,height:55,background:c.hex,border:"1px solid #ccd5d9"}}/>
       <strong>{c.name}</strong><small style={{display:"block"}}>{c.hex}</small></div>)}
   </div><small>Visual approximation only; verify actual garment colors with physical samples.</small></section>}
   {reviewData.content.terms && <section><h3>Terms and approvals</h3><p style={{whiteSpace:"pre-wrap"}}>{reviewData.content.terms}</p></section>}
   {reviewData.content.cta && <section><h3>Next step</h3><p>{reviewData.content.cta}</p></section>}
   <h3>Suggested brand colors</h3><div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
   {(reviewData.content.branding?.colors||[]).map(c=><span key={c} style={{display:"inline-flex",alignItems:"center",gap:8}}><span style={{height:25,width:25,background:/^#[0-9a-f]{6}$/i.test(c)?c:"#fff",border:"1px solid #888"}}/>{c}</span>)}</div>
   <h3>Notes or requested changes</h3>
   <textarea aria-label="Client feedback" rows={5} value={feedback} onChange={e=>setFeedback(e.target.value)} style={{display:"block",width:"100%",marginBottom:16}}/>
   <button disabled={busy||((reviewData.content.logo_option_urls||[]).length>1&&!selectedLogoOption)} onClick={()=>respond("approved")}>Approve concept</button>{" "}
   <button disabled={busy||!feedback.trim()} onClick={()=>respond("changes_requested")}>Request changes</button>
   <p><small>Concept approval is not a purchase or production authorization. Review links expire and are single-use.</small></p>
  </>}
 </main>;
}
