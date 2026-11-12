# Skilled Crafting Local AI: zero-paid-API rollout

## Operating principle

The browser-based, deterministic flyer generator is the always-available baseline. Local AI is **optional**; no Netlify function or browser should require a powered-on workstation. Neither Ollama nor ComfyUI should be publicly exposed. Do not forward ports 11434 or 8188 from a router or bind them to a public interface.

## Hardware assignments

- Everyday Mac: Apple M4, 48 GB unified RAM. Use Ollama for structured creative briefs and copy suggestions.
- Windows 11: NVIDIA RTX 4070 Ti SUPER (16 GB dedicated VRAM), 100+ GB RAM. Use NVIDIA-accelerated ComfyUI for optional background imagery; prefer the NVIDIA GPU rather than shared-memory Radeon graphics.
- Existing hosted app: retain client authorization, verified text, approved logos, saved drafts, and PDF export. Existing Supabase and R2 assets remain the source of truth.

## Stage A: Mac local model (manual setup)

1. Install Ollama from the official installer, or via Homebrew if already installed: `brew install --cask ollama`.
2. Start Ollama locally. Verify `curl -fsS http://127.0.0.1:11434/api/tags`.
3. Download a suitable small instruction model, for example `ollama pull qwen2.5:7b`. Confirm the model's license and intended commercial use before production use.
4. Smoke-test a JSON layout prompt with `ollama run qwen2.5:7b`; use the application's strict layout schema rather than letting the model create factual prices, logos, or contact details.
5. Keep the Ollama server bound to loopback; do not change `OLLAMA_HOST` to `0.0.0.0` for convenience.

### Planned authenticated bridge

An outbound-only agent running on the Mac will claim short-lived jobs from an authenticated backend queue and post structured layout suggestions back. The agent should use a dedicated revocable device credential, scoped to AI jobs; do not put Supabase service-role keys, R2 credentials, or an API key into frontend code. Authenticate each job to the selected account, impose prompt and response size limits, and allow the user to approve the final result. Prefer polling initially; a persistent WebSocket is optional.

Do not make the browser call `http://localhost:11434` from the hosted HTTPS application: it can be blocked by browser security and cannot safely assume which computer is running the browser.

## Stage B: Windows 11 ComfyUI (deferred until remote access)

1. Confirm NVIDIA drivers, free disk space, and that the GPU is visible in Task Manager.
2. Install ComfyUI from the official project, with a supported NVIDIA CUDA/PyTorch build.
3. Start with a commercially usable SDXL workflow; consider quantized FLUX only after confirming model licensing and VRAM requirements.
4. Bind the ComfyUI server to `127.0.0.1`. Connect it to the same outbound-only job agent design.
5. Set job concurrency to one initially; add VRAM/timeout limits, explicit job cancellation, and image metadata retention.
6. Use Tailscale + Home Assistant + TightVNC for interactive setup, as with Diana's laptop. Provide a user-visible remote-screen-sharing indicator.

## Stage C: Application integration

- AI provider selection: Offline (default), Mac Ollama (when online), Windows ComfyUI (when online).
- Always keep deterministic offline fallback; never silently bill a cloud API.
- Preserve the school/client logo as an approved asset layer. Do not embed text, pricing, logos, or factual claims into generated background pixels.
- Add verified real product photos and editable pricing examples separately.
- Record provenance: offline vs Ollama vs ComfyUI, model/version, job status, generation time, and approval.
- Provide visible states for offline, processing, failed, and ready; avoid silent failure.
- Enforce per-account isolation, access controls, safe file types, image size limits, and export tests.

## Acceptance criteria

1. With both computers off, generate three different branded US Letter concepts, save/reopen drafts, and export a PDF.
2. With the Mac on, generate a schema-validated layout suggestion and fall back on error.
3. With Windows on, generate background-only imagery and store it in private account-scoped storage.
4. No outbound calls to paid AI providers in the default workflow.
5. Confirm no publicly reachable Ollama or ComfyUI service, and revoke agent access successfully.
6. Run school fixture tests for Sequim High, Greywolf Elementary, and Helen Haller Elementary; verify actual logo fidelity and text/print quality before customer distribution.

**Status:** This is the implementation/runbook plan. Ollama, ComfyUI, and the bridge are not yet installed or integrated by this document.
