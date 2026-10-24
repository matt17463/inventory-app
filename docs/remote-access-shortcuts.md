# Private remote-access shortcuts — October 24, 2026

The signed-in Equipment & Remote Access page reuses its existing Midnight Industrial palette, buttons and location navigation. Three cards remain visible in either location. Existing Mac/Pi launchers and account-scoped navigation preferences are retained. Search keywords include Diana, Windows, NAS, Synology and Thecus.

| Target | Verified endpoint | Access and limits |
| --- | --- | --- |
| Diana’s Windows laptop | diana-mcdaniel.tail934ae0.ts.net / 100.78.205.88 | TCP 5900 returned RFB 3.8 with VNC authentication advertised. Launch `vnc://100.78.205.88:5900` in a native viewer; RDP 3389 did not respond. No desktop authentication or control was attempted. |
| Business NAS, Thecus N5500 | 192.168.1.100, from SCShopPi | TCP 80, 443, 445 and 139 responded from the business Pi. HTTP returned its index.php bootstrap. No direct tailnet node or approved business subnet route was found. The shortcut opens the existing Raspberry Pi Connect desktop; its file manager can use `smb://192.168.1.100`. NAS sign-in and shares remain untested. |
| Home NAS, Synology SynServer | synserver.tail934ae0.ts.net / 100.76.196.90 | SMB 445 responds; HTTP 5000 identifies SynServer / Synology DiskStation. Use `smb://100.76.196.90` in Finder or `\\100.76.196.90` in Windows File Explorer. HTTPS 443/5001 presents a Synology-issued certificate untrusted for the private hostname, so no management launcher was added. |

Owner confirmed Synology is home and Thecus is business. SynServer advertises the home 192.168.50.0/24 subnet. The business Pi advertises no subnet routes. Do not add an ambiguous LAN launcher or assume a business route exists. No VPN routes, ACLs, credentials, public exposure, remote-desktop server settings or NAS settings were changed.

The existing Raspberry Pi Connect URL is retained from the installed, previously verified launcher. It requires the owner’s Raspberry Pi account. Its current authenticated desktop and NAS file access must still be checked by the owner. Native VNC/SMB links depend on installed OS handlers; visible instructions provide a fallback for other devices.

## Home Assistant

Both Business and Home views received an additive vertical stack containing all three cards. Other views and cards are unchanged. YAML remains JSON-compatible. The prior dashboard is backed up on SCShopPi at `/var/backups/business-pi/remote-access-shortcuts-20261024T210855Z/skilled-crafting-dashboard.yaml`. Installation checked the original file hash, verified all previous cards and views survived, and replaced the file atomically. Home Assistant’s configuration check passed. No container restart or equipment command was issued.

To roll back, compare the current dashboard against that backup, preserve any subsequent edits, then restore only the added remote-access stack. The original full backup may be copied over only if no newer dashboard edits need to survive.

## Remaining setup

1. Sign in to Diana’s VNC server and verify the intended screen. Keep the laptop awake and Tailscale connected when it travels; online status may change.
2. Sign in to both NAS devices and select an authorized existing share. No share names, usernames or passwords were invented.
3. Install and assign a trusted certificate covering SynServer’s private hostname before enabling a DSM management link. Do not bypass certificate warnings.
4. For direct business NAS access away from the shop, explicitly configure and approve an appropriate private subnet route after reviewing addressing and access policy. Until then use the existing business Pi desktop. Do not enable public port forwarding or Funnel.

## Validation

Full npm test suite passed (41 groups), full lint passed with existing warnings, and production build plus required-feature verification passed. A disposable rendering harness verified 1440px desktop and 390px phone widths, no horizontal overflow, 44px minimum primary link height, readable addresses and expandable connection instructions. The harness is excluded from the release. Protocol reachability does not establish successful user authentication, share permissions, TLS trust or an uninterrupted remote session.

Protocol references: [Apple VNC support](https://support.apple.com/en-ph/guide/remote-desktop/apde0dd523e/mac), [Synology DSM HTTPS ports](https://kb.synology.com/en-nz/DSM/tutorial/force_HTTPS_for_DSM), [Tailscale HTTPS certificates](https://tailscale.com/docs/how-to/set-up-https-certificates).
