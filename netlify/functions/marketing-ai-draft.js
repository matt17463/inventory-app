import { authorizeEmployee, jsonResponse, auditFunctionSecurity } from "./_shared/security.js";

const TYPES = new Set(["outreach", "brand-guide", "product-guide", "store-concept", "brochure"]);
function safeInput(value, limit = 1000) {
  return String(value ?? "").trim().slice(0, limit);
}
export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return jsonResponse(204, {}, event);
  if (event.httpMethod !== "POST") return jsonResponse(405, { message: "Method not allowed" }, event);
  const auth = await authorizeEmployee(event, {
    functionName: "marketing-ai-draft", allowedRoles: ["admin", "manager", "operator", "marketing"],
  });
  if (!auth.ok) return jsonResponse(auth.statusCode, { message: auth.message }, event);
  try {
    const request = JSON.parse(event.body || "{}");
    const kind = safeInput(request.kind, 40);
    const organization = safeInput(request.organization, 200);
    const segment = safeInput(request.segment, 40);
    const brief = safeInput(request.brief, 3000);
    if (!TYPES.has(kind) || !organization || !brief) {
      return jsonResponse(400, { message: "Choose an output type, organization and project brief." }, event);
    }
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return jsonResponse(503, { message: "Server AI integration is not configured." }, event);
    const prompt = [
      "You draft practical, editable sales and marketing content for Skilled Crafting, a custom apparel and personalization business.",
      "Never assert supplier prices, current inventory, Pantone equivalence, licensing rights or approved artwork unless independently verified.",
      "Avoid fabricated client facts, customer testimonials, claims or guarantees. Do not include sensitive internal purchase costs.",
      "For outreach, supply a concise subject, friendly opening, tailored value, and specific opt-in next step; do not imply contact permission.",
      "For brand guides, suggest typography, usage, clear space, placement, logo variants and physical proof requirements.",
      "For store concepts, present a clearly labeled concept only, never a purported live or functional storefront.",
      "For product guides, use product categories and explicit verification placeholders rather than made-up SKUs or prices.",
      "Reply in clear Markdown, without HTML or code fences.",
      "Task: " + kind, "Organization: " + organization, "Client segment: " + segment, "Project brief: " + brief,
    ].join("\n");
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MARKETING_TEXT_MODEL || "gpt-4.1-mini",
        messages: [{ role: "user", content: prompt }],
        max_completion_tokens: 1600,
      }),
      signal: AbortSignal.timeout(45000),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return jsonResponse(502, { message: "AI service unavailable; retry later." }, event);
    const draft = String(payload.choices?.[0]?.message?.content || "").trim().slice(0, 12000);
    if (!draft) return jsonResponse(502, { message: "AI returned no draft." }, event);
    await auditFunctionSecurity({ functionName: "marketing-ai-draft", action: "generate", outcome: "success", userId: auth.user.id, role: auth.role, event, metadata: { kind } });
    return jsonResponse(200, { draft, kind, review_required: true }, event);
  } catch (error) {
    return jsonResponse(500, { message: "Could not generate marketing draft." }, event);
  }
}
