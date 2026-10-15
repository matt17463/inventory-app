export const BUSINESS_HA = 'http://100.117.18.123:8123';
export const PRIVATE_HA = 'https://scshoppi.tail934ae0.ts.net';
export const equipment = [
  { id: 'roland', name: 'Roland BN2-30', maker: 'ROLAND DG', category: 'Print & cut', site: 'business', image: 'roland.webp', address: '192.168.1.159', entities: ['binary_sensor.roland_bn2_30_connection'], stage: 'Discovered', detail: 'Network connection monitoring. Ink, jobs and maintenance are available in Roland DG Connect; the Home Assistant telemetry connection is pending.', action: 'Roland DG Connect', url: 'https://connect.rolanddg.com/' },
  { id: 's1', name: 'xTool S1', maker: 'XTOOL', category: 'Laser', site: 'business', image: 's1.webp', entities: [], stage: 'Awaiting connection', detail: 'Prepared for your S1. Connect it to business Wi-Fi in xTool Studio, then add its verified monitoring integration.', action: 'Connection guide', url: 'https://support.xtool.com/article/1082' },
  { id: 'p2', name: 'xTool P2', maker: 'XTOOL', category: 'Laser', site: 'business', image: 'p2.webp', entities: [], stage: 'Awaiting connection', detail: 'Prepared for your P2. Pair it in xTool Studio before enabling status or camera monitoring.', action: 'Connection guide', url: 'https://support.xtool.com/article/824' },
  { id: 'sawgrass', name: 'Sawgrass SG500', maker: 'SAWGRASS', category: 'Sublimation', site: 'business', image: 'sawgrass.webp', address: '192.168.1.171', entities: ['sensor.sawgrass_sg500'], stage: 'Integration added', detail: 'Local IPP printer status. Additional sensors appear only when the printer reports them.' },
  { id: 'epson', name: 'Epson ET-2980', maker: 'EPSON', category: 'Printer', site: 'business', image: 'epson.webp', address: '192.168.1.233', entities: ['sensor.epson_et_2980_series', 'sensor.epson_et_2980_series_black', 'sensor.epson_et_2980_series_cyan', 'sensor.epson_et_2980_series_magenta', 'sensor.epson_et_2980_series_yellow'], stage: 'Integration added', detail: 'Printer status and reported black, cyan, magenta and yellow supply levels.' },
  { id: 'pi', name: 'Business Pi 5', maker: 'RASPBERRY PI', category: 'Control hub', site: 'business', image: 'pi.webp', address: '100.117.18.123', entities: ['sensor.backup_last_successful_automatic_backup'], stage: 'Home Assistant installed', detail: 'Home Assistant, Tailscale and SSH. Raspberry Pi Connect visual desktop is awaiting account setup.', action: 'Visual desktop setup', url: 'https://connect.raspberrypi.com/' },
  { id: 'mac', name: 'Business MacBook Pro', maker: 'APPLE', category: 'Workstation', site: 'business', image: 'mac.webp', address: '100.106.153.72', entities: ['binary_sensor.business_macbook_connection'], stage: 'Screen Sharing configured', detail: 'Open the macOS Screen Sharing application over Tailscale. The Mac must be awake and signed in.', action: 'Open Screen Sharing', url: 'vnc://100.106.153.72' },
  { id: 'kasa', name: 'Kasa HS200 switch', maker: 'TP-LINK', category: 'Smart switch', site: 'business', image: 'kasa.webp', address: '192.168.1.247', entities: ['switch.business_hs200_switch'], stage: 'Integration added', detail: 'Local switch integration. Confirm what it powers before operating it.' },
  { id: 'reolink', name: 'Reolink cameras', maker: 'REOLINK', category: 'Security', site: 'business', entities: [], stage: 'Credentials needed', detail: 'Reolink devices discovered on the business network. Add each device using its local camera account in Home Assistant.' },
  { id: 'swann', name: 'Swann NVR8-7250', maker: 'SWANN', category: 'Recorder', site: 'business', entities: [], stage: 'Compatibility check', detail: 'Recorder found at 192.168.1.205. ONVIF or RTSP support and credentials still need verification.' },
  { id: 'nas', name: 'Synology DS718+', maker: 'SYNOLOGY', category: 'Storage', site: 'home', image: 'nas.webp', entities: [], stage: 'Home visit pending', detail: 'Home NAS reserved in this view. Home network discovery and remote access remain pending; local addresses overlap with business.' },
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
  return { label: `${entity.state}${entity.attributes?.unit_of_measurement ? ` ${entity.attributes.unit_of_measurement}` : ''}`, kind: 'good' };
}
