export const BUSINESS_HA = 'http://100.117.18.123:8123';
export const MAC_DESKTOP = 'vnc://100.117.18.123:15900';
export const PI_DESKTOP = 'https://connect.raspberrypi.com/devices/e0cfb85e-f7f4-4c2b-b4e3-5267dd2dd017/screen-sharing-session';
export const PRIVATE_HA = 'https://scshoppi.tail934ae0.ts.net';
export const equipment = [
  {
    "id": "roland",
    "name": "Roland BN2-30",
    "maker": "ROLAND DG",
    "category": "Print & cut",
    "site": "business",
    "image": "roland.webp",
    "address": "192.168.1.160",
    "entities": [
      "sensor.roland_bn2_30_operating_status",
      "binary_sensor.roland_bn2_30_manual_cleaning_requested",
      "sensor.roland_bn2_30_jobs_7d",
      "sensor.roland_printer_current_consumption",
      "sensor.roland_printer_today_s_consumption",
      "sensor.roland_printer_voltage"
    ],
    "stage": "Check live status",
    "detail": "Roland printer telemetry and its separately monitored P115 power plug; measurements depend on working Home Assistant sensors.",
    "haPath": "/skilled-crafting/roland"
  },
  {
    "id": "s1",
    "name": "xTool S1",
    "maker": "XTOOL",
    "category": "Laser",
    "site": "business",
    "image": "s1.webp",
    "entities": [
      "sensor.xtool_s1_status",
      "binary_sensor.xtool_s1_alarm",
      "sensor.xtool_s1_fire_level",
      "sensor.xtool_s1_working_time",
      "sensor.xtool_s1_laser_module_runtime",
      "sensor.xtool_s1_laser_current_consumption",
      "sensor.xtool_s1_laser_today_s_consumption"
    ],
    "stage": "Registered in HA",
    "detail": "Machine status, safety warnings and P115 power readings. Laser operation is not exposed in Skilled Crafting."
  },
  {
    "id": "p2",
    "name": "xTool P2",
    "maker": "XTOOL",
    "category": "Laser",
    "site": "business",
    "image": "p2.webp",
    "entities": [
      "sensor.business_tool_p2_status",
      "binary_sensor.business_tool_p2_cover",
      "binary_sensor.business_tool_p2_water_line",
      "sensor.business_tool_p2_water_temperature",
      "sensor.business_tool_p2_water_flow_rate",
      "sensor.xtool_p2_laser_current_consumption",
      "sensor.xtool_p2_laser_today_s_consumption"
    ],
    "stage": "Registered in HA",
    "detail": "Machine status, cooling and water monitoring plus P115 consumption. No remote laser operation.",
    "cameraEntities": [
      "camera.business_tool_p2_overview_camera",
      "camera.business_tool_p2_close_up_camera"
    ]
  },
  {
    "id": "sawgrass",
    "name": "Sawgrass SG500",
    "maker": "SAWGRASS",
    "category": "Sublimation",
    "site": "business",
    "image": "sawgrass.webp",
    "address": "192.168.1.171",
    "entities": [
      "sensor.sawgrass_sg500",
      "sensor.sawgrass_sg500_printer_message",
      "sensor.sawgrass_sg500_black_ink",
      "sensor.sawgrass_sg500_cyan_ink",
      "sensor.sawgrass_sg500_magenta_ink",
      "sensor.sawgrass_sg500_yellow_ink"
    ],
    "stage": "Telemetry configured",
    "detail": "Printer connection and available supply readings. Some sensors come from YAML and may not appear in the device registry.",
    "haPath": "/skilled-crafting/printers"
  },
  {
    "id": "epson",
    "name": "Epson ET-2980",
    "maker": "EPSON",
    "category": "Printer",
    "site": "business",
    "image": "epson.webp",
    "entities": [
      "sensor.epson_et_2980_series",
      "sensor.epson_et_2980_series_black",
      "sensor.epson_et_2980_series_cyan",
      "sensor.epson_et_2980_series_magenta",
      "sensor.epson_et_2980_series_yellow"
    ],
    "stage": "Registered in HA",
    "detail": "Printer status and CMYK readings."
  },
  {
    "id": "bambu",
    "name": "Bambu H2C",
    "maker": "BAMBU LAB",
    "category": "3D printer",
    "site": "business",
    "entities": [
      "sensor.home_bambu_h2c_printer_print_status",
      "sensor.home_bambu_h2c_printer_print_progress",
      "sensor.home_bambu_h2c_printer_remaining_time",
      "sensor.home_bambu_h2c_printer_nozzle_temperature",
      "sensor.home_bambu_h2c_printer_bed_temperature",
      "binary_sensor.home_bambu_h2c_printer_print_error",
      "sensor.bambu_3d_printer_current_consumption",
      "sensor.bambu_3d_printer_today_s_consumption"
    ],
    "stage": "Registered in HA",
    "detail": "3D-printing telemetry and dedicated power plug. Existing entity IDs include home_ prefixes; confirm device location before moving dashboard groups.",
    "cameraEntities": [
      "camera.home_bambu_h2c_printer_camera"
    ]
  },
  {
    "id": "ams1",
    "name": "Bambu AMS2 Pro 1",
    "maker": "BAMBU LAB",
    "category": "3D printer accessory",
    "site": "business",
    "entities": [
      "sensor.home_bambu_ams2_pro_1_humidity",
      "sensor.home_bambu_ams2_pro_1_temperature",
      "binary_sensor.home_bambu_ams2_pro_1_drying"
    ],
    "stage": "Registered in HA",
    "detail": "Filament storage humidity and drying state."
  },
  {
    "id": "ams2",
    "name": "Bambu AMS2 Pro 2",
    "maker": "BAMBU LAB",
    "category": "3D printer accessory",
    "site": "business",
    "entities": [
      "sensor.home_bambu_ams2_pro_2_humidity",
      "sensor.home_bambu_ams2_pro_2_temperature",
      "binary_sensor.home_bambu_ams2_pro_2_drying"
    ],
    "stage": "Registered in HA",
    "detail": "Filament storage humidity and drying state."
  },
  {
    "id": "amsht",
    "name": "Bambu AMS HT",
    "maker": "BAMBU LAB",
    "category": "3D printer accessory",
    "site": "business",
    "entities": [
      "sensor.home_bambu_ams_ht_humidity",
      "sensor.home_bambu_ams_ht_temperature",
      "binary_sensor.home_bambu_ams_ht_drying"
    ],
    "stage": "Registered in HA",
    "detail": "Filament storage humidity and drying state."
  },
  {
    "id": "pi",
    "name": "Business Pi 5",
    "maker": "RASPBERRY PI",
    "category": "Control hub",
    "site": "business",
    "image": "pi.webp",
    "address": "100.117.18.123",
    "entities": [
      "sensor.backup_last_successful_automatic_backup"
    ],
    "stage": "HA hub",
    "detail": "Home Assistant, private network and backup status.",
    "url": "https://connect.raspberrypi.com/"
  },
  {
    "id": "mac",
    "name": "Business MacBook Pro",
    "maker": "APPLE",
    "category": "Workstation",
    "site": "business",
    "image": "mac.webp",
    "address": "100.106.153.72",
    "entities": [
      "binary_sensor.business_macbook_screen_sharing"
    ],
    "stage": "Remote access configured",
    "detail": "Screen sharing requires the Mac to be online and awake.",
    "url": "vnc://100.106.153.72"
  },
  {
    "id": "kasa",
    "name": "Kasa HS200 switch",
    "maker": "TP-LINK",
    "category": "Smart switch",
    "site": "business",
    "image": "kasa.webp",
    "entities": [
      "switch.business_hs200_switch"
    ],
    "stage": "Registered in HA",
    "detail": "Verify the connected load before remotely operating."
  },
  {
    "id": "entry",
    "name": "Reolink Business Entry",
    "maker": "REOLINK",
    "category": "Security",
    "site": "business",
    "address": "192.168.1.248",
    "entities": [
      "camera.business_entry_fluent",
      "binary_sensor.business_entry_motion",
      "binary_sensor.business_entry_person",
      "binary_sensor.business_entry_vehicle",
      "binary_sensor.business_entry_animal"
    ],
    "stage": "Registered in HA",
    "detail": "Direct-network RLC-520A; Home Assistant integration reconfigured after DHCP address change.",
    "cameraEntities": [
      "camera.business_entry_fluent"
    ]
  },
  {
    "id": "nvr",
    "name": "Reolink NVR RLN8-410",
    "maker": "REOLINK",
    "category": "Security",
    "site": "business",
    "address": "192.168.1.113",
    "entities": [
      "switch.nvr_record",
      "switch.nvr_push_notifications"
    ],
    "stage": "Registered in HA",
    "detail": "Recorder with separately registered camera channels. Monitoring only."
  },
  {
    "id": "reolink_front",
    "name": "Reolink front",
    "maker": "REOLINK",
    "category": "Security",
    "site": "business",
    "entities": [
      "camera.front_fluent",
      "binary_sensor.front_motion",
      "binary_sensor.front_person",
      "binary_sensor.front_vehicle"
    ],
    "stage": "Registered in HA",
    "detail": "NVR camera channel; view status and motion events.",
    "cameraEntities": [
      "camera.front_fluent"
    ]
  },
  {
    "id": "reolink_back",
    "name": "Reolink back",
    "maker": "REOLINK",
    "category": "Security",
    "site": "business",
    "entities": [
      "camera.back_fluent",
      "binary_sensor.back_motion",
      "binary_sensor.back_person",
      "binary_sensor.back_vehicle"
    ],
    "stage": "Registered in HA",
    "detail": "NVR camera channel; view status and motion events.",
    "cameraEntities": [
      "camera.back_fluent"
    ]
  },
  {
    "id": "reolink_front_left",
    "name": "Reolink front left",
    "maker": "REOLINK",
    "category": "Security",
    "site": "business",
    "entities": [
      "camera.front_left_fluent",
      "binary_sensor.front_left_motion",
      "binary_sensor.front_left_person",
      "binary_sensor.front_left_vehicle"
    ],
    "stage": "Registered in HA",
    "detail": "NVR camera channel; view status and motion events.",
    "cameraEntities": [
      "camera.front_left_fluent"
    ]
  },
  {
    "id": "reolink_camera1",
    "name": "Reolink camera1",
    "maker": "REOLINK",
    "category": "Security",
    "site": "business",
    "entities": [
      "camera.camera1_fluent",
      "binary_sensor.camera1_motion",
      "binary_sensor.camera1_person",
      "binary_sensor.camera1_vehicle"
    ],
    "stage": "Registered in HA",
    "detail": "NVR camera channel; view status and motion events.",
    "cameraEntities": [
      "camera.camera1_fluent"
    ]
  },
  {
    "id": "router",
    "name": "Archer AX11000",
    "maker": "TP-LINK",
    "category": "Network",
    "site": "business",
    "entities": [
      "binary_sensor.business_archer_ax11000_wan_status",
      "sensor.archer_ax11000_download_speed",
      "sensor.archer_ax11000_upload_speed"
    ],
    "stage": "Registered in HA",
    "detail": "Business internet connection and router throughput."
  },
  {
    "id": "swann",
    "name": "Swann NVR8-7250",
    "maker": "SWANN",
    "category": "Recorder",
    "site": "business",
    "entities": [],
    "stage": "Integration unverified",
    "detail": "No matching device was present in the provided Home Assistant registry; verify separately."
  },
  {
    "id": "nas",
    "name": "Synology NAS",
    "maker": "SYNOLOGY",
    "category": "Storage",
    "site": "home",
    "image": "nas.webp",
    "entities": [],
    "stage": "HA integration unverified",
    "detail": "Home NAS reachable through Tailscale according to previous network setup; no corresponding device in this registry inventory.",
    "url": "https://www.home-assistant.io/integrations/synology_dsm/"
  },
  {
    "id": "thecus",
    "name": "Thecus N5500",
    "maker": "THECUS",
    "category": "Storage",
    "site": "business",
    "address": "192.168.1.100",
    "entities": [
      "sensor.thecus_n5500_data_capacity",
      "sensor.thecus_n5500_data_used",
      "sensor.thecus_n5500_uptime",
      "sensor.thecus_n5500_network_received",
      "sensor.thecus_n5500_network_sent"
    ],
    "stage": "SNMP monitoring active",
    "detail": "Read-only live SNMP monitoring. RAID 5 with five disks was manually confirmed healthy on October 18, 2026; there is no live disk or RAID health sensor. Storage usage reflects the /raid0/data filesystem.",
    "url": "https://192.168.1.100/"
  },
  {
    "id": "power_roland_printer",
    "name": "roland printer P115",
    "maker": "TP-LINK",
    "category": "Power meter",
    "site": "business",
    "entities": [
      "sensor.roland_printer_current_consumption",
      "sensor.roland_printer_today_s_consumption",
      "sensor.roland_printer_this_month_s_consumption",
      "sensor.roland_printer_voltage",
      "sensor.roland_printer_current"
    ],
    "stage": "Registered in HA",
    "detail": "Read-only energy monitoring. Device power switching remains disabled in this view."
  },
  {
    "id": "power_bambu_3d_printer",
    "name": "bambu 3d printer P115",
    "maker": "TP-LINK",
    "category": "Power meter",
    "site": "business",
    "entities": [
      "sensor.bambu_3d_printer_current_consumption",
      "sensor.bambu_3d_printer_today_s_consumption",
      "sensor.bambu_3d_printer_this_month_s_consumption",
      "sensor.bambu_3d_printer_voltage",
      "sensor.bambu_3d_printer_current"
    ],
    "stage": "Registered in HA",
    "detail": "Read-only energy monitoring. Device power switching remains disabled in this view."
  },
  {
    "id": "power_xtool_s1_laser",
    "name": "xtool s1 laser P115",
    "maker": "TP-LINK",
    "category": "Power meter",
    "site": "business",
    "entities": [
      "sensor.xtool_s1_laser_current_consumption",
      "sensor.xtool_s1_laser_today_s_consumption",
      "sensor.xtool_s1_laser_this_month_s_consumption",
      "sensor.xtool_s1_laser_voltage",
      "sensor.xtool_s1_laser_current"
    ],
    "stage": "Registered in HA",
    "detail": "Read-only energy monitoring. Device power switching remains disabled in this view."
  },
  {
    "id": "power_xtool_p2_laser",
    "name": "xtool p2 laser P115",
    "maker": "TP-LINK",
    "category": "Power meter",
    "site": "business",
    "entities": [
      "sensor.xtool_p2_laser_current_consumption",
      "sensor.xtool_p2_laser_today_s_consumption",
      "sensor.xtool_p2_laser_this_month_s_consumption",
      "sensor.xtool_p2_laser_voltage",
      "sensor.xtool_p2_laser_current"
    ],
    "stage": "Registered in HA",
    "detail": "Read-only energy monitoring. Device power switching remains disabled in this view."
  }
];

export function validHaUrl(value, secureContext = true) {
  const url = new URL(value);
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('Use the Home Assistant base address without a path or credentials.');
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Enter an HTTP or HTTPS address.');
  if (secureContext && url.protocol !== 'https:') throw new Error('Live connection needs a private HTTPS Home Assistant address. The separate Home Assistant console still works over Tailscale.');
  return url.origin;
}

// Deliberately excludes locks, covers, laser commands, scripts, arbitrary services and firmware updates.
export function controlFor(entity, target) {
  const domain = entity?.entity_id?.split('.')[0];
  if (!['switch', 'light', 'fan'].includes(domain) || !['on', 'off'].includes(target)) return null;
  if (['unknown', 'unavailable'].includes(entity.state)) return null;
  if (/xtool|laser|roland|bn2|bambu|3d.printer|printer|reolink|nvr|record|camera/i.test(`${entity.entity_id} ${entity.attributes?.friendly_name || ''}`)) return null;
  return { domain, service: target === 'on' ? 'turn_on' : 'turn_off', target: { entity_id: entity.entity_id } };
}

export function entityPresentation(entity) {
  if (!entity) return { label: 'Not connected', kind: 'pending' };
  if (entity.state === 'unavailable' || entity.state === 'unknown') return { label: entity.state, kind: 'pending' };
  if (entity.attributes?.device_class === 'connectivity') return { label: entity.state === 'on' ? 'Reachable' : 'Unreachable', kind: entity.state === 'on' ? 'good' : 'warn' };
  if (entity.attributes?.device_class === 'problem') {
    if (!['on', 'off'].includes(entity.state)) return { label: 'Unknown status', kind: 'pending' };
    return { label: entity.state === 'on' ? 'Attention requested' : 'Clear', kind: entity.state === 'on' ? 'warn' : 'good' };
  }
  if (entity.attributes?.device_class === 'timestamp') {
    const timestamp = new Date(entity.state);
    return Number.isNaN(timestamp.getTime()) ? { label: 'Unknown time', kind: 'pending' } : { label: timestamp.toLocaleString(), kind: 'good' };
  }
  return { label: `${entity.state}${entity.attributes?.unit_of_measurement ? ` ${entity.attributes.unit_of_measurement}` : ''}`, kind: 'good' };
}
