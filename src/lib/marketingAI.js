import { authenticatedFunctionFetch } from "./netlifyFunctionClient";
export async function generateMarketingDraft({ kind, organization, segment, brief }) {
  const response = await authenticatedFunctionFetch("/.netlify/functions/marketing-ai-draft", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, organization, segment, brief }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.draft) throw Error(payload.message || "Marketing AI draft unavailable.");
  return payload.draft;
}
