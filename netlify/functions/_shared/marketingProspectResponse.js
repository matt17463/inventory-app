/** The Responses API's structured output contract for public organization leads. */
export const prospectResponseFormat = {
  type: 'json_schema',
  name: 'marketing_prospects',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      prospects: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            website: { type: 'string' },
            location: { type: 'string' },
            reason: { type: 'string' },
          },
          required: ['name', 'website', 'location', 'reason'],
          additionalProperties: false,
        },
      },
    },
    required: ['prospects'],
    additionalProperties: false,
  },
};

/**
 * Raw Responses REST payloads contain output items and can include a web
 * search call before the final message. output_text is sometimes SDK-only.
 */
export function parseProspectResponse(data) {
  if (data?.status === 'incomplete' || data?.status === 'failed') {
    return { ok: false, code: 'incomplete', rows: [] };
  }
  const messageParts = (Array.isArray(data?.output) ? data.output : [])
    .filter((item) => item?.type === 'message')
    .flatMap((item) => Array.isArray(item.content) ? item.content : [])
    .filter((part) => part?.type === 'output_text' && typeof part.text === 'string')
    .map((part) => part.text);
  const raw = (messageParts.join('\n') || (typeof data?.output_text === 'string' ? data.output_text : '')).trim();
  if (!raw) return { ok: false, code: 'empty_output', rows: [] };
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, code: 'invalid_json', rows: [] };
  }
  // Keep compatibility with earlier array-shaped payloads.
  const rows = Array.isArray(parsed) ? parsed : parsed?.prospects;
  return Array.isArray(rows)
    ? { ok: true, code: 'ok', rows }
    : { ok: false, code: 'invalid_shape', rows: [] };
}
