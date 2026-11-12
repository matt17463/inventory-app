# Optional local image-generation bridge (Windows ComfyUI → Mac → Skilled Crafting)

**Status:** Feature implementation in PR #245 is development-only. The Windows ComfyUI installation/configuration was deferred and has **not been runtime-verified**. This is not a deployment-complete feature until an authorized staff member has a working private ComfyUI model and API workflow.

## Purpose and safety

Design Studio can request **original, text-free background scenery only**, never client logos or factual contact/pricing content. All approved branding and copy are independent editable overlays. The generated scene is a **candidate** and must be explicitly accepted in the user interface before it appears in a flyer.

No paid OpenAI API or public image provider is required. Continue to support manual licensed imagery and offline patterned vector artwork if Windows is offline.

## Private connectivity

1. On Windows, install ComfyUI and a compatible local model/approved license. Export a *working ComfyUI API JSON workflow*, with one CLIPTextEncode positive-prompt node and an image-writing output node. Use ComfyUI's official API export. Record the positive prompt node's ID and, optionally, the negative node's ID.
2. ComfyUI must listen on **Windows loopback** (normally 127.0.0.1:8188). Use Tailscale Serve to expose that loopback origin **to the private tailnet only**. Never enable Tailscale Funnel, router port forwarding, or public ComfyUI access; restrict tailnet ACLs to authorized workstation/bridge devices.
3. Confirm the Windows Tailscale Serve hostname matches `https://<device>.tail934ae0.ts.net`. It must resolve from the always-on Mac.
4. On the Mac, configure the working local API workflow file and private Windows HTTPS hostname in the process environment:

```bash
export SC_COMFYUI_BASE_URL="https://<windows-device>.tail934ae0.ts.net"
export SC_COMFYUI_WORKFLOW_JSON="$HOME/SkilledCrafting/local-ai/comfyui-api-workflow.json"
export SC_COMFYUI_POSITIVE_NODE="6"     # replace with actual node ID
# optional when the API graph has a negative CLIPTextEncode node:
export SC_COMFYUI_NEGATIVE_NODE="7"     # replace with actual node ID or omit
python3 mac-layout-bridge.py
```

These are **examples**, not known device details. Node IDs must match the real exported graph. The Mac process cannot infer installed models and will fail closed if the workflow or node IDs are incorrect.

The Mac bridge is the only browser-accessible entrypoint; it requires the same employee JWT and Origin check as `/layout` and `/copy`. It rejects public ComfyUI endpoints, caps payloads and generated image size, and has a bounded generation deadline. Only one explicitly configured workflow is accepted.

## Operator experience

1. Sign into Skilled Crafting and select a CRM client with approved branding.
2. Open **Optional local scene illustration — ComfyUI**, choose **Generate original background with local ComfyUI**.
3. View the returned scene at full size. Reject imagery containing text, logos, false school identity, watermarks, trademarks, unwanted product mockups or factual claims.
4. Accept only suitable original backgrounds. It becomes editable flyer scenery, then can be saved as a private client draft asset.
5. When the workstation is unreachable, use manual approved scenery or geometric fallback. No copy/brand elements are baked into a generated scene.

## Acceptance blockers

- Export working positive/negative prompt workflow and test private connectivity.
- Verify model license, local policy, GPU limits, render time, and correct no-text scenes.
- Test browser-to-Mac-to-Windows end to end with active user auth, including unauthenticated and cross-client failures.
- Check page preview, draft save/reopen, print resolution, and manual visual approval against the reference benchmark.
- **Do not merge or deploy PR #245 until this and all other production readiness gates are satisfied.**
