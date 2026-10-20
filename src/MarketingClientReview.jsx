import {useEffect,useState} from "react";
export default function MarketingClientReview(){
 const token=new URLSearchParams(window.location.search).get("token")||"";
 const [document,setDocument]=useState(null);
 const [message,setMessage]=useState("");
 const [feedback,setFeedback]=useState("");
 const [busy,setBusy]=useState(false);
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
  try{setBusy(true);setMessage("");
   const r=await fetch("/.netlify/functions/marketing-review-response",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({token,decision,feedback})
   });
   const x=await r.json();if(!r.ok)throw Error(x.message||"Review failed.");
   setDocument(null);setMessage("Thank you. Your feedback has been recorded.");
  }catch(e){setMessage(e.message);}finally{setBusy(false);}
 }
 return <main style={{maxWidth:860,margin:"40px auto",padding:24,fontFamily:"system-ui"}}>
  <p>SKILLED CRAFTING · CLIENT REVIEW</p><h1>{document?.title||"Document review"}</h1>
  {message&&<p role="status">{message}</p>}
  {document&&<><p>Draft for your review. Reviewing does not place an order or approve production.</p>
   <h2>{document.content.organization}</h2><p style={{whiteSpace:"pre-wrap"}}>{document.content.description}</p>
   <p>{document.content.style}</p><p>Sizes: {document.content.sizes||"To be confirmed"}</p>
   <p>Colors: {document.content.productColors||"To be confirmed"}</p>
   <h3>Suggested brand colors</h3><div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
   {(document.content.branding?.colors||[]).map(c=><span key={c} style={{display:"inline-flex",alignItems:"center",gap:8}}><span style={{height:25,width:25,background:/^#[0-9a-f]{6}$/i.test(c)?c:"#fff",border:"1px solid #888"}}/>{c}</span>)}</div>
   <h3>Notes or requested changes</h3>
   <textarea aria-label="Client feedback" rows={5} value={feedback} onChange={e=>setFeedback(e.target.value)} style={{display:"block",width:"100%",marginBottom:16}}/>
   <button disabled={busy} onClick={()=>respond("approved")}>Approve concept</button>{" "}
   <button disabled={busy||!feedback.trim()} onClick={()=>respond("changes_requested")}>Request changes</button>
   <p><small>Concept approval is not a purchase or production authorization. Review links expire and are single-use.</small></p>
  </>}
 </main>;
}
