# xTool O1 Omni monitoring

The production Pi already has the shared printer dashboard and Roland relay. The Omni relay is optional and uses its own credential. Equipment & Remote Access and the Home Assistant Printer Monitoring dashboard display fresh Omni data and timestamp it when the relay is enabled.

## Prepare an isolated pilot

1. On the Business Mac, connect the Omni in xTool Studio. In **Device settings → Basic Info → Wi-Fi settings**, confirm the printer address. Reserve this address on the business network. Record the firmware and confirm the device identity in Device Health. Establish the certificate fingerprint from an independently verified connection to that printer. A certificate collected from an unverified network address does not establish identity on its own.
2. Check out [the reviewed community release](https://github.com/thecodingdad/ha-xtool/releases/tag/v2.8.0). Run the following to build an isolated copy. The script archives the pinned commit and verifies the protocol file before applying the local restrictions.

   ```sh
   python3 deployment/home-assistant/prepare_omni_collector.py \
     /path/to/ha-xtool-checkout /path/to/new/xtool \
     --host YOUR_OMNI_IP --fingerprint VERIFIED_CERTIFICATE_SHA256
   ```

   Place that output in the isolated Home Assistant configuration under `custom_components/xtool`. Keep the test container separate from the live Home Assistant installation and restrict its device traffic to the Omni. Add the Omni by its reserved address. Keep smart-plug and firmware-update features disabled. The collector requires the verified certificate on its WebSocket connections, permits read requests and disables file streams. A certificate change requires a new verified build.

3. Compare actual entities against Studio Device Health. Test disconnect and reconnect, including the effect on Studio. Check status, both UV temperatures, ambient temperature and humidity, ink, moisturizing liquid, waste cartridge, filter presence, doors, alarms, power state, print-job progress and lifetime counters wherever the firmware reports them. Use the Studio UI for per-head Sleep and Wake and printer Vacation Mode. The community collector combines sleep and low power in its general status, so the relay leaves hardware mode **Unknown** unless a distinct, explicitly verified mode entity is mapped. Report per-head modes individually when exposed.

## Connect the shared feed

1. Deploy the bridge and UI changes once the pilot and app checks pass. Generate a separate random 32-byte token encoded as lowercase hexadecimal. Save only its SHA-256 digest in `sc_printer_bridge_credentials` under `omni_events`. Put the token in the Pi's protected `secrets.yaml` as `sc_omni_event_authorization: "Bearer TOKEN"`. Reuse the existing HTTPS `sc_printer_activity_url` entry.
2. Install `deployment/home-assistant/packages/skilled_crafting_omni_relay.yaml` and copy the blueprint under `blueprints/automation/skilled_crafting/`. Create an automation from **Skilled Crafting Omni health relay**. Select the live status entity, then map only entities verified for this printer. The blueprint accepts entity IDs or an object with `entity` and `attribute`. Example shape, with illustrative entity IDs:

   ```yaml
   uv_head_1_c: sensor.example_omni_head_1_temperature
   humidity_pct: sensor.example_omni_humidity
   front_door_open: binary_sensor.example_omni_front_door
   waste_ink_installed:
     entity: sensor.example_omni_waste_tank
     attribute: installed
   ```

   The blueprint lists the accepted metric keys and units. It converts lifetime seconds to hours where applicable. It relays device health only. Operators continue to confirm successful production prints in the app. The desktop Studio shortcut in Equipment & Remote Access opens the Business Mac for physical mode changes.

3. Run Home Assistant's configuration check. Verify recurring reports in both dashboards and confirm that readings disappear after the feed goes stale. Verify that missing fields stay unknown and that the existing Roland relay still updates. Record the tested firmware, entity mappings and certificate fingerprint with the shop's configuration records. To roll back, disable the Omni relay automation and restore the saved Home Assistant configuration. Disable the Omni credential if the collector is removed.

## Local checks

Run `npm run test:equipment`, `npm run functions:esm`, and `npm run build`. Run `python3 scripts/tests/omni-relay-template.test.py` in a test environment with PyYAML and Jinja2. These checks don't exercise the physical printer.
