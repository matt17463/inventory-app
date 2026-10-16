export const BUSINESS_HA = 'http://100.117.18.123:8123';
export const MAC_DESKTOP = 'vnc://100.117.18.123:15900';
export const PI_DESKTOP = 'https://connect.raspberrypi.com/devices/e0cfb85e-f7f4-4c2b-b4e3-5267dd2dd017/screen-sharing-session';
export const PRIVATE_HA = 'https://scshoppi.tail934ae0.ts.net';
export const equipment = [
  { id: 'roland', name: 'Roland BN2-30', maker: 'ROLAND DG', category: 'Print & cut', site: 'business', image: 'roland.webp', address: '192.168.1.159', entities: ['sensor.roland_bn2_30_operating_status', 'binary_sensor.roland_bn2_30_manual_cleaning_requested', 'sensor.roland_bn2_30_manual_cleaning_age', 'sensor.roland_bn2_30_jobs_7d', 'sensor.roland_bn2_30_last_job_duration', 'sensor.roland_bn2_30_hub_updated'], stage: 'Telemetry configured', detail: 'Connect Hub reports status, maintenance flags, recent jobs and recorded error counters every minute while the business Mac and Hub are running. Cleaning age is estimated; stale readings become unavailable.', action: 'Maintenance, jobs & errors', haPath: '/skilled-crafting/roland' },
  { id: 's1', name: 'xTool S1', maker: 'XTOOL', category: 'Laser', site: 'business', image: 's1.webp', entities: [], stage: 'Awaiting connection', detail: 'Prepared for your S1. Connect it to business Wi-Fi in xTool Studio, then add its verified monitoring integration.', action: 'Connection guide', url: 'https://support.xtool.com/article/1082' },
  { id: 'p2', name: 'xTool P2', maker: 'XTOOL', category: 'Laser', site: 'business', image: 'p2.webp', entities: [], stage: 'Awaiting connection', detail: 'Prepared for your P2. Pair it in xTool Studio before enabling status or camera monitoring.', action: 'Connection guide', url: 'https://support.xtool.com/article/824' },
  { id: 'sawgrass', name: 'Sawgrass SG500', maker: 'SAWGRASS', category: 'Sublimation', site: 'business', image: 'sawgrass.webp', address: '192.168.1.171', entities: ['sensor.sawgrass_sg500_printer_message', 'sensor.sawgrass_sg500_black_ink', 'sensor.sawgrass_sg500_cyan_ink', 'sensor.sawgrass_sg500_magenta_ink', 'sensor.sawgrass_sg500_yellow_ink', 'sensor.sawgrass_sg500_waste_collector_used', 'sensor.sawgrass_sg500_lifetime_sheets'], stage: 'Telemetry configured', detail: 'Local printer readings include ink levels, waste-collector usage, lifetime sheets and printer message. Open the printer view for tray readings and all available details.', action: 'Printer readings', haPath: '/skilled-crafting/printers' },
  { id: 'epson', name: 'Epson ET-2980', maker: 'EPSON', category: 'Printer', site: 'business', image: 'epson.webp', address: '192.168.1.233', entities: ['sensor.epson_et_2980_series', 'sensor.epson_et_2980_series_black', 'sensor.epson_et_2980_series_cyan', 'sensor.epson_et_2980_series_magenta', 'sensor.epson_et_2980_series_yellow'], stage: 'Integration added', detail: 'Printer status and reported black, cyan, magenta and yellow supply levels.' },
  { id: 'pi', name: 'Business Pi 5', maker: 'RASPBERRY PI', category: 'Control hub', site: 'business', image: 'pi.webp', address: '100.117.18.123', entities: ['sensor.backup_last_successful_automatic_backup'], stage: 'Visual desktop verified', detail: 'Home Assistant, Tailscale and SSH. Raspberry Pi Connect is linked and its visual desktop has been verified.', action: 'Open visual desktop', url: PI_DESKTOP },
  { id: 'mac', name: 'Business MacBook Pro', maker: 'APPLE', category: 'Workstation', site: 'business', image: 'mac.webp', address: '100.106.153.72', entities: ['binary_sensor.business_macbook_screen_sharing'], stage: 'Private Mac relay ready', detail: 'Private Screen Sharing through the business Pi, with the Mac’s own login. The Mac must be awake and Screen Sharing enabled.', action: 'Open Screen Sharing', url: MAC_DESKTOP },
  { id: 'kasa', name: 'Kasa HS200 switch', maker: 'TP-LINK', category: 'Smart switch', site: 'business', image: 'kasa.webp', address: '192.168.1.247', entities: ['switch.business_hs200_switch'], stage: 'Integration added', detail: 'Local switch integration. Confirm what it powers before operating it.' },
  { id: 'reolink', name: 'Reolink cameras', maker: 'REOLINK', category: 'Security', site: 'business', entities: [], stage: 'Credentials needed', detail: 'Reolink devices discovered on the business network. Add each device using its local camera account in Home Assistant.' },
  { id: 'swann', name: 'Swann NVR8-7250', maker: 'SWANN', category: 'Recorder', site: 'business', entities: [], stage: 'Compatibility check', detail: 'Recorder found at 192.168.1.205. ONVIF or RTSP support and credentials still need verification.' },
  { id: 'nas', name: 'Synology DS718+', maker: 'SYNOLOGY', category: 'Storage', site: 'home', image: 'nas.webp', entities: [], stage: 'Home visit pending', detail: 'Home NAS reserved in this view. Home network discovery and remote access remain pending; local addresses overlap with business.', action: 'NAS integration guide', url: 'https://www.home-assistant.io/integrations/synology_dsm/' },
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
  if (/xtool|laser|roland|bn2/i.test(`${entity.entity_id} ${entity.attributes?.friendly_name || ''}`)) return null;
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
