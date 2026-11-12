# AI Document Design Studio — architecture and staged acceptance

## Decisions
- Both modes: (1) hybrid structured, editable text and verified assets; (2) artwork-first image-led composition with factual overlays.
- Three initial design concepts.
- New Studio is the primary Marketing Document Builder experience; classic builder remains available for existing draft, pricing and technical workflows.

## Current implementation (PR #235)
- Prompt library covering school, business, sports/team, nonprofit, wedding/event and general marketing.
- Three separate image-generation requests with varied art direction, using the existing authenticated client-scoped endpoint; plus a client-authorized structured JSON AI layout plan per concept.
- Concept selection and two composition modes, with AI section ordering, validated composition style and distinct print styles.
- Editable headline, description, benefits, steps, call to action and verified contact fields in hybrid mode.
- Safe HTML print layout (US Letter) for browser Print → PDF, plus native one-page PDF generation with exact approved logo overlay and deterministic text.
- Classic builder remains available via explicit toggle.
- Client-scoped private R2 concept storage and reopening through existing sc_growth_documents draft records. CI regression checks for prompt variation, escaping, native PDF and integration.

## Required before full production replacement
1. **Advanced AI layout placement**: current validated AI plan controls section ordering, composition and accent, but not arbitrary block coordinates, precise product placement or responsive typographic constraints. Extend to a bounded page grid and automated overflow checks.
2. **Client asset bindings**: use approved client logos, product mockups, catalog images, Artwork Vault revisions and approved branding. Current generator references a logo and overlays it separately; it does not guarantee realistic client-specific decorated merchandise.
3. **Persistence QA**: saving and reopening is implemented with private R2 references and sc_growth_documents; validate end-to-end in the live tenant, including large image limits and cross-client access denial.
4. **Production PDF preflight**: native US Letter PDF now exists; add print bleed, optional crop marks, accessibility, font and overflow checks, and real print quality validation.
5. **Live API and cost validation**: verify model permissions, function timeouts, image output size, cost budgets and error handling. Three images per request can be expensive and slow.
6. **Quality gate**: review three school outputs against Greywolf, Helen Haller and Sequim references, verify client identity, text accuracy, accessibility and one-page output.
7. **Revision workflow**: selective editing/locking of individual elements and regeneration of a selected concept, plus multi-format exports.

Do not label this release a completed AI-directed layout engine or deploy as fully production-ready until the above is implemented and verified.
