# Mac Ollama Design Studio bridge

This is an **opt-in private connection**. The app's existing deterministic generator works without it and never uses paid AI APIs.

## Prerequisites
- Ollama running locally on the Mac, with `ollama pull qwen2.5:7b` completed.
- Tailscale installed and signed into the same tailnet as the browser that opens Skilled Crafting.
- Python 3 (standard library only).
- The hosted application must have the `marketing-local-ai-authorize` Netlify function deployed. The bridge uses it to verify employee roles. No Supabase credentials are stored on the Mac.

## Mac setup
1. Download the repository and open Terminal in its root folder.
2. Start the private local bridge:

```sh
python3 scripts/local-ai/mac-layout-bridge.py
```

3. In a second Terminal window, use **Tailscale Serve (not Funnel)** to make the loopback bridge available only to your tailnet. Check the installed CLI syntax using `tailscale serve --help`. For current Tailscale releases, a typical command is:

```sh
tailscale serve --bg --https=443 http://127.0.0.1:8765
tailscale serve status
```

4. Open the application's existing private AI connection settings and save the resulting `https://YOUR-MAC.tail934ae0.ts.net` endpoint; enable it. The browser using the Design Studio must itself be connected to the tailnet. The endpoint must use the already approved `tail934ae0.ts.net` suffix. **Do not use Tailscale Funnel**, public DNS, or router port forwarding.
5. Generate three concepts in the Design Studio. It will use Ollama for layout plans when reachable and fall back to deterministic plans if the connection is unavailable.

## Security boundaries
- The Python service listens only on `127.0.0.1:8765`.
- Only the two approved Skilled Crafting web origins can make browser requests.
- Each request must contain a valid signed-in Supabase access token. The hosted application verifies the user is an **active employee** with an approved role before the bridge calls Ollama.
- Request body size is limited; local Ollama is accessed only on `127.0.0.1:11434`.
- The bridge depends on the hosted authorization endpoint; if that endpoint is unavailable, requests fail closed and the app uses its deterministic fallback.
- Model output is a layout plan only; the app continues to use its approved logo and editable verified copy overlays.
- This design requires the *viewing browser* to have tailnet access. It is not a cloud outbound-only worker queue.

## Validation
- With the Mac online, generate layouts and verify that the local service receives POST /layout requests.
- Turn the bridge off; verify three concepts still generate with deterministic fallback.
- Check that requests with missing/invalid access tokens and unknown browser origins are rejected.
- Confirm that no OpenAI API calls occur in this workflow.
