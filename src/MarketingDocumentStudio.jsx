import { useState } from "react";
import { marketingTemplates, marketingSuppliers, suggestedBrandGuide, normalizeSupplierOffer } from "./lib/marketingCatalogPolicy";
import { escapeGrowthHtml } from "./lib/growthPricing";

/** Client-side printable draft; no uploads or external supplier requests. */
export default function MarketingDocumentStudio({ organizations = [] }) {
  const [template, setTemplate] = useState("brand-guide");
  const [organization, setOrganization] = useState("");
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
      }
      setGuide({ template, organization: organization.trim() || "Client", description, logo,
        branding, offer, style, sizes, productColors, generated_at: new Date().toISOString() });
      setError("");
    } catch (e) { setError(e.message); }
  }
  function printGuide() {
    if (!guide) return;
    const e = escapeGrowthHtml;
    // Logo is restricted to a local browser data URL from an image upload.
    const safeLogo = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(guide.logo)
      ? '<img alt="Client draft logo" src="' + guide.logo + '" style="max-width:180px;max-height:180px;object-fit:contain">' : "";
    const swatches = guide.branding.colors.map(c => '<span style="display:inline-block;margin:5px;text-align:center"><span style="display:block;background:'+c+';width:70px;height:55px;border:1px solid #ddd"></span>'+c+'</span>').join("");
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
      <label className="growth-field"><span>Client name</span><input value={organization} onChange={e=>setOrganization(e.target.value)} list="marketing-studio-clients"/><datalist id="marketing-studio-clients">{organizations.map(o=><option key={o.id} value={o.organization}/>)}</datalist></label>
      <label className="growth-field"><span>Client type</span><select value={segment} onChange={e=>setSegment(e.target.value)}>{["team","school","business","nonprofit"].map(t=><option key={t}>{t}</option>)}</select></label>
      <label className="growth-field"><span>Upload client's draft logo (optional)</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadLogo}/></label>
      <label className="growth-field"><span>Logo colors (editable HEX values, separated by commas)</span><input value={colors} onChange={e=>setColors(e.target.value)} placeholder="#008000, #000000"/></label>
      <label className="growth-field"><span>Client notes or product purpose</span><textarea value={description} onChange={e=>setDescription(e.target.value)}/></label>
    </div>
    {template==="product-guide" && <><h3>Verified supplier product (optional until catalog feed is connected)</h3><div className="growth-grid">
      <label className="growth-field"><span>Supplier</span><select value={supplier} onChange={e=>setSupplier(e.target.value)}>{Object.entries(marketingSuppliers).map(([key,v])=><option key={key} value={key}>{v.name}</option>)}</select></label>
      <label className="growth-field"><span>Product name/style</span><input value={style} onChange={e=>setStyle(e.target.value)}/></label>
      <label className="growth-field"><span>Supplier SKU</span><input value={sku} onChange={e=>setSku(e.target.value)}/></label>
      <label className="growth-field"><span>Verified source cost per unit (internal)</span><input type="number" min="0" step="0.01" value={unitCost} onChange={e=>setUnitCost(e.target.value)}/></label>
      <label className="growth-field"><span>Price observed (date)</span><input type="date" value={observedAt} onChange={e=>setObservedAt(e.target.value)}/></label>
      <label className="growth-field"><span>Source URL</span><input type="url" value={sourceUrl} onChange={e=>setSourceUrl(e.target.value)}/></label>
      <label className="growth-field"><span>Verified sizes</span><input value={sizes} onChange={e=>setSizes(e.target.value)}/></label>
      <label className="growth-field"><span>Verified product colors</span><input value={productColors} onChange={e=>setProductColors(e.target.value)}/></label>
    </div></>}
    <div className="growth-actions"><button className="sc-btn sc-btn-primary" onClick={build}>Generate draft</button>{guide && <button className="sc-btn" onClick={printGuide}>Download printable HTML</button>}</div>
    {error && <p role="alert">{error}</p>}
    {guide && <article className="growth-subcard" aria-live="polite"><h3>{guide.organization} — Draft {marketingTemplates.find(t=>t.id===guide.template)?.label}</h3>
      {guide.logo && <img src={guide.logo} alt="Client draft logo" style={{maxWidth:160,maxHeight:160,objectFit:"contain"}}/>}
      <p>{guide.branding.profile} · Suggested logo uses: {guide.branding.placements.join(", ")}</p>
      <p>Suggested colors: {guide.branding.colors.join(", ") || "No colors provided"}</p>
      <p>Color and Pantone matching requires physical verification. Dimensions require approval for each product.</p>
      {guide.offer && <p>{guide.offer.supplier_name} · {guide.offer.sku} · source price verified {guide.offer.observed_at.slice(0,10)}</p>}
    </article>}
  </section>;
}
