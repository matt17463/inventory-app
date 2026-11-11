import { useEffect, useState } from "react";
import { authenticatedFunctionFetch } from "./lib/netlifyFunctionClient";

import { marketingArtworkEndpoint, marketingImageTypes, marketingLogoImage } from "./lib/marketingArtwork";
const readBase64 = file => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(Error("Unable to read logo image."));
  reader.onload = () => resolve(String(reader.result).split(",")[1]);
  reader.readAsDataURL(file);
});

export default function MarketingClientLogo({ accountId, value, onChange }) {
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  useEffect(() => {
    let active = true;
    setPreview("");
    if (accountId && value) marketingLogoImage(accountId, value)
      .then(url => { if (active) setPreview(url); })
      .catch(() => { if (active) setError("Saved marketing logo preview unavailable."); });
    return () => { active = false; };
  }, [accountId, value]);
  async function upload(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    if (!marketingImageTypes.includes(file.type) || file.size > 2_500_000 || !file.size) {
      setError("Choose a PNG, JPEG, or WebP under 2.5 MB.");
      return;
    }
    setUploading(true);
    try {
      const base64 = await readBase64(file);
      const response = await authenticatedFunctionFetch(marketingArtworkEndpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_id: accountId, mime_type: file.type, base64 })
      });
      const result = await response.json();
      if (!response.ok || !result.asset?.key) throw Error(result.message || "Marketing logo upload failed.");
      onChange(result.asset.key);

    } catch (e) { setError(e.message || "Unable to upload marketing logo."); }
    finally { setUploading(false); }
  }
  return <section className="growth-marketing-logo">
    <h3>Marketing-only client logo</h3>
    <p className="growth-help">Optional temporary graphic for flyers, brochures and other marketing documents. Stored privately and kept separate from production artwork. Save the client after uploading or removing a logo.</p>
    {preview && value && <img src={preview} alt="Client marketing logo preview" style={{maxWidth:220,maxHeight:120,objectFit:"contain"}} />}
    <div className="growth-actions">
      <label className="growth-field"><span>Upload marketing logo (PNG, JPEG, WebP; 2.5 MB max)</span>
        <input type="file" accept="image/png,image/jpeg,image/webp" disabled={!accountId || uploading} onChange={upload} />
      </label>
      {value && <button type="button" className="sc-btn" disabled={uploading} onClick={() => { onChange(null); setPreview(""); setError(""); }}>Remove marketing logo</button>}
    </div>
    {uploading && <p role="status">Uploading private marketing logo…</p>}
    {error && <p role="alert">{error}</p>}
    {!accountId && <p>Save the client first, then edit it to upload a logo.</p>}
  </section>;
}
