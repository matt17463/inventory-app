import { useEffect, useState } from "react";
import { authenticatedFunctionFetch } from "./lib/netlifyFunctionClient";
import { compareMarketingOffers, marketingSuppliers } from "./lib/marketingCatalogPolicy";

/** Manual supplier comparisons: verified entered costs only, not a live supplier feed. */
export default function MarketingSupplierCompare({ onChoose }) {
  const [entries,setEntries] = useState([]);
  const [feeds,setFeeds] = useState([]);
  useEffect(()=>{let active=true;authenticatedFunctionFetch("/.netlify/functions/marketing-supplier-feed-status").then(r=>r.json()).then(p=>{if(active)setFeeds(p.feeds||[]);}).catch(()=>{});return ()=>{active=false;};},[]);
  const [supplier,setSupplier] = useState("sanmar");
  const [sku,setSku] = useState("");
  const [name,setName] = useState("");
  const [cost,setCost] = useState("");
  const [observed,setObserved] = useState("");
  const [url,setUrl] = useState("");
  const [sizes,setSizes] = useState("");
  const [colors,setColors] = useState("");
  const [message,setMessage] = useState("");
  const [catalogQuery,setCatalogQuery]=useState("");
  const [catalogRows,setCatalogRows]=useState([]);
  const [searchBusy,setSearchBusy]=useState(false);
  async function searchCatalog(){
    try{setSearchBusy(true);setMessage("");const r=await authenticatedFunctionFetch("/.netlify/functions/marketing-catalog-search?q="+encodeURIComponent(catalogQuery));const result=await r.json();if(!r.ok)throw Error(result.message||"Catalog lookup failed");setCatalogRows(result.products||[]);}catch(e){setMessage(e.message);}finally{setSearchBusy(false);}
  }
  function add(e) {
    e.preventDefault();
    try {
      const item = {
        supplier, sku:sku.trim(), name:name.trim(), unit_cost:Number(cost),
        observed_at: observed, source_url:url.trim() || marketingSuppliers[supplier].product_url,
        sizes:sizes.split(",").map(x=>x.trim()).filter(Boolean),
        colors:colors.split(",").map(x=>x.trim()).filter(Boolean),
        availability_verified:false,
      };
      const next=compareMarketingOffers([...entries,item]);
      setEntries(next);
      setMessage("");
      setSku("");setName("");setCost("");setUrl("");setSizes("");setColors("");
    } catch(error) {setMessage(error.message);}
  }
  return <section className="growth-subcard">
    <h3>Compare supplier options</h3>
    <p>Enter products and source-checked prices to compare estimated purchasing cost. Stock and sizes must be checked with the supplier before placing an order. This does not query supplier websites.</p>
    <div className="growth-card-grid">{feeds.map(f=><div className="growth-subcard" key={f.supplier}><strong>{f.supplier}</strong><p>{f.configured?"Feed configured":"Feed not configured"} · {f.status}</p><small>{f.last_sync_at?"Last import: "+new Date(f.last_sync_at).toLocaleString():"No recorded import"} · {f.source}. Live prices and stock not verified.</small></div>)}</div>
    <div className="growth-actions"><input aria-label="Search existing supplier catalog" value={catalogQuery} onChange={e=>setCatalogQuery(e.target.value)} placeholder="Search existing supplier SKUs, brands or styles"/><button type="button" className="sc-btn" disabled={searchBusy||catalogQuery.trim().length<2} onClick={searchCatalog}>{searchBusy?"Searching…":"Search catalog"}</button></div>
    {catalogRows.length>0 && <div className="growth-search-results">{catalogRows.map((p,i)=><button type="button" key={i} onClick={()=>{setSupplier(Object.keys(marketingSuppliers).find(key=>marketingSuppliers[key].name.toLowerCase()===String(p.supplier_name||"").toLowerCase())||supplier);setName(p.description||[p.brand,p.style].filter(Boolean).join(" "));setSku(p.supplier_sku||"");setSizes(p.size||"");setColors(p.color||"");setMessage("Confirm the supplier and obtain a current source-verified price before comparison. The imported catalog does not establish availability.");}}>{p.supplier_name} · {p.brand} {p.style} · {p.color} / {p.size} · {p.supplier_sku}</button>)}</div>}
    <form onSubmit={add}>
      <div className="growth-grid">
        <label className="growth-field"><span>Supplier</span><select value={supplier} onChange={e=>setSupplier(e.target.value)}>{Object.entries(marketingSuppliers).map(([key,v])=><option key={key} value={key}>{v.name}</option>)}</select></label>
        <label className="growth-field"><span>Product description</span><input required value={name} onChange={e=>setName(e.target.value)}/></label>
        <label className="growth-field"><span>Supplier SKU</span><input required value={sku} onChange={e=>setSku(e.target.value)}/></label>
        <label className="growth-field"><span>Internal purchase cost</span><input type="number" required min="0" step="0.01" value={cost} onChange={e=>setCost(e.target.value)}/></label>
        <label className="growth-field"><span>Price checked on</span><input required type="date" value={observed} onChange={e=>setObserved(e.target.value)}/></label>
        <label className="growth-field"><span>Supplier product URL</span><input type="url" value={url} onChange={e=>setUrl(e.target.value)}/></label>
        <label className="growth-field"><span>Confirmed size names, separated by commas</span><input value={sizes} onChange={e=>setSizes(e.target.value)}/></label>
        <label className="growth-field"><span>Confirmed colors, separated by commas</span><input value={colors} onChange={e=>setColors(e.target.value)}/></label>
      </div>
      <button className="sc-btn" type="submit">Add to comparison</button>
    </form>
    {message && <p role="alert">{message}</p>}
    {entries.length>0 && <div className="growth-table-wrap"><table className="sc-table"><thead><tr><th>Product</th><th>Supplier</th><th>Purchase cost (internal)</th><th>Price date</th><th>Availability</th><th>Use</th></tr></thead><tbody>
    {entries.map((item,i)=><tr key={item.supplier+item.sku+i}><td>{item.name}<br/>{item.sku}</td><td>{item.supplier_name}</td><td>${item.unit_cost.toFixed(2)}</td><td>{item.observed_at.slice(0,10)}</td><td>Not verified</td><td><button type="button" className="sc-btn" onClick={()=>onChoose(item)}>Use in guide</button></td></tr>)}
    </tbody></table></div>}
  </section>;
}
