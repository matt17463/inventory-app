import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { authenticatedFunctionFetch } from "./lib/netlifyFunctionClient";
import { getMockupProjectBundle } from "./lib/mockupStudioApi";

/**
 * Read-only cross-workflow asset browser. Original files remain in Mockup Studio
 * or Marketing storage. No copying, writes, or permanent signed URLs.
 */
export default function ClientMarketingStarterKit({ accountId, organizations = [], onSelectLogo, onSelectProduct }) {
  const [assets, setAssets] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [includeOtherClients, setIncludeOtherClients] = useState(false);
  const [sharedBlanks, setSharedBlanks] = useState([]);
  const [sharedPage, setSharedPage] = useState(0);
  const [sharedMore, setSharedMore] = useState(false);
  const [sharedBusy, setSharedBusy] = useState(false);
  const [filters, setFilters] = useState({ search: "", brand: "", type: "", color: "", style: "" });
  const account = organizations.find(a => a.id === accountId);
  useEffect(() => {
    let active = true;
    setAssets([]);
    setError("");
    if (!accountId || !account) return () => { active = false; };
    async function load() {
      setBusy(true);
      try {
        const customerId = account.customer_id;
        const { data: projects, error: projectError } = customerId
          ? await supabase.from("mockup_projects").select("id,project_name,customer_id_text").eq("customer_id_text", String(customerId)).limit(50)
          : { data: [], error: null };
        if (projectError) throw projectError;
        const rows = [];
        for (const project of projects || []) {
          const bundle = await getMockupProjectBundle(project.id);
          for (const item of bundle.blanks || []) if (item.storage_provider === "r2" && item.storage_path && item.storage_bucket) rows.push({ kind: "blank", project: project.project_name, row: item, name: item.asset_name || item.product_name || "Blank product" });
          for (const item of bundle.artwork || []) rows.push({ kind: "logo", project: project.project_name, row: item, name: item.artwork_name || "Client artwork" });
          for (const item of bundle.outputs || []) {
            if (item.approval_status === "internal_approved" || item.approval_status === "customer_approved")
              rows.push({ kind: "product", project: project.project_name, row: item, name: item.output_name || "Approved mockup" });
          }
        }
        if (active) setAssets(rows);
      } catch (e) { if (active) setError(e.message || "Unable to load client assets."); }
      finally { if (active) setBusy(false); }
    }
    load();
    return () => { active = false; };
  }, [accountId, account?.customer_id]);
  useEffect(() => {
    if (!includeOtherClients || !accountId) { setSharedBlanks([]); setSharedMore(false); return; }
    let active = true;
    setSharedBusy(true);
    authenticatedFunctionFetch("/.netlify/functions/marketing-shared-asset", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "list_shared_blanks", account_id: accountId, page: sharedPage })
    }).then(async response => {
      const result = await response.json();
      if (!response.ok) throw Error(result.message || "Unable to search shared blank graphics.");
      if (active) {
        setSharedBlanks(previous => sharedPage === 0 ? result.assets : previous.concat(result.assets));
        setSharedMore(!!result.has_more);
      }
    }).catch(e => { if (active) setError(e.message); })
      .finally(() => { if (active) setSharedBusy(false); });
    return () => { active = false; };
  }, [includeOtherClients, accountId, sharedPage]);
  const sharedOptions = includeOtherClients ? sharedBlanks.filter(item => !assets.some(a => a.kind === "blank" && a.row.id === item.id))
    .map(item => ({ kind: "blank", project: "Shared Mockup Studio blank", row: item, name: item.asset_name || "Blank graphic" })) : [];
  function updateFilter(field, value) {
    setFilters(previous => ({ ...previous, [field]: value }));
  }
  async function choose(asset) {
    setBusy(true); setError("");
    try {
      let url = "";
      {
        const source = asset.kind === "logo" ? "mockup_artwork_assets" : asset.kind === "blank" ? "mockup_blank_assets" : "mockup_outputs";
        const response = await authenticatedFunctionFetch("/.netlify/functions/marketing-shared-asset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ account_id: accountId, source, asset_id: asset.row.id, sign_download: true }) });
        const result = await response.json();
        if (!response.ok || !result.url) throw Error(result.message || "This artwork is not authorized for the selected client.");
        url = result.url;
      }

      if (!url) throw Error("The original file is not available from storage.");
      const response = await fetch(url);
      if (!response.ok) throw Error("Unable to retrieve the source image.");
      const blob = await response.blob();
      if (!["image/png","image/jpeg","image/webp"].includes(blob.type) || blob.size > 2500000)
        throw Error("This file cannot be inserted directly. Choose a PNG, JPEG or WebP under 2.5 MB.");
      const dataUrl = await new Promise((resolve,reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(String(reader.result || "")); reader.onerror = reject; reader.readAsDataURL(blob);
      });
      const reference = { source: asset.kind === "logo" ? "mockup_artwork_assets" : asset.kind === "blank" ? "mockup_blank_assets" : "mockup_outputs", asset_id: asset.row.id, project_id: asset.row.project_id, storage_path: asset.row.storage_path || null };
      if (asset.kind === "logo") onSelectLogo(dataUrl, reference);
      else onSelectProduct(dataUrl, reference);
    } catch (e) { setError(e.message || "Unable to select this asset."); }
    finally { setBusy(false); }
  }
  if (!accountId) return null;
  return <section className="sc-panel" aria-label="Client marketing starter kit">
    <h3>Client Marketing Starter Kit</h3>
    <p>Reuse artwork and blank-product images from the client's existing Mockup Studio projects. Files remain in their original storage locations. Client artwork is limited to projects linked to the selected customer ID. Only blank graphics with verified R2 storage records from linked Mockup Studio projects are listed.</p>
    {!account?.customer_id && <p>Link this marketing account to its customer record to see existing Mockup Studio graphics. Names are not used to guess client identity.</p>}
    {busy && <p role="status">Loading shared graphics…</p>}
    {error && <p role="alert">{error}</p>}
    <label className="growth-field"><input type="checkbox" checked={includeOtherClients} onChange={e => { setIncludeOtherClients(e.target.checked); setSharedPage(0); setSharedBlanks([]); }} /> Include reusable blank graphics from other Mockup Studio clients</label>
    <p>Only R2-backed blank-product graphics are shared. Other clients’ logos, custom artwork, and finished mockups stay private.</p>
    <div className="growth-grid">
      <label className="growth-field"><span>Search products or artwork</span><input value={search} onChange={e => { setSearch(e.target.value); updateFilter("search", e.target.value); }} placeholder="Product name, SKU or project"/></label>
      {[
        ["brand", "Brand", "Adidas, Gildan, Bella+Canvas"],
        ["type", "Product type", "Hoodie, shirt, hat"],
        ["color", "Color", "Black, navy, red"],
        ["style", "Style / SKU", "A432, 18500"]
      ].map(([field, label, placeholder]) => <label key={field} className="growth-field"><span>{label}</span><input value={filters[field]} onChange={e => updateFilter(field, e.target.value)} placeholder={placeholder}/></label>)}
      <button type="button" className="sc-btn" onClick={() => { setSearch(""); setFilters({ search: "", brand: "", type: "", color: "", style: "" }); }}>Clear filters</button>
    </div>
    <p role="status">{assets.filter(a => a.kind === "blank").length} client blank graphics{includeOtherClients ? ` · ${sharedOptions.length} additional reusable blanks` : ""}{sharedBusy ? " · Loading…" : ""}.</p>
    <div className="growth-grid">
      {assets.concat(sharedOptions).filter(a => { const haystack = [a.name,a.project,a.row.product_color,a.row.product_type,a.row.blank_product_id_text,a.row.sku_base,a.row.brands?.name,a.row.colors?.name,a.row.product_types?.name].join(" ").toLowerCase(); return Object.values(filters).every(v => !v || haystack.includes(v.toLowerCase())); }).map(a =>
        <div className="sc-panel" key={a.kind + ":" + a.row.id}>
          <strong>{a.name}</strong><p>{a.kind === "logo" ? "Client artwork" : a.kind === "blank" || a.kind === "catalog" ? "Blank product" : "Approved mockup"} · {a.project}</p>
          <button type="button" className="sc-btn" disabled={busy} onClick={() => choose(a)}>Use in document</button>
        </div>)}
    </div>
    {includeOtherClients && sharedMore && <button type="button" className="sc-btn" disabled={sharedBusy} onClick={() => setSharedPage(p => p + 1)}>Load more shared blanks</button>}
    {!busy && !assets.length && !sharedOptions.length && <p>No reusable graphics found. Existing upload controls remain available.</p>}
  </section>;
}
