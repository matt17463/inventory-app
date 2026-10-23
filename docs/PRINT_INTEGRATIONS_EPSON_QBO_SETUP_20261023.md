# Print Center integrations — Epson CUPS, QuickBooks Online, approved recipe mapping
Build: branch `feature/unified-print-center-20261022`, draft PR #114. No production printing is enabled by committing this code.

## Architecture and safeguards
- **Epson**: Skilled Crafting manager → read-only authoritative invoice PDF generation → `print-dispatch` → private Supabase PDF bucket + service-only queue row → Pi agent outbound HTTPS poll → local CUPS `lp` letter queue. No inbound public listener or home/office router port forwarding.
- **Munbyn 941B**: still optional. USB/CUPS thermal queue must pass a local 4x6 test before it is enabled. Printing is designed for existing 203 DPI or later 300 DPI hardware.
- **QuickBooks**: admin-only Intuit OAuth consent with single-use state; AES-256-GCM encrypted access/rotating refresh tokens stored in a service-only RLS table; original invoice is queried by exact invoice number. The linked manual order total must match actual QuickBooks `TotalAmt` within two cents before the app enables customer invoices. `Balance` from the original QBO invoice supplies the paid state. A custom Sales Tax service item in QBO is treated as a line rather than native tax to avoid double-counting.
- **Profiles**: shared template settings are stored per original order source; admin/manager can explicitly map an SKU to a sample-verified approved recipe and deliberately apply the mapping to uncovered job lines. No inventory/order/payment writes.
- **Privacy**: PDF objects live in private Supabase Storage with browser-role restrictive policies. Only service-role endpoints access them; PDFs are purged after seven days on a daily Pi agent check, while spool status metadata remains.
- **Status**: queued → leased → spooled or failed. `spooled` means CUPS accepted the print job; not physical delivery.
- **Production fallback**: the existing WooCommerce Print Documents plugin is unchanged. New system is feature-flag disabled until printer verification.

## Deployment prerequisites
1. Pass CI and review draft pull request; deploy new Netlify functions and front-end only once approved.
2. Apply `supabase/migrations/20261023024000_print_integrations.sql` to the inventory Supabase project, verify the private bucket, RLS/grants and no broad browser access.
3. Set the following **Netlify environment variables**, with secrets stored only in Netlify:
   - `SC_QBO_CLIENT_ID`, `SC_QBO_CLIENT_SECRET`: from your Intuit Developer OAuth app.
   - `SC_QBO_PRINT_ENCRYPTION_KEY`: fresh **64-character hex** AES key, e.g. generated locally using `openssl rand -hex 32`. Never share in a screenshot/chat or commit to Git.
   - `SC_QBO_REDIRECT_URI`: full HTTPS deployed `/.netlify/functions/qbo-print-connect` callback, added identically to the Intuit Developer app's allowed redirects. Use the actual active Skilled Crafting app domain.
   - `SC_QBO_ENVIRONMENT=production` for the real QBO company, or `sandbox` for tests.
   - `SC_PRINT_AGENT_TOKEN`: random 32+ character shared secret, e.g. `openssl rand -hex 32` (also installed privately on Pi).
   - `SC_PRINT_DISPATCH_ENABLED=false`, `SC_PRINT_THERMAL_ENABLED=false` until onsite printers pass. **Do not turn these on prematurely.**
   - Existing `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `WC_CONSUMER_KEY`, `WC_CONSUMER_SECRET` remain needed server-side; never place them in client JavaScript.
4. In Print Center (admin account), click **Connect QuickBooks** and complete Intuit consent in the browser. Confirm a known invoice is found and reconciled, then a mismatched/unknown invoice stays DRAFT.
5. Verify a paid Woo and linked QBO order against original system statements, including discounts, 9.2% sales tax or QBO Sales Tax service line, partial payments, shipping, many item lines and customer personalization.

## Raspberry Pi Epson setup — not yet executed on your equipment
The Pi must reach the Epson on the business network. Determine the **exact Epson printer model**, its IPP support, and printer URI before editing queues. Do not invent an IP address or assume all Epson devices accept IPP Everywhere.

On the Pi terminal:
```bash
sudo apt update
sudo apt install -y cups cups-client avahi-utils
sudo systemctl enable --now cups
lpstat -e
lpinfo -v
avahi-browse -rt _ipp._tcp
```
If the Epson advertises IPP Everywhere, add a new queue with the URI actually discovered by Avahi/CUPS:
```bash
sudo lpadmin -p SC_Epson_2980 -E -v 'YOUR_DISCOVERED_IPP_URI' -m everywhere
lpstat -p SC_Epson_2980
lpoptions -p SC_Epson_2980 -l
```
If the printer does not advertise IPP Everywhere, use a supported Epson Linux/ARM driver after confirming its exact model; **do not force generic `everywhere`**. Print a harmless local letter-size test page through CUPS and verify size, margins and ink. The Pi's user must have permission to submit to the queue.

Install Node.js 20+ and copy the audited `scripts/print-agent.mjs` to `/opt/skilledcrafting/print-agent.mjs`. Set up the private environment file `/etc/skilledcrafting/print-agent.env` (root-owned, mode 600), containing:
```dotenv
SC_APP_URL=https://YOUR-ACTUAL-DEPLOYED-SKILLED-CRAFTING-APP
SC_PRINT_AGENT_TOKEN=YOUR-LONG-RANDOM-SECRET
SC_PRINT_EPSON_QUEUE=SC_Epson_2980
SC_PRINT_POLL_MS=30000
# SC_PRINT_MUNBYN_QUEUE=SC_Munbyn_941B
```
Example systemd service `/etc/systemd/system/skilledcrafting-print-agent.service` (adjust the actual unprivileged user and path as applicable):
```ini
[Unit]
Description=Skilled Crafting Pi Print Agent
After=network-online.target cups.service
Wants=network-online.target

[Service]
Type=simple
User=pi
EnvironmentFile=/etc/skilledcrafting/print-agent.env
ExecStart=/usr/bin/node /opt/skilledcrafting/print-agent.mjs
Restart=on-failure
RestartSec=15
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now skilledcrafting-print-agent
sudo systemctl status skilledcrafting-print-agent --no-pager
journalctl -u skilledcrafting-print-agent -n 30 --no-pager
```
**Ensure the chosen unprivileged service user can read its environment file**: if `User=pi` and the environment file is root-owned mode 600, systemd reads it as PID1 before switching to `pi`, which is supported; test actual environment availability through service status rather than printing secrets. Never expose the token to JavaScript in the browser.

After source verification and Epson printer local CUPS test, set `SC_PRINT_DISPATCH_ENABLED=true` in Netlify. Leave `SC_PRINT_THERMAL_ENABLED=false` until Munbyn USB/CUPS works. Now queue a single internal SHOP copy from the app and verify CUPS spool history and physical output. Only after the Munbyn 4x6 test should the full Standard Packet action be used.

## Things not to confuse
- Saving the PDFs or queuing them is NOT the same as physically printing, packing, shipping, closing a job, changing WooCommerce status or marking an invoice paid.
- QuickBooks authorization does not create/send or edit invoices; only reads originals. Access/refresh tokens must rotate and be stored securely.
- A SKU assigned to an approved recipe is not proof of customer artwork approval for a historical order. Review approved files and sample placement before applying profiles.
- For distributed school orders and multiple boxes, contents per package need explicit packing evidence. Until then multi-package labels do not list the full order in every package.
