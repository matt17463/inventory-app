import {useEffect,useState} from "react";
import {authenticatedFunctionFetch} from "./lib/netlifyFunctionClient";
import {marketingImageDataUrl,marketingSharedImageUrl} from "./lib/marketingArtwork";
import {normalizeApparelPlacement,renderApparelComposite} from "./lib/marketingApparelComposite";

async function readBlankFile(file){
 if(!file||!["image/png","image/jpeg","image/webp"].includes(file.type)||file.size>5_000_000)throw Error("Choose a PNG, JPEG or WebP blank product photo under 5 MB.");
 const blob=await marketingImageDataUrl(file);
 const image=await new Promise((resolve,reject)=>{
  const loaded=new Image();loaded.onload=()=>resolve(loaded);loaded.onerror=()=>reject(Error("Could not read the blank photo."));loaded.src=blob;
 });
 if(image.naturalWidth<500||image.naturalHeight<500)throw Error("Blank photo needs at least 500 pixels on each side.");
 const canvas=document.createElement("canvas");
 const factor=Math.min(1,1600/Math.max(image.naturalWidth,image.naturalHeight));
 canvas.width=Math.round(image.naturalWidth*factor);canvas.height=Math.round(image.naturalHeight*factor);
 canvas.getContext("2d").drawImage(image,0,0,canvas.width,canvas.height);
 return canvas.toDataURL("image/jpeg",.86);
}
export default function MarketingApparelComposer({accountId,logo,onAdd,disabled=false,recipeToEdit=null}){
 const [blank,setBlank]=useState("");
 const [blankLabel,setBlankLabel]=useState("");
 const [placement,setPlacement]=useState({x:50,y:43,width:27});
 const [preview,setPreview]=useState("");
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 const [blanks,setBlanks]=useState([]);
 const [page,setPage]=useState(0);
 const [more,setMore]=useState(false);
 useEffect(()=>{
  if(!recipeToEdit?.blank)return;
  setBlank(recipeToEdit.blank);setBlankLabel(recipeToEdit.blankLabel||"Saved blank photo");
  setPlacement(normalizeApparelPlacement(recipeToEdit.placement));setPreview("");
  setMessage("Editing a saved marketing placement. Render and replace the mockup to update the flyer.");
 },[recipeToEdit]);
 async function uploadBlank(event){
  const file=event.target.files?.[0];event.target.value="";
  if(!file)return;
  setBusy(true);setMessage("");setPreview("");
  try{const image=await readBlankFile(file);setBlank(image);setBlankLabel(file.name);setMessage("Blank photo loaded. Adjust and review the logo placement before adding the mockup.");}
  catch(e){setMessage(e.message);}finally{setBusy(false);}
 }
 async function searchBlanks(nextPage=0){
  setBusy(true);setMessage("");
  try{
   const response=await authenticatedFunctionFetch("/.netlify/functions/marketing-shared-asset",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({account_id:accountId,action:"list_shared_blanks",page:nextPage})
   });
   const data=await response.json();
   if(!response.ok)throw Error(data.message||"Blank library unavailable.");
   setBlanks(Array.isArray(data.assets)?data.assets:[]);
   setPage(nextPage);setMore(Boolean(data.has_more));
   if(!data.assets?.length)setMessage("No additional shared blank images found.");
  }catch(e){setMessage(e.message);}finally{setBusy(false);}
 }
 async function selectBlank(item){
  setBusy(true);setMessage("");setPreview("");
  try{
   const url=await marketingSharedImageUrl(accountId,{source:"mockup_blank_assets",asset_id:item.id});
   const response=await fetch(url,{cache:"no-store",referrerPolicy:"no-referrer"});
   if(!response.ok)throw Error("Could not download the shared blank image.");
   const blob=await response.blob();
   const image=await readBlankFile(new File([blob],item.asset_name||"shared-blank.png",{type:blob.type}));
   setBlank(image);setBlankLabel(item.asset_name||item.product_type||"Shared blank");
   setMessage("Shared blank loaded. Confirm its garment and color match the intended product.");
  }catch(e){setMessage(e.message);}finally{setBusy(false);}
 }
 async function renderPreview(addToFlyer=false){
  if(!blank||!logo){setMessage("Choose a blank and an approved logo first.");return;}
  setBusy(true);setMessage("");
  try{
   const image=await renderApparelComposite({blank,logo,placement});
   setPreview(image);
   if(addToFlyer){
    onAdd(image,{blank,blankLabel,placement:normalizeApparelPlacement(placement),editIndex:Number.isInteger(recipeToEdit?.productIndex)?recipeToEdit.productIndex:null});
    setMessage("Composed mockup added to the flyer. Visual proof only: verify decoration size and placement before production.");
   }else setMessage("Mockup preview generated. Check garment color, logo, alignment and scale, then add it to the flyer.");
  }catch(e){setMessage(e.message);}finally{setBusy(false);}
 }
 const controls=[
  {id:"x",label:"Horizontal logo center",min:15,max:85},
  {id:"y",label:"Vertical logo center",min:15,max:85},
  {id:"width",label:"Logo width relative to photo",min:5,max:55},
 ];
 return <section className="growth-subcard" aria-label="Apparel mockup composer">
  <h4>Decorated apparel mockup composer</h4>
  <p>Apply the selected client's approved logo to a verified blank apparel photo. This creates a visual marketing proof, <strong>not</strong> a measured production placement or an AI-generated product photograph.</p>
  {!logo&&<p role="alert">Select or upload approved client logo artwork before composing a garment.</p>}
  <div className="growth-grid">
   <label className="growth-field"><span>Upload a licensed, undecorated product photo</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadBlank} disabled={busy||disabled}/></label>
   <div><button type="button" className="sc-btn" onClick={()=>searchBlanks(0)} disabled={busy||disabled||!accountId}>Browse shared R2 blank library</button>{blanks.length>0&&<div style={{maxHeight:180,overflow:"auto",marginTop:8}}>{blanks.map(item=><button type="button" key={item.id} disabled={busy||disabled} style={{display:"block",width:"100%",textAlign:"left",marginBottom:4}} onClick={()=>selectBlank(item)}>{item.asset_name||item.product_type||"Blank product"} · {item.product_color||"Color unspecified"}</button>)}{page>0&&<button type="button" disabled={busy} onClick={()=>searchBlanks(page-1)}>Previous blanks</button>}{more&&<button type="button" disabled={busy} onClick={()=>searchBlanks(page+1)}>More blanks</button>}</div>}</div>
  </div>
  {blank&&<div>
   <p><strong>Selected blank:</strong> {blankLabel}</p>
   <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}><button type="button" className="sc-btn" disabled={busy||disabled} onClick={()=>{setPlacement({x:50,y:43,width:27});setPreview("");}}>Center front</button><button type="button" className="sc-btn" disabled={busy||disabled} onClick={()=>{setPlacement({x:38,y:33,width:13});setPreview("");}}>Left-chest guide</button><button type="button" className="sc-btn" disabled={busy||disabled} onClick={()=>{setPlacement({x:50,y:53,width:36});setPreview("");}}>Full-front guide</button></div>
   <div className="growth-grid">
    {controls.map(field=><label key={field.id} className="growth-field"><span>{field.label}: {placement[field.id]}%</span><input type="range" min={field.min} max={field.max} step="1" value={placement[field.id]} onChange={e=>{setPlacement(p=>normalizeApparelPlacement({...p,[field.id]:Number(e.target.value)}));setPreview("");}}/></label>)}
   </div>
   <p>Preview represents flat artwork placed over the blank photo; it does not simulate fabric folds or confirm production measurements.</p>
   <div style={{display:"flex",gap:15,flexWrap:"wrap"}}>
    <div style={{width:220,position:"relative",flex:"0 0 220px",background:"#eef3f7"}}>
     <img src={blank} alt="Selected blank apparel" style={{display:"block",width:"100%"}}/>
     {logo&&<img src={logo} alt="Approved logo position guide" style={{position:"absolute",left:placement.x+"%",top:placement.y+"%",width:placement.width+"%",transform:"translate(-50%,-50%)",pointerEvents:"none"}}/>}
    </div>
    {preview&&<img src={preview} alt="Composed decorated apparel proof" style={{width:220,maxHeight:300,objectFit:"contain"}}/>}
   </div>
   <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:12}}>
    <button type="button" className="sc-btn" onClick={()=>renderPreview(false)} disabled={busy||disabled||!logo}>Render mockup preview</button>
    <button type="button" className="sc-btn" onClick={()=>renderPreview(true)} disabled={busy||disabled||!logo}>{recipeToEdit?"Replace saved mockup in flyer":"Add decorated mockup to flyer"}</button>
   </div>
  </div>}
  {message&&<p role="status">{message}</p>}
 </section>;
}
