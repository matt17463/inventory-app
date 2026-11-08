import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { growthWriteAllowed } from "./lib/marketingApi";
import { marketingTemplates, marketingSuppliers, suggestedBrandGuide, normalizeSupplierOffer } from "./lib/marketingCatalogPolicy";
import MarketingSupplierCompare from "./MarketingSupplierCompare";
import MarketingStorePreview from "./MarketingStorePreview";
import MarketingProgramDesigner from "./MarketingProgramDesigner";
import { generateMarketingDraft } from "./lib/marketingAI";
import { marketingDocumentMissing, parseMarketingColorSwatches, parseMarketingProductRows, renderMarketingDocumentHtml } from "./lib/marketingDocumentContent";
import { authenticatedFunctionFetch } from "./lib/netlifyFunctionClient";

/** Client-side printable draft; no uploads or external supplier requests. */
export default function MarketingDocumentStudio({ organizations = [], manager = false }) {
  const [template, setTemplate] = useState("brand-guide");
  const [organization, setOrganization] = useState("");
  const [accountId, setAccountId] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedDrafts, setSavedDrafts] = useState([]);
  const [saveStatus, setSaveStatus] = useState("");
  const [reviewLink,setReviewLink]=useState("");
  const [reviewHistory,setReviewHistory]=useState([]);
  const [historyDocument,setHistoryDocument]=useState(null);
  const [segment, setSegment] = useState("team");
  const [logo, setLogo] = useState("");
  const [colors, setColors] = useState("");
  const [description, setDescription] = useState("");
  const [supplier, setSupplier] = useState("sanmar");
  const [style, setStyle] = useState("");
  const [sku, setSku] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [observedAt, setObservedAt] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sizes, setSizes] = useState("");
  const [productColors, setProductColors] = useState("");
  const [guide, setGuide] = useState(null);
  const [error, setError] = useState("");
  const [aiBusy,setAiBusy] = useState(false);
  const [aiText,setAiText] = useState("");
  const [aiTone,setAiTone] = useState("professional");
  const [retailPrice,setRetailPrice] = useState("");
  const [quantity,setQuantity] = useState("");
  const [placement,setPlacement] = useState("");
  const [terms,setTerms] = useState("");
  const [cta,setCta] = useState("Contact Skilled Crafting to confirm the product selection, pricing and approval.");
  const [productImage,setProductImage] = useState("");
  const [logoOptions,setLogoOptions] = useState([]);
  const [productImages,setProductImages] = useState([]);
  const [productRowsText,setProductRowsText] = useState("");
  const [productSwatchesText,setProductSwatchesText] = useState("");
  const selectedTemplate=marketingTemplates.find(t=>t.id===template);
  const needsProductFields=["product","catalog","mockup","description","pricing","proposal","package","fundraiser","quote","store","color","artwork","sample","brochure"].includes(selectedTemplate?.kind);

  useEffect(() => {
    if (!accountId) return;
    let active=true;
    supabase.from("sc_growth_documents")
      .select("id,title,template_id,status,version,created_at,updated_at,content")
      .eq("account_id", accountId).order("created_at", {ascending:false}).limit(30)
      .then(({data,error}) => {
        if (!active) return;
        if (error) { setSaveStatus("Saved document list unavailable until the database migration is applied."); return; }
        setSavedDrafts(data||[]);
      });
    return () => { active=false; };
  },[accountId]);
  async function loadReviewHistory(document) {
    try {
      setError("");
      const response=await authenticatedFunctionFetch("/.netlify/functions/marketing-review-admin?document_id="+encodeURIComponent(document.id));
      const payload=await response.json();
      if(!response.ok) throw Error(payload.message||"Review history unavailable.");
      setReviewHistory(payload.reviews||[]);setHistoryDocument(document);
    } catch(error){setError(error.message);}
  }
  async function revokeReviewLink(id,document) {
    try {
      const response=await authenticatedFunctionFetch("/.netlify/functions/marketing-review-admin",{
        method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({review_id:id})
      });
      const payload=await response.json();
      if(!response.ok) throw Error(payload.message||"Cannot revoke link.");
      await loadReviewHistory(document);
      setSaveStatus("Review link revoked.");
    }catch(error){setError(error.message);}
  }
  async function createReviewLink(document) {
    try {
      if(!manager) throw Error("Manager role required.");
      const response=await authenticatedFunctionFetch("/.netlify/functions/marketing-review-link",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({document_id:document.id})
      });
      const result=await response.json();
      if(!response.ok) throw Error(result.message||"Unable to create link.");
      const url=new URL("/marketing-review?token="+encodeURIComponent(result.token),window.location.origin).toString();
      setReviewLink(url);setSaveStatus("Private client review link created. Expires in seven days.");
    } catch(error) {setError(error.message);}
  }
  async function approveDocument(document) {
    try {
      if(!manager) throw Error("Manager permission required.");
      const missing=marketingDocumentMissing(document.content||{});
      if(missing.length) throw Error("Cannot approve an incomplete document: "+missing.join(", ")+". Create a complete draft first.");
      if(!growthWriteAllowed()) {setSaveStatus("Training mode: approval not submitted.");return;}
      setSaving(true);setError("");
      const {error:rpcError}=await supabase.rpc("sc_growth_approve_document_v1",{
        p_id:document.id,p_expected_updated_at:document.updated_at,
      });
      if(rpcError) throw rpcError;
      const {data, error:refreshError}=await supabase.from("sc_growth_documents")
        .select("id,title,template_id,status,version,created_at,updated_at")
        .eq("account_id",accountId).order("created_at",{ascending:false}).limit(30);
      if(refreshError) throw refreshError;
      setSavedDrafts(data||[]);
      setSaveStatus("Document approved. Changes require a new draft.");
    }catch(error){setError(error.message||"Could not approve document.");}
    finally{setSaving(false);}
  }
  function uploadLogo(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 2_500_000) {
      setError("Choose a PNG, JPEG or WebP logo smaller than 2.5 MB."); return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result || "");
      setLogo(url);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 80; canvas.height = 80;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) return;
        context.drawImage(img, 0, 0, 80, 80);
        const pixels = context.getImageData(0, 0, 80, 80).data;
        const bucket = new Map();
        for (let i = 0; i < pixels.length; i += 4) {
          if (pixels[i+3] < 220) continue;
          const rgb = [pixels[i], pixels[i+1], pixels[i+2]];
          if (rgb.every(v => v > 242) || rgb.every(v => v < 14)) continue;
          const reduced = rgb.map(v => Math.min(255, Math.round(v / 24) * 24));
          const key = "#" + reduced.map(v => v.toString(16).padStart(2,"0")).join("").toUpperCase();
          bucket.set(key,(bucket.get(key)||0)+1);
        }
        setColors([...bucket].sort((a,b)=>b[1]-a[1]).slice(0,5).map(([hex])=>hex).join(", "));
      };
      img.src = url;
      setError("");
    };
    reader.readAsDataURL(file);
  }
  function readMarketingImage(file, callback) {
    if(!file)return;
    if(!["image/png","image/jpeg","image/webp"].includes(file.type) || file.size>2_500_000){
      setError("Choose a PNG, JPEG or WebP under 2.5 MB.");return;
    }
    const reader=new FileReader();
    reader.onload=()=>{callback(String(reader.result||""));setGuide(null);setError("");};
    reader.onerror=()=>setError("Unable to read image.");
    reader.readAsDataURL(file);
  }
  async function uploadLogoOptions(files) {
    const selected=Array.from(files||[]).slice(0,6);
    if(selected.some(f=>!["image/png","image/jpeg","image/webp"].includes(f.type)||f.size>2_500_000)){
      setError("Choose up to six PNG, JPEG or WebP artwork options under 2.5 MB each.");return;
    }
    try{
      const images=await Promise.all(selected.map(file=>new Promise((resolve,reject)=>{
        const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||""));
        reader.onerror=reject;reader.readAsDataURL(file);
      })));
      setLogoOptions(images);setGuide(null);setError("");
    }catch{setError("Unable to read the artwork options.");}
  }
  async function uploadProductImages(files) {
    const selected=Array.from(files||[]).slice(0,25);
    if(selected.some(f=>!["image/png","image/jpeg","image/webp"].includes(f.type)||f.size>2_500_000)){
      setError("Choose up to 25 PNG, JPEG or WebP catalog images under 2.5 MB each.");return;
    }
    try{
      const images=await Promise.all(selected.map(file=>new Promise((resolve,reject)=>{
        const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||""));
        reader.onerror=reject;reader.readAsDataURL(file);
      })));
      setProductImages(images);setGuide(null);setError("");
    }catch{setError("Unable to read selected product photographs.");}
  }
  async function assistWithAI() {
    try {
      setAiBusy(true);setError("");
      const result=await generateMarketingDraft({
        kind: selectedTemplate?.kind || "outreach",
        organization: organization.trim() || "Prospective client",
        segment, brief:description.trim(),tone:aiTone,
        context:{style,sku,sizes,productColors,retailPrice,quantity,placement,terms,cta,products:productRowsText.slice(0,1100)}
      });
      setAiText(result);setGuide(null);
    } catch(e){setError(e.message || "AI draft unavailable. Verify the Netlify AI provider configuration.");}
    finally{setAiBusy(false);}
  }
  function build() {
    try {
      const parsedColors = colors.split(",").map(s => s.trim()).filter(Boolean);
      const productRows=parseMarketingProductRows(productRowsText);
      const productSwatches=parseMarketingColorSwatches(productSwatchesText);
      const branding = suggestedBrandGuide(segment, parsedColors);
      let offer = null;
      if (template === "product-guide" && (style.trim() || sku.trim() || unitCost.trim())) {
        if (!sku.trim() || !unitCost.trim() || !observedAt)
          throw Error("Provide a verified supplier SKU, observed price and price date, or leave the product details blank.");
        offer = normalizeSupplierOffer({ supplier, sku: sku.trim(), unit_cost: unitCost,
          observed_at: observedAt, source_url: sourceUrl || undefined });
        if (sourceUrl && !/^https:\/\//i.test(sourceUrl)) throw Error("Provide an HTTPS supplier product URL.");
      }
      setGuide({ template, segment, organization: organization.trim() || "Prospective client", description, logo,
        branding, offer, style, sku, sizes, productColors, retailPrice, quantity, placement,
        terms, cta, productImage, productImages, logoOptions, productRows, productSwatches, aiText, generated_at: new Date().toISOString() });
      setError("");
    } catch (e) { setError(e.message); }
  }
  async function saveDraft() {
    if (!guide || !accountId) { setError("Select a saved client before storing this draft."); return; }
    try {
      if (!growthWriteAllowed()) { setSaveStatus("Training mode: draft not saved."); return; }
      setSaving(true); setError("");
      // Persist the exact uploaded raster in private R2, never as a public data URL.
      let storedArtwork = null;
      if(guide.logo){
        const match=/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(guide.logo);
        if(!match)throw Error("Choose a PNG, JPEG or WebP logo to save.");
        const response=await authenticatedFunctionFetch("/.netlify/functions/marketing-artwork-asset",{
          method:"POST",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({account_id:accountId,mime_type:match[1],base64:match[2]})
        });
        const result=await response.json();
        if(!response.ok||!result.asset)throw Error(result.message||"Private artwork upload failed.");
        storedArtwork=result.asset;
      }
      // Store uploaded document photos/options in private R2 as well. No base64 image bytes in Supabase.
      async function storeImage(dataUrl){
        if(!dataUrl)return null;
        const match=/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
        if(!match)throw Error("Use a valid uploaded image.");
        const response=await authenticatedFunctionFetch("/.netlify/functions/marketing-artwork-asset",{
          method:"POST",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({account_id:accountId,mime_type:match[1],base64:match[2]})
        });
        const result=await response.json();
        if(!response.ok||!result.asset)throw Error(result.message||"Document image upload failed.");
        return result.asset;
      }
      const storedProductImage=await storeImage(guide.productImage);
      const storedLogoOptions=await Promise.all((guide.logoOptions||[]).map(storeImage));
      const storedProductImages=[];
      for(const item of (guide.productImages||[])) storedProductImages.push(await storeImage(item));
      const { logo: unusedLocalImage, productImage: unusedLocalProductImage, productImages: unusedLocalGallery, logoOptions: unusedLocalOptions, offer: internalSupplierOffer, ...safeGuide } = guide;
      void unusedLocalImage;void unusedLocalProductImage;void unusedLocalGallery;void unusedLocalOptions;void internalSupplierOffer;
      const { error: insertError } = await supabase.from("sc_growth_documents").insert({
        account_id: accountId, template_id: template, title: (guide.organization + " — " + template).slice(0, 200),
        content: { ...safeGuide, marketing_artwork: storedArtwork, marketing_product_image:storedProductImage,
          marketing_product_images:storedProductImages, marketing_logo_options:storedLogoOptions, logo_upload_required: Boolean(guide.logo && !storedArtwork) }
      });
      if (insertError) throw insertError;
      setSaveStatus(storedArtwork?"Draft and exact client artwork saved securely to R2.":"Draft saved to this client.");
      const {data:latest} = await supabase.from("sc_growth_documents").select("id,title,template_id,status,version,created_at,content").eq("account_id",accountId).order("created_at",{ascending:false}).limit(30);
      if(latest) setSavedDrafts(latest);
    } catch(e) { setError(e.message || "Draft could not be saved."); }
    finally { setSaving(false); }
  }
  async function openSavedArtwork(documentRow){
    try{
      const key=documentRow.content?.marketing_artwork?.key;
      if(!key)throw Error("No stored artwork is associated with this document.");
      const query=new URLSearchParams({account_id:accountId,key});
      const response=await authenticatedFunctionFetch("/.netlify/functions/marketing-artwork-asset?"+query);
      const result=await response.json();
      if(!response.ok||!result.url)throw Error(result.message||"Unable to load stored artwork.");
      const anchor=document.createElement("a");anchor.href=result.url;anchor.target="_blank";anchor.rel="noopener noreferrer";anchor.click();
      setSaveStatus("Artwork link opened. Private image links expire after five minutes.");
    }catch(error){setError(error.message);}
  }
  function printGuide() {
    if (!guide) return;
    const markup=renderMarketingDocumentHtml(guide);
    const blob=new Blob([markup],{type:"text/html;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;
    a.download="skilled-crafting-"+guide.template+".html";a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  return <section className="sc-panel">
    <h2>Marketing Document Builder</h2>
    <p>Choose a starting template, add the client's details and generate a printable draft. AI-assisted copy is available for all templates when a server-side provider is configured. Uploaded artwork stays out of AI requests. Preview and resolve required fields before client approval.</p>
    <div className="growth-grid">
      <label className="growth-field"><span>Template</span><select value={template} onChange={e=>{setTemplate(e.target.value);setGuide(null);setAiText("");}}>
        {[...new Set(marketingTemplates.map(t=>t.category))].map(category=>
          <optgroup key={category} label={category}>{marketingTemplates.filter(t=>t.category===category).map(t=>
            <option key={t.id} value={t.id}>{t.label}</option>)}</optgroup>)}</select></label>
      <label className="growth-field"><span>Save under client</span><select value={accountId} onChange={e=>{const id=e.target.value;setAccountId(id);setGuide(null);setAiText("");const a=organizations.find(x=>x.id===id);if(a){setOrganization(a.organization);setSegment(a.segment==="club"?"team":a.segment==="other"?"business":a.segment);}}}><option value="">Select existing client</option>{organizations.map(o=><option key={o.id} value={o.id}>{o.organization}</option>)}</select></label>
      <label className="growth-field"><span>Client name</span><input value={organization} onChange={e=>{setOrganization(e.target.value);setGuide(null);setAiText("");}} list="marketing-studio-clients"/><datalist id="marketing-studio-clients">{organizations.map(o=><option key={o.id} value={o.organization}/>)}</datalist></label>
      <label className="growth-field"><span>Client type</span><select value={segment} onChange={e=>{setSegment(e.target.value);setAiText("");setGuide(null);}}>{["team","school","business","nonprofit"].map(t=><option key={t}>{t}</option>)}</select></label>
      <label className="growth-field"><span>Upload client's draft logo (optional)</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadLogo}/></label>
      <label className="growth-field"><span>Logo colors (editable HEX values, separated by commas)</span><input value={colors} onChange={e=>setColors(e.target.value)} placeholder="#008000, #000000"/></label>
      <label className="growth-field"><span>Client notes or product purpose</span><textarea value={description} onChange={e=>setDescription(e.target.value)}/></label>
    </div>
    {template==="product-guide" && <><MarketingSupplierCompare onChoose={item=>{setSupplier(Object.keys(marketingSuppliers).find(key=>marketingSuppliers[key].name===item.supplier_name)||"sanmar");setStyle(item.name);setSku(item.sku);setUnitCost(String(item.unit_cost));setObservedAt(item.observed_at.slice(0,10));setSourceUrl(item.source_url);setSizes(item.sizes.join(", "));setProductColors(item.colors.join(", "));setGuide(null);}}/><h3>Verified supplier product (optional until catalog feed is connected)</h3><div className="growth-grid">
      <label className="growth-field"><span>Supplier</span><select value={supplier} onChange={e=>setSupplier(e.target.value)}>{Object.entries(marketingSuppliers).map(([key,v])=><option key={key} value={key}>{v.name}</option>)}</select></label>
      <label className="growth-field"><span>Product name/style</span><input value={style} onChange={e=>setStyle(e.target.value)}/></label>
      <label className="growth-field"><span>Supplier SKU</span><input value={sku} onChange={e=>setSku(e.target.value)}/></label>
      <label className="growth-field"><span>Verified source cost per unit (internal)</span><input type="number" min="0" step="0.01" value={unitCost} onChange={e=>setUnitCost(e.target.value)}/></label>
      <label className="growth-field"><span>Price observed (date)</span><input type="date" value={observedAt} onChange={e=>setObservedAt(e.target.value)}/></label>
      <label className="growth-field"><span>Source URL</span><input type="url" value={sourceUrl} onChange={e=>setSourceUrl(e.target.value)}/></label>
      <label className="growth-field"><span>Verified sizes</span><input value={sizes} onChange={e=>setSizes(e.target.value)}/></label>
      <label className="growth-field"><span>Verified product colors</span><input value={productColors} onChange={e=>setProductColors(e.target.value)}/></label>
    </div></>}
    {["brochure-schools","product-catalog"].includes(template) &&
      <MarketingProgramDesigner key={template+"-"+accountId} mode={template} organization={organization} schoolLogo={logo}/>}
    {!["brochure-schools","product-catalog"].includes(template) && <>
    {needsProductFields && template!=="product-guide" && <div className="growth-grid">
      <label className="growth-field"><span>Client-facing product / style name</span><input value={style} onChange={e=>{setStyle(e.target.value);setGuide(null);}}/></label>
      <label className="growth-field"><span>Verified product SKU (optional)</span><input value={sku} onChange={e=>setSku(e.target.value)}/></label>
      <label className="growth-field"><span>Verified available sizes</span><input value={sizes} onChange={e=>setSizes(e.target.value)}/></label>
      <label className="growth-field"><span>Verified product colors</span><input value={productColors} onChange={e=>setProductColors(e.target.value)}/></label>
    </div>}
    <div className="growth-grid">
      <label className="growth-field"><span>Approved client unit price ($, not supplier cost)</span><input type="number" min="0" step="0.01" value={retailPrice} onChange={e=>setRetailPrice(e.target.value)}/></label>
      <label className="growth-field"><span>Quote / example quantity</span><input type="number" min="1" step="1" value={quantity} onChange={e=>setQuantity(e.target.value)}/></label>
      <label className="growth-field"><span>Artwork placement / approximate scale</span><input value={placement} onChange={e=>setPlacement(e.target.value)} placeholder="Left chest, 3.5 in (verify)"/></label>
      <label className="growth-field"><span>Additional itemized products (one per line: Product | SKU | Sizes | Colors | Client unit price | Quantity)</span>
        <textarea rows="4" value={productRowsText} onChange={e=>setProductRowsText(e.target.value)}
          placeholder={"T-shirt | 5000 | YS, YM, YL | Royal, Black | 19.99 | 20\\nHoodie | 18500 | S, M, L | Black | 34.99 | 10"}/></label>
      {template==="product-catalog" && <label className="growth-field">
        <span>Actual product photographs — one image per catalog line, in the same order (max 25)</span>
        <input type="file" multiple accept="image/png,image/jpeg,image/webp"
          onChange={e=>uploadProductImages(e.target.files)}/>
        <small>{productImages.length} catalog images selected</small>
      </label>}
      <label className="growth-field"><span>Client terms and approval instructions</span><textarea value={terms} onChange={e=>setTerms(e.target.value)}/></label>
      <label className="growth-field"><span>Call to action / next step</span><textarea value={cta} onChange={e=>setCta(e.target.value)}/></label>
      <label className="growth-field"><span>Actual licensed product photo or approved mockup (optional for some templates)</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>readMarketingImage(e.target.files?.[0],setProductImage)}/></label>
      {template==="logo-options" && <label className="growth-field"><span>Actual logo choices — upload at least two (max six)</span><input type="file" multiple accept="image/png,image/jpeg,image/webp" onChange={e=>uploadLogoOptions(e.target.files)}/></label>}
      {template==="product-color-chart" && <label className="growth-field">
        <span>Verified product color swatches (one per line: Color name | #RRGGBB)</span>
        <textarea rows="4" value={productSwatchesText} onChange={e=>setProductSwatchesText(e.target.value)}
          placeholder={"Royal Blue | #004F9E\\nBlack | #000000"}/>
      </label>}
      <label className="growth-field"><span>AI copy tone</span><select value={aiTone} onChange={e=>setAiTone(e.target.value)}>{["professional","friendly","persuasive","concise","warm","energetic"].map(t=><option key={t}>{t}</option>)}</select></label>
    </div>
        <div className="growth-actions">
      <button type="button" className="sc-btn" disabled={aiBusy} onClick={assistWithAI}>{aiBusy?"Generating…":"AI-assisted copy"}</button>
      <button className="sc-btn sc-btn-primary" onClick={build}>Generate draft</button>{guide && <button className="sc-btn" onClick={printGuide}>Download printable HTML</button>}{guide && <button className="sc-btn" disabled={saving || !accountId} onClick={saveDraft}>{saving?"Saving…":"Save client draft"}</button>}</div>
    {aiText && <div className="growth-subcard"><h3>AI copy — review before sharing</h3><textarea aria-label="Edit AI generated copy" rows="14" style={{width:"100%"}} value={aiText} onChange={e=>setAiText(e.target.value)}/><button type="button" className="sc-btn" onClick={()=>setDescription(aiText)}>Use as document description</button></div>}
    </>}
    {reviewLink && <p role="status">Review URL: <input aria-label="Private client review URL" readOnly value={reviewLink} onFocus={e=>e.target.select()}/></p>}
    {error && <p role="alert">{error}</p>}{saveStatus && <p role="status">{saveStatus}</p>}
    {template==="store-preview" && <MarketingStorePreview organization={organization} logo={logo} colors={colors.split(",").map(x=>x.trim())} products={style?[{name:style,colors:productColors.split(",").map(x=>x.trim()).filter(Boolean)}]:[]}/>}
    {manager && reviewHistory.length>0 && <div className="growth-subcard"><h3>Client review history</h3>{reviewHistory.map(r=><p key={r.id}>{r.decision||"Awaiting response"} · {r.revoked_at?"Revoked":new Date(r.expires_at)<new Date()?"Expired":"Link active"} {r.feedback&&" — "+r.feedback} {!r.decision&&!r.revoked_at&&<button className="sc-btn" onClick={()=>revokeReviewLink(r.id,historyDocument)}>Revoke link</button>}</p>)}</div>}
    {accountId && <div className="growth-subcard"><h3>Saved client documents</h3>{savedDrafts.length ?
      <ul>{savedDrafts.map(d=><li key={d.id}>{d.title} · {d.status} · {new Date(d.created_at).toLocaleDateString()} {d.content?.marketing_artwork?.key&&<button type="button" className="sc-btn" onClick={()=>openSavedArtwork(d)}>View stored logo</button>} {manager && d.status==="draft" && <button type="button" className="sc-btn" disabled={saving} onClick={()=>approveDocument(d)}>Approve</button>}{manager && d.status==="approved" && <button type="button" className="sc-btn" onClick={()=>createReviewLink(d)}>Create client review link</button>}{manager && d.status==="approved" && <button type="button" className="sc-btn" onClick={()=>loadReviewHistory(d)}>View client feedback</button>}</li>)}</ul> :
      <p>No saved documents found for this client.</p>}</div>}
    {guide && <article className="growth-subcard" aria-live="polite">
      {marketingDocumentMissing(guide).length>0 ?
        <div role="alert"><strong>Draft incomplete — resolve before manager approval:</strong><ul>{marketingDocumentMissing(guide).map(x=><li key={x}>{x}</li>)}</ul></div>:
        <p role="status">Required template content entered. Final client and production approval still required.</p>}
      <h3>{guide.organization} — Draft {marketingTemplates.find(t=>t.id===guide.template)?.label}</h3>
      {guide.logo && <img src={guide.logo} alt="Client draft logo" style={{maxWidth:160,maxHeight:160,objectFit:"contain"}}/>}
      <p>{guide.branding.profile} · Suggested logo uses: {guide.branding.placements.join(", ")}</p>
      <p>Suggested colors: {guide.branding.colors.join(", ") || "No colors provided"}</p>
      <p>Color and Pantone matching requires physical verification. Dimensions require approval for each product.</p>
      {guide.productImage && <img src={guide.productImage} alt="Selected product image" style={{maxWidth:220,maxHeight:220,objectFit:"contain"}}/>}
      {(guide.productImages||[]).length>0 && <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        {guide.productImages.map((src,i)=><img key={i} src={src} alt={"Product "+(i+1)} style={{maxWidth:140,maxHeight:140,objectFit:"contain"}}/>)}
      </div>}
      {guide.aiText && <p style={{whiteSpace:"pre-wrap"}}>{guide.aiText}</p>}
      {guide.retailPrice && <p>Client unit price: ${Number(guide.retailPrice).toFixed(2)} {guide.quantity && " · Quantity: "+guide.quantity}</p>}
      {guide.offer && <p>{guide.offer.supplier_name} · {guide.offer.sku} · source price verified {guide.offer.observed_at.slice(0,10)}</p>}
    </article>}
  </section>;
}
