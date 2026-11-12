# AI Document Design Studio — architecture and staged acceptance

## Decisions
- Both modes: (1) hybrid structured, editable text and verified assets; (2) artwork-first image-led composition with factual overlays.
- Three initial design concepts.
- New Studio is the primary Marketing Document Builder experience; classic builder remains available for existing draft, pricing and technical workflows.

## Current implementation (PR #235)
- Prompt library covering school, business, sports/team, nonprofit, wedding/event and general marketing.
- Three separate image-generation requests with varied art direction, using the existing authenticated client-scoped endpoint.
- Concept selection and two composition modes, with distinct print styles.
- Editable headline, description, benefits, steps, call to action and verified contact fields in hybrid mode.
- Safe HTML print layout (US Letter) for browser Print → PDF.
- Classic builder remains available via explicit toggle.
- CI regression checks for prompt variation, escaping and integration.

## Required before full production replacement
1. **AI-generated structured layout plan**: server-side LLM proposes section order, hierarchy, product placement, text-safe zones, and style tokens using a strict JSON schema. Validate against allowed blocks and print bounds. Current concept variations are preset CSS compositions, not arbitrary AI-generated layout.
2. **Client asset bindings**: use approved client logos, product mockups, catalog images, Artwork Vault revisions and approved branding. Current generator references a logo and overlays it separately; it does not guarantee realistic client-specific decorated merchandise.
3. **Concept and prompt persistence**: store each selected concept and prompt in the existing private R2 draft workflow, with client-scoped authorization and reopen/edit support. Current concept images live in browser state.
4. **Native PDF and preflight**: generate print-ready PDFs with deterministic text, bleed, margins, font embedding and page-overflow checks. Current output is HTML for Print → PDF.
5. **Live API and cost validation**: verify model permissions, function timeouts, image output size, cost budgets and error handling. Three images per request can be expensive and slow.
6. **Quality gate**: review three school outputs against Greywolf, Helen Haller and Sequim references, verify client identity, text accuracy, accessibility and one-page output.
7. **Revision workflow**: selective editing/locking of individual elements and regeneration of a selected concept, plus multi-format exports.

Do not label this release a completed AI-directed layout engine or deploy as fully production-ready until the above is implemented and verified.
