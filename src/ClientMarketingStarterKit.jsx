import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { getMockupProjectBundle, signedAssetUrl } from "./lib/mockupStudioApi";

/**
 * Read-only cross-workflow asset browser. Original files remain in Mockup Studio
 * or Marketing storage. No copying, writes, or permanent signed URLs.
 */
export default function ClientMarketingStarterKit({ accountId, organizations = [], onSelectLogo, onSelectProduct }) {
  const [assets, setAssets] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
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
          for (const item of bundle.blanks || []) rows.push({ kind: "blank", project: project.project_name, row: item, name: item.asset_name || item.product_name || "Blank product" });
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
  async function choose(asset) {
    setBusy(true); setError("");
    try {
      const url = await signedAssetUrl(asset.row, 300, { preferPreview: false });
      if (!url) throw Error("The original file is not available from storage.");
      const response = await fetch(url);
      if (!response.ok) throw Error("Unable to retrieve the source image.");
      const blob = await response.blob();
      if (!["image/png","image/jpeg","image/webp"].includes(blob.type) || blob.size > 2500000)
        throw Error("This file cannot be inserted directly. Choose a PNG, JPEG or WebP under 2.5 MB.");
      const dataUrl = await new Promise((resolve,reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(String(reader.result || "")); reader.onerror = reject; reader.readAsDataURL(blob);
      });
      if (asset.kind === "logo") onSelectLogo(dataUrl);
      else onSelectProduct(dataUrl);
    } catch (e) { setError(e.message || "Unable to select this asset."); }
    finally { setBusy(false); }
  }
  if (!accountId) return null;
  return <section className="sc-panel" aria-label="Client marketing starter kit">
    <h3>Client Marketing Starter Kit</h3>
    <p>Reuse artwork and blank-product images from the client's existing Mockup Studio projects. Files remain in their original storage locations. Only projects linked to the selected customer ID appear.</p>
    {!account?.customer_id && <p>Link this marketing account to its customer record to see existing Mockup Studio graphics. Names are not used to guess client identity.</p>}
    {busy && <p role="status">Loading shared graphics…</p>}
    {error && <p role="alert">{error}</p>}
    <label className="growth-field"><span>Find a graphic</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Artwork, blank garment, mockup or project"/></label>
    <div className="growth-grid">
      {assets.filter(a => (a.name + " " + a.project).toLowerCase().includes(search.toLowerCase())).map(a =>
        <div className="sc-panel" key={a.kind + ":" + a.row.id}>
          <strong>{a.name}</strong><p>{a.kind === "logo" ? "Client artwork" : a.kind === "blank" ? "Blank product" : "Approved mockup"} · {a.project}</p>
          <button type="button" className="sc-btn" disabled={busy} onClick={() => choose(a)}>Use in document</button>
        </div>)}
    </div>
    {!busy && !assets.length && <p>No linked Mockup Studio graphics found. Existing upload controls remain available.</p>}
  </section>;
}
