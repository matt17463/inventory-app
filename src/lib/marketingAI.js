import { authenticatedFunctionFetch } from "./netlifyFunctionClient";
/** Only client-facing facts are passed to the AI; internal supplier costs stay local. */
export async function generateMarketingDraft({ kind, organization, segment, brief, tone = "professional", context = {} }) {
  const response = await authenticatedFunctionFetch("/.netlify/functions/marketing-ai-draft", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, organization, segment, brief, tone, context }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.draft) throw Error(payload.message || "Marketing AI draft unavailable.");
  return payload.draft;
}
