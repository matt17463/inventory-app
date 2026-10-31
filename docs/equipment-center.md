# Equipment & Remote Access

The signed-in application route `/equipment-center` provides a Midnight Industrial device dashboard, location tabs, search, reference photos, configurable primary entity mappings, and Mac Screen Sharing/Pi SSH/Raspberry Pi Connect launchers. Preferences are scoped to the application account in this browser. No database migration is required.

## Live Home Assistant

The business Pi serves Home Assistant privately at `https://scshoppi.tail934ae0.ts.net` through Tailscale Serve. Connect Tailscale first, then choose **Connect live**. The official `home-assistant-js-websocket` client handles Home Assistant OAuth and a live entity subscription. Each user must authorize with their own Home Assistant account. Tokens are held in memory rather than saved to application preferences; disconnecting or leaving the page closes the connection and requests token revocation. Home Assistant permissions remain authoritative. Data and control calls go directly from the browser to private Home Assistant, not through Netlify or Supabase.

The separate console fallback is `http://100.117.18.123:8123/skilled-crafting/business`. HTTPS pages cannot fetch live data from that HTTP address. Tailscale HTTPS certificates register the Pi's DNS name in certificate transparency records; the service itself stays private. Funnel was explicitly deselected and is not enabled.

The page allows explicit on/off actions only for available switch, light and fan entities, after confirmation. Locks, covers, buttons, arbitrary service execution, scripts, firmware and recognizably named laser/printer power controls are excluded. New readings clear when the connection is lost. An acknowledged command is not reported as a confirmed physical result.

## Prepared device setup

- Roland BN2-30: business `.159`, firmware 2.30. A user-approved, private bridge sends selected local Connect Hub database fields from the business Mac to the Pi every 60 seconds. The HA view `/skilled-crafting/roland` shows operating state, maintenance flags, recent jobs, recorded error counters and experimental ink estimates. The app summarizes cleaning requests, estimated cleaning age, seven-day job records, latest duration and report receipt time. Current status and warning entities require a fresh report matching the printer's event fingerprint; stale data becomes unavailable. Error counters do not cover every current fault. Job records include adjustment routines. Date decoding is inferred and was compared with DG Connect's 118-day reading on October 15, 2026. Keep the Mac signed in and Connect Hub running. The restricted SSH upload key cannot open a shell or forward ports; printer operation is not exposed.
- Epson ET-2980 and Sawgrass SG500: existing IPP integrations remain. SG500 standard SNMP monitoring adds ink percentages, waste-collector usage, lifetime sheets, printer message and tray readings. The app summarizes supplies and directs to `/skilled-crafting/printers` for detail. No print jobs were sent.
- Kasa HS200: integration added and renamed **Business HS200 switch**. No switch operation was tested because its connected load has not been identified.
- Reolink: credentials are required. Swann NVR8-7250: protocol support still needs verification. Their photo slots can be filled in Details once exact hardware photographs are available.
- xTool S1/P2: user confirmed they are not currently connected. Cards and connection guides are prepared. No custom integration is installed, no live state is invented, and no laser operation was attempted. A community xTool integration exists, but must be reviewed and checked against the actual model/firmware before use.
- Home: Synology placeholder is based on prior user-provided DS718+ information. The laptop was on a different network during the October 15 scan. Those devices were excluded and no configuration changes were made there. Home discovery needs a laptop or trusted host on the intended home network.

The Home Assistant YAML dashboard is at `/skilled-crafting/business` with Business and Home tabs, a matching theme, printer sensors, connection sensors, backup health, and remote-access links. Its original configuration was backed up on the Pi under `/var/backups/business-pi/equipment-center-20261015T201601Z` before changes.

## Remote access

- Mac: `vnc://100.117.18.123:15900` launches macOS Screen Sharing through the Pi. The user explicitly approved the relay; it listens only on the Pi’s Tailscale address and forwards to the Mac’s stable Tailscale endpoint `100.106.153.72:5900`. Mac authentication remains required. The service is enabled at boot. Its protocol handshake was verified and a Mac desktop session worked through a temporary Pi SSH tunnel. Direct `vnc://100.106.153.72` remains an alternative. Keep the Mac powered, awake, lid open and Screen Sharing enabled. The relay uses the Mac’s Tailscale address so DHCP lease changes do not change its destination.
- Pi terminal: `ssh://mcdanielm@100.117.18.123` invokes the system SSH handler. Browser/OS prompts may appear.
- Pi desktop: Raspberry Pi Connect is installed and was enabled with the user's approval. The user linked it to their Raspberry Pi ID; signed-in status, allowed screen sharing, and an actual browser desktop session were verified.

## Validation

Run `node --test scripts/tests/equipment-controls.test.mjs`, `npm test`, and `npm run build`. Check the route behind AuthGate and test the actual OAuth callback on the deployed hostname while connected to Tailscale. Local visual preview uses a disposable standalone harness, which is not part of the release. Verify both desktop and narrow layouts, search, location selection, details editing, disconnect behavior and supported-control confirmation. Live OAuth and physical operation are separate checks and should not be inferred from a passing build.

## Callback handling

Home Assistant callback URLs on `/equipment-center?auth_callback=1` are excluded from Supabase automatic URL session detection. Other Supabase authentication callbacks retain their existing behavior. Effect lifetimes and connection generations prevent stale account/auth responses from attaching a live connection. Authorization times out after 30 seconds; initial WebSocket connection times out after 10 seconds.

## Relay rollback

On the Pi: `sudo systemctl disable --now skilledcrafting-mac-screen-relay.service`. Remove `/etc/systemd/system/skilledcrafting-mac-screen-relay.service` and `/opt/skilledcrafting/remote-access/mac-screen-relay.py` only if no longer needed, then run `sudo systemctl daemon-reload`. Disable private HA serving with `sudo tailscale serve --https=443 off`. HTTP reverse-proxy settings are managed through Home Assistant Network > HTTP server, not legacy YAML on this version.
