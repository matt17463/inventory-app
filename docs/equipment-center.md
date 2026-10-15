# Equipment & Remote Access

The signed-in application route `/equipment-center` provides a Midnight Industrial device dashboard, location tabs, search, reference photos, configurable primary entity mappings, and Mac Screen Sharing/Pi SSH/Raspberry Pi Connect launchers. Preferences are scoped to the application account in this browser. No database migration is required.

## Live Home Assistant

The business Pi serves Home Assistant privately at `https://scshoppi.tail934ae0.ts.net` through Tailscale Serve. Connect Tailscale first, then choose **Connect live**. The official `home-assistant-js-websocket` client handles Home Assistant OAuth and a live entity subscription. Each user must authorize with their own Home Assistant account. Tokens are held in memory rather than saved to application preferences; disconnecting or leaving the page closes the connection and requests token revocation. Home Assistant permissions remain authoritative. Data and control calls go directly from the browser to private Home Assistant, not through Netlify or Supabase.

The separate console fallback is `http://100.117.18.123:8123/skilled-crafting/business`. HTTPS pages cannot fetch live data from that HTTP address. Tailscale HTTPS certificates register the Pi's DNS name in certificate transparency records; the service itself stays private. Funnel was explicitly deselected and is not enabled.

The page allows explicit on/off actions only for available switch, light and fan entities, after confirmation. Locks, covers, buttons, arbitrary service execution, scripts, firmware and recognizably named laser/printer power controls are excluded. New readings clear when the connection is lost. An acknowledged command is not reported as a confirmed physical result.

## Prepared device setup

- Roland BN2-30: discovered at business `.159`, reachability sensor added. Standard SNMP probes did not yield ink/job telemetry. Detailed monitoring uses Roland DG Connect until a supported bridge is verified. Connect Hub is reportedly installed on the business Mac; desktop inspection is pending because that Mac is currently unreachable over Tailscale.
- Epson ET-2980 and Sawgrass SG500: existing IPP integrations verified in Home Assistant. Epson reports supply levels. No print jobs were sent.
- Kasa HS200: integration added and renamed **Business HS200 switch**. No switch operation was tested because its connected load has not been identified.
- Reolink: credentials are required. Swann NVR8-7250: protocol support still needs verification. Their photo slots can be filled in Details once exact hardware photographs are available.
- xTool S1/P2: user confirmed they are not currently connected. Cards and connection guides are prepared. No custom integration is installed, no live state is invented, and no laser operation was attempted. A community xTool integration exists, but must be reviewed and checked against the actual model/firmware before use.
- Home: Synology placeholder is based on prior user-provided DS718+ information. The laptop was on a different network during the October 15 scan. Those devices were excluded and no configuration changes were made there. Home discovery needs a laptop or trusted host on the intended home network.

The Home Assistant YAML dashboard is at `/skilled-crafting/business` with Business and Home tabs, a matching theme, printer sensors, connection sensors, backup health, and remote-access links. Its original configuration was backed up on the Pi under `/var/backups/business-pi/equipment-center-20261015T201601Z` before changes.

## Remote access

- Mac: `vnc://100.106.153.72` launches macOS Screen Sharing. Keep the business Mac awake, powered, lid open and signed into Tailscale. Its current connection indicator must be checked before use.
- Pi terminal: `ssh://mcdanielm@100.117.18.123` invokes the system SSH handler. Browser/OS prompts may appear.
- Pi desktop: Raspberry Pi Connect is installed and was enabled with the user's approval. User account linking is still required; verify signed-in status and screen-sharing availability before calling it ready.

## Validation

Run `node --test scripts/tests/equipment-controls.test.mjs`, `npm test`, and `npm run build`. Check the route behind AuthGate and test the actual OAuth callback on the deployed hostname while connected to Tailscale. Local visual preview uses a disposable standalone harness, which is not part of the release. Verify both desktop and narrow layouts, search, location selection, details editing, disconnect behavior and supported-control confirmation. Live OAuth and physical operation are separate checks and should not be inferred from a passing build.
