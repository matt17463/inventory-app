# Remote/mobile acceptance checks — Skilled Crafting

The dashboard remains private. Do not forward TCP/8123 or enable Tailscale Funnel.

## Access
- App: https://inventory.skilledcrafting.com/equipment-center
- Home Assistant private HTTPS: https://scshoppi.tail934ae0.ts.net/skilled-crafting/business
- Connect Tailscale on each remote laptop or phone before loading Home Assistant.
- Each user authenticates separately with Home Assistant. The app holds WebSocket authorization in browser memory.
- SSH and VNC OS links are desktop-oriented; mobile browsers may not provide usable handlers.

## Test before deployment
1. Laptop on external Wi-Fi/hotspot + Tailscale: verify dashboard, app sign-in, and live WebSocket entity updates.
2. iPhone on cellular data + Tailscale: Safari and Home Assistant Companion app, portrait and landscape, app OAuth return.
3. Android, if applicable: cellular and external Wi-Fi, Chrome and HA Companion.
4. With Tailscale disconnected, verify that private HA is inaccessible and app reports disconnected instead of showing cached data.
5. Verify private Tailscale Serve, no Funnel/public HA access, no router port forwarding, appropriate per-user credentials.
6. Test widths 320/375/430/768/1024: touch controls, scrolling, dialog sizing, no horizontal clipping.
7. Review machine power switches and camera controls: monitor-only defaults for laser, printer, NVR, camera and Bambu power entities.
8. Test sign-in and HA OAuth callback on deployed hostname, reload, disconnect, and returning user.
9. Run node --test scripts/tests/equipment-controls.test.mjs, npm test, and npm run build.
10. Backup Pi dashboard before applying changes and retain rollback copy.

## Pi read-only checks
Run these on SCShopPi:
    sudo tailscale serve status
    sudo tailscale status
    sudo docker ps --filter name=homeassistant

This branch does not modify Raspberry Pi Tailscale settings or deploy anything. Device-side validation is still required.