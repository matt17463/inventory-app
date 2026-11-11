import { useEffect, useState } from "react";
import { marketingSharedImageUrl } from "./lib/marketingArtwork";

export default function MarketingAssetImage({ accountId, image, label }) {
  const [resolved, setResolved] = useState(null);
  const source = image?.source;
  const assetId = image?.asset_id;
  useEffect(() => {
    if (!accountId || !source || !assetId) return;
    let active = true;
    marketingSharedImageUrl(accountId, { source, asset_id: assetId })
      .then(url => { if (active) setResolved({ accountId, source, assetId, url }); })
      .catch(() => { if (active) setResolved({ accountId, source, assetId, url: "" }); });
    return () => { active = false; };
  }, [accountId, source, assetId]);
  const current = resolved?.accountId === accountId && resolved?.source === source && resolved?.assetId === assetId;
  const url = typeof image === "string" ? image : current && resolved?.url;
  if (!url) return current ? <p>{label} is unavailable.</p> : null;
  return <img src={url} alt={label} referrerPolicy="no-referrer" style={{maxWidth:140,maxHeight:140,objectFit:"contain"}} />;
}
