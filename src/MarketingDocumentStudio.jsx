import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { growthWriteAllowed } from "./lib/marketingApi";
import { marketingTemplates, marketingSuppliers, suggestedBrandGuide, normalizeSupplierOffer } from "./lib/marketingCatalogPolicy";
import { escapeGrowthHtml } from "./lib/growthPricing";
import MarketingSupplierCompare from "./MarketingSupplierCompare";
import MarketingStorePreview from "./MarketingStorePreview";
import { generateMarketingDraft } from "./lib/marketingAI";
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
  useEffect(() => {
    if (!accountId) return;
    let active=true;
    supabase.from("sc_growth_documents")
      .select("id,title,template_id,status,version,created_at,updated_at")
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
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 5_000_000) {
      setError("Choose a PNG, JPEG or WebP logo smaller than 5 MB."); return;
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
  async function assistWithAI() {
    try {
      setAiBusy(true);setError("");
      const kind = template === "brand-guide" ? "brand-guide" :
        template === "product-guide" ? "product-guide" :
        template === "store-preview" ? "store-concept" :
        template.startsWith("brochure") ? "brochure" : "outreach";
      const result=await generateMarketingDraft({kind,organization:organization.trim(),
        segment,brief:description.trim()});
      setAiText(result);
    } catch (e) { setError(e.message || "AI draft unavailable"); }
    finally { setAiBusy(false); }
  }
  function build() {
    try {
      const parsedColors = colors.split(",").map(s => s.trim()).filter(Boolean);
      const branding = suggestedBrandGuide(segment, parsedColors);
      let offer = null;
      if (template === "product-guide" && (style.trim() || sku.trim() || unitCost.trim())) {
        if (!sku.trim() || !unitCost.trim() || !observedAt)
          throw Error("Provide a verified supplier SKU, observed price and price date, or leave the product details blank.");
        offer = normalizeSupplierOffer({ supplier, sku: sku.trim(), unit_cost: unitCost,
          observed_at: observedAt, source_url: sourceUrl || undefined });
        if (sourceUrl && !/^https:\/\//i.test(sourceUrl)) throw Error("Provide an HTTPS supplier product URL.");
      }
      setGuide({ template, organization: organization.trim() || "Client", description, logo,
        branding, offer, style, sizes, productColors, generated_at: new Date().toISOString() });
      setError("");
    } catch (e) { setError(e.message); }
  }
  async function saveDraft() {
    if (!guide || !accountId) { setError("Select a saved client before storing this draft."); return; }
    try {
      if (!growthWriteAllowed()) { setSaveStatus("Training mode: draft not saved."); return; }
      setSaving(true); setError("");
      // Logo image data is not persisted in JSON; upload an approved asset separately.
      const { logo: unusedLocalImage, ...safeGuide } = guide;
      void unusedLocalImage;
      const { error: insertError } = await supabase.from("sc_growth_documents").insert({
        account_id: accountId, template_id: template, title: guide.organization + " — " + template,
        content: { ...safeGuide, logo_upload_required: Boolean(guide.logo) }
      });
      if (insertError) throw insertError;
      setSaveStatus("Draft saved to this client. Logo file must be added through approved artwork storage.");
      const {data:latest} = await supabase.from("sc_growth_documents").select("id,title,template_id,status,version,created_at").eq("account_id",accountId).order("created_at",{ascending:false}).limit(30);
      if(latest) setSavedDrafts(latest);
    } catch(e) { setError(e.message || "Draft could not be saved."); }
    finally { setSaving(false); }
  }
  function printGuide() {
    if (!guide) return;
    const e = escapeGrowthHtml;
    // Logo is restricted to a local browser data URL from an image upload.
    const safeLogo = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(guide.logo)
      ? '<img alt="Client draft logo" src="' + guide.logo + '" style="max-width:180px;max-height:180px;object-fit:contain">' : "";
    const swatches = guide.branding.color_details.map(c => '<span style="display:inline-block;margin:5px;text-align:center;vertical-align:top"><span style="display:block;background:'+c.hex+';width:120px;height:55px;border:1px solid #ddd"></span>'+c.hex+'<br><small>RGB '+c.rgb.r+', '+c.rgb.g+', '+c.rgb.b+'</small><br><small>CMYK est. '+Object.values(c.cmyk_approx).map(n=>Math.round(n*100)+'%').join(' / ')+'</small></span>').join("");
    const supplierDetails = guide.offer ? '<h2>Product source</h2><p>'+e(guide.offer.supplier_name)+' · '+e(guide.offer.sku)+
      ' · Cost basis: '+e(guide.offer.cost_source)+' · Observed '+e(guide.offer.observed_at.slice(0,10))+
      '</p>' : "";
    const markup = '<!doctype html><html><head><meta charset="utf-8"><title>'+e(guide.organization)+' draft guide</title><style>body{font:16px system-ui;max-width:850px;margin:50px auto;color:#172033;padding:24px}h1{font-size:32px}h2{border-bottom:1px solid #aaa;padding-bottom:8px}li{margin:8px 0}small{color:#555}@media print{body{margin:0}}</style></head><body><small>SKILLED CRAFTING · DRAFT FOR REVIEW</small><h1>'+e(guide.organization)+'</h1><h2>'+e(marketingTemplates.find(t=>t.id===guide.template)?.label||"Marketing guide")+'</h2>'+safeLogo+
      '<p>'+e(guide.description)+'</p><h2>Suggested logo colors</h2>'+swatches+
      '<h2>Logo variants</h2><ul>'+guide.branding.variants.map(t=>'<li>'+e(t)+'</li>').join("")+'</ul>'+
      '<h2>Suggested application positions</h2><ul>'+guide.branding.placements.map(t=>'<li>'+e(t)+' — production to confirm dimensions against actual product</li>').join("")+'</ul>'+
      '<h2>Typography and print notes</h2><p>'+e(guide.branding.typography)+'</p><p>'+e(guide.branding.printing)+'</p>'+
      (guide.style?'<h2>Product selection</h2><p>'+e(guide.style)+'</p><p>Sizes: '+e(guide.sizes||"Verify supplier sizes")+'</p><p>Colors: '+e(guide.productColors||"Verify supplier colors")+'</p>':"")+
      supplierDetails+'<p><small>Not approved artwork. Supplier availability, output color and placement require verification. Client approval is required.</small></p></body></html>';
    const blob = new Blob([markup], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download="skilled-crafting-"+guide.template+".html"; a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  return <section className="sc-panel">
    <h2>Marketing Document Builder</h2>
    <p>Choose a starting template, add the client's details and generate a printable draft. This builder works without sending logo files to AI services. Advanced AI generation and supplier feeds require separate integration.</p>
    <div className="growth-grid">
      <label className="growth-field"><span>Template</span><select value={template} onChange={e=>{setTemplate(e.target.value);setGuide(null);}}>{marketingTemplates.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
      <label className="growth-field"><span>Save under client</span><select value={accountId} onChange={e=>{const id=e.target.value;setAccountId(id);const a=organizations.find(x=>x.id===id);if(a){setOrganization(a.organization);setSegment(a.segment==="club"?"team":a.segment==="other"?"business":a.segment);}}}><option value="">Select existing client</option>{organizations.map(o=><option key={o.id} value={o.id}>{o.organization}</option>)}</select></label>
      <label className="growth-field"><span>Client name</span><input value={organization} onChange={e=>setOrganization(e.target.value)} list="marketing-studio-clients"/><datalist id="marketing-studio-clients">{organizations.map(o=><option key={o.id} value={o.organization}/>)}</datalist></label>
      <label className="growth-field"><span>Client type</span><select value={segment} onChange={e=>setSegment(e.target.value)}>{["team","school","business","nonprofit"].map(t=><option key={t}>{t}</option>)}</select></label>
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
    <div className="growth-actions">
      <button type="button" className="sc-btn" disabled={aiBusy || !organization.trim() || !description.trim()} onClick={assistWithAI}>{aiBusy?"Generating…":"AI-assisted copy"}</button>
      <button className="sc-btn sc-btn-primary" onClick={build}>Generate draft</button>{guide && <button className="sc-btn" onClick={printGuide}>Download printable HTML</button>}{guide && <button className="sc-btn" disabled={saving || !accountId} onClick={saveDraft}>{saving?"Saving…":"Save client draft"}</button>}</div>
    {aiText && <div className="growth-subcard"><h3>AI copy — review before sharing</h3><textarea aria-label="Edit AI generated copy" rows="14" style={{width:"100%"}} value={aiText} onChange={e=>setAiText(e.target.value)}/><button type="button" className="sc-btn" onClick={()=>setDescription(aiText)}>Use as document description</button></div>}
    {reviewLink && <p role="status">Review URL: <input aria-label="Private client review URL" readOnly value={reviewLink} onFocus={e=>e.target.select()}/></p>}
    {error && <p role="alert">{error}</p>}{saveStatus && <p role="status">{saveStatus}</p>}
    {template==="store-preview" && <MarketingStorePreview organization={organization} logo={logo} colors={colors.split(",").map(x=>x.trim())} products={style?[{name:style,colors:productColors.split(",").map(x=>x.trim()).filter(Boolean)}]:[]}/>}
    {manager && reviewHistory.length>0 && <div className="growth-subcard"><h3>Client review history</h3>{reviewHistory.map(r=><p key={r.id}>{r.decision||"Awaiting response"} · {r.revoked_at?"Revoked":new Date(r.expires_at)<new Date()?"Expired":"Link active"} {r.feedback&&" — "+r.feedback} {!r.decision&&!r.revoked_at&&<button className="sc-btn" onClick={()=>revokeReviewLink(r.id,historyDocument)}>Revoke link</button>}</p>)}</div>}
    {accountId && <div className="growth-subcard"><h3>Saved client documents</h3>{savedDrafts.length ?
      <ul>{savedDrafts.map(d=><li key={d.id}>{d.title} · {d.status} · {new Date(d.created_at).toLocaleDateString()} {manager && d.status==="draft" && <button type="button" className="sc-btn" disabled={saving} onClick={()=>approveDocument(d)}>Approve</button>}{manager && d.status==="approved" && <button type="button" className="sc-btn" onClick={()=>createReviewLink(d)}>Create client review link</button>}{manager && d.status==="approved" && <button type="button" className="sc-btn" onClick={()=>loadReviewHistory(d)}>View client feedback</button>}</li>)}</ul> :
      <p>No saved documents found for this client.</p>}</div>}
    {guide && <article className="growth-subcard" aria-live="polite"><h3>{guide.organization} — Draft {marketingTemplates.find(t=>t.id===guide.template)?.label}</h3>
      {guide.logo && <img src={guide.logo} alt="Client draft logo" style={{maxWidth:160,maxHeight:160,objectFit:"contain"}}/>}
      <p>{guide.branding.profile} · Suggested logo uses: {guide.branding.placements.join(", ")}</p>
      <p>Suggested colors: {guide.branding.colors.join(", ") || "No colors provided"}</p>
      <p>Color and Pantone matching requires physical verification. Dimensions require approval for each product.</p>
      {guide.offer && <p>{guide.offer.supplier_name} · {guide.offer.sku} · source price verified {guide.offer.observed_at.slice(0,10)}</p>}
    </article>}
  </section>;
}
