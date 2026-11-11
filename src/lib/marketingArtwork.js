import { authenticatedFunctionFetch } from "./netlifyFunctionClient";

export const marketingArtworkEndpoint = "/.netlify/functions/marketing-artwork-asset";
export const marketingImageTypes = ["image/png", "image/jpeg", "image/webp"];

export async function marketingLogoBlob(accountId, key) {
  const query = new URLSearchParams({ account_id: accountId, key, inline: "1" });
  const response = await authenticatedFunctionFetch(marketingArtworkEndpoint + "?" + query);
  if (!response.ok) throw Error("Private client artwork could not be loaded.");
  const blob = await response.blob();
  if (!marketingImageTypes.includes(blob.type) || !blob.size || blob.size > 2_500_000)
    throw Error("Private client artwork is not a supported image.");
  return blob;
}

export function marketingImageDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(Error("Private client artwork could not be read."));
    reader.readAsDataURL(blob);
  });
}

export async function marketingLogoImage(accountId, key) {
  return marketingImageDataUrl(await marketingLogoBlob(accountId, key));
}

export async function marketingSharedImageUrl(accountId, reference) {
  if (!reference?.source || reference.source === "blank_products")
    throw Error("A document image could not be authorized.");
  const result = await authenticatedFunctionFetch("/.netlify/functions/marketing-shared-asset", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ account_id: accountId, source: reference.source, asset_id: reference.asset_id, sign_download: true }),
  });
  const { url } = await result.json();
  if (!result.ok || !url) throw Error("A document image could not be authorized.");
  return url;
}
