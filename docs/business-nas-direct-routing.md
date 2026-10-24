# Direct private business NAS access — October 24, 2026

SCShopPi now advertises exactly `192.168.1.100/32` through Tailscale. The owner approved this route in the Tailscale console. Existing tailnet access policy remains authoritative; no ACL, public port forwarding, exit node, NAS credential or SMB client setting was changed. The rest of the business LAN is not advertised.

The Pi already had persistent IPv4 forwarding enabled in `/etc/sysctl.d/99-codex-business-vpn.conf`, Tailscale netfilter forwarding enabled, and subnet SNAT enabled. Those settings were retained. Tailscale stores the advertised route persistently. The Pi must remain running and authorized; its key expires in approximately six months and expiry was not changed.

## Shortcut

- Finder → Go → Connect to Server: `smb://192.168.1.100`
- Windows File Explorer: `\\192.168.1.100`
- Phone/tablet: connect Tailscale, then use an SMB-capable file app with server `192.168.1.100`.

Select an existing share and use the existing NAS account. Browser shortcuts launch the OS file handler; enter the address manually if no handler opens. No usernames, passwords or share names are embedded in the shortcut.

macOS, Windows and mobile Tailscale clients accept subnet routes by default. A Linux client needs subnet route acceptance enabled. The NAS does not need its own Tailscale installation or a return route because the Pi performs source NAT. A more-specific host route makes this particular address refer to the business NAS while connected, including on another network using 192.168.1.x; it does not disambiguate a different local device at exactly the same address.

## Validation and compatibility

From the controlling Mac, direct TCP connections to `192.168.1.100` ports 80, 443 and 445 succeeded with source Tailscale address `100.69.20.116`. A direct HTTP GET of `/index.php` returned HTTP 200 and the Thecus page (18,037 bytes). The Pi reports `192.168.1.100/32` in PrimaryRoutes and AllowedIPs after approval. Home Assistant and existing Pi access remain reachable.

A credentials-free SMB negotiation selected **SMB1 / NT LM 0.12**. A direct SMB2 negotiation was closed by the server. This legacy NAS may be refused by modern clients requiring SMB2 or later. No deprecated client support was installed or enabled, and no security protections were reduced. Authentication and opening an authorized file share remain untested. Review supported Thecus firmware/SMB2 capability or a modern file gateway separately if the client refuses SMB1; the shortcut cannot fix protocol incompatibility.

The Skilled Crafting card and both Home Assistant location views now use **Open business NAS files** with `smb://192.168.1.100`, alongside the existing home NAS shortcut. Existing cards, themes and navigation preferences are retained.

Home Assistant backup before replacing the business NAS card: `/var/backups/business-pi/direct-nas-routing-20261024T212259Z/skilled-crafting-dashboard.yaml`. The update compared the current dashboard hash before writing and retained a fresh modification time so Home Assistant reloads its YAML cache. No Home Assistant restart was required.

## Rollback

Disable approval for only `192.168.1.100/32` on scshoppi in the Tailscale console. If the Pi still advertises only that route, remove the advertisement using `sudo tailscale set --advertise-routes=''`. If other routes have since been added, preserve them. Do not disable IPv4 forwarding or Tailscale, because other existing services depend on those settings. Restore the earlier NAS card from the dashboard backup while preserving subsequent unrelated edits; revert the application change through GitHub if required.

References: [Tailscale subnet routers](https://tailscale.com/kb/1104/enable-ip-forwarding), [route injection and client acceptance](https://tailscale.com/docs/reference/route-injection).
