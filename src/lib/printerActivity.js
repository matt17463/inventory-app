export const PRINTERS = [
  { id: 'roland', name: 'Roland BN2-30' },
  { id: 'omni', name: 'xTool O1 Omni Dual UV' },
];

export const DAY_MS = 86400000;
export const TELEMETRY_MAX_AGE_MS = 5 * 60000;
export const PRINTER_MODES = ['unknown', 'normal', 'sleep', 'vacation'];
export const SOURCE_LABELS = {
  staff: 'Staff confirmation',
  roland_connect: 'Roland Connect Hub',
  omni_studio: 'xTool Studio feed',
};

export const METRICS = {
  roland: {
    status: ['Operating status', '', ['idle', 'printing', 'paused', 'maintenance', 'error', 'offline', 'sleep']],
    cleaning_requested: ['Manual cleaning requested'],
    driver_state: ['Connect Hub state', '', /^[A-Z0-9_]{1,64}$/],
    drain_bottle_warning: ['Drain bottle warning'],
    wiper_change_requested: ['Wiper change requested'],
    head_protection_warning: ['Head protection warning'],
    felt_replacement_requested: ['Felt replacement requested'],
    cap_top_replacement_requested: ['Cap top replacement requested'],
    ink_expired: ['Ink expiration warning'],
    wiper_pad_replacement_requested: ['Wiper pad replacement requested'],
    forced_cleaning_due: ['Forced cleaning warning'],
    cleaning_age_days: ['Estimated manual cleaning age', 'days', 0, 20000],
    black_ink_pct: ['Estimated black ink', '%', 0, 100],
    cyan_ink_pct: ['Estimated cyan ink', '%', 0, 100],
    yellow_ink_pct: ['Estimated yellow ink', '%', 0, 100],
    magenta_a_ink_pct: ['Estimated magenta A ink', '%', 0, 100],
    magenta_b_ink_pct: ['Estimated magenta B ink', '%', 0, 100],
    jobs_7d: ['Job records (7 days)', '', 0, 100000],
    power_w: ['Power draw', 'W', 0, 10000],
    energy_today_kwh: ['Energy today', 'kWh', 0, 1000],
    voltage_v: ['Voltage', 'V', 0, 500],
    error_count: ['Recorded errors', '', 0, 1000000],
  },
  omni: {
    status: ['Operating status', '', ['idle', 'printing', 'paused', 'maintenance', 'error', 'offline', 'sleep']],
    uv_head_1_c: ['UV head 1 temperature', '°C', -20, 120],
    uv_head_2_c: ['UV head 2 temperature', '°C', -20, 120],
    ambient_c: ['Ambient temperature', '°C', -30, 100],
    humidity_pct: ['Relative humidity', '%', 0, 100],
    waste_ink_installed: ['Waste cartridge installed'],
    waste_ink_full: ['Waste cartridge full'],
    moisturizing_liquid_low: ['Moisturizing liquid low'],
    ink_low: ['Ink low'],
    ink_pad_remaining_pct: ['Ink pad life', '%', 0, 100],
    ink_scraper_remaining_pct: ['Ink scraper life', '%', 0, 100],
  },
};

const WARNING_METRICS = {
  roland: ['cleaning_requested', 'drain_bottle_warning', 'wiper_change_requested', 'head_protection_warning',
    'felt_replacement_requested', 'cap_top_replacement_requested', 'ink_expired',
    'wiper_pad_replacement_requested', 'forced_cleaning_due'],
  omni: ['waste_ink_full', 'moisturizing_liquid_low', 'ink_low'],
};

function activeHardwareWarnings(row, telemetry) {
  if (telemetry !== 'fresh' || !row.readings || !Object.hasOwn(WARNING_METRICS, row.printer_id)) return [];
  const alertNames = WARNING_METRICS[row.printer_id]
    .filter((name) => row.readings[name] === true)
    .map((name) => METRICS[row.printer_id][name][0]);
  if (row.readings.waste_ink_installed === false) alertNames.push('Waste cartridge missing');
  if (row.readings.status === 'error') alertNames.push('Printer reports an error');
  return alertNames;
}

export function printerStatus(row, now = Date.now()) {
  const printed = Date.parse(row?.last_print_at);
  const report = Date.parse(row?.telemetry_at);
  const age = now - report;
  const telemetry = !Number.isFinite(report) ? 'unavailable'
    : age < -60000 || age > TELEMETRY_MAX_AGE_MS ? 'stale' : 'fresh';
  const elapsed = now - printed;
  const remaining = row?.idle_days * DAY_MS - Math.max(0, elapsed);
  const status = !Number.isFinite(remaining) || elapsed < -60000 ? 'unknown'
    : remaining <= 0 ? 'overdue'
      : remaining <= row.warning_days * DAY_MS ? 'soon' : 'ok';
  return {
    status,
    due_at: status === 'unknown' ? null : new Date(printed + row.idle_days * DAY_MS).toISOString(),
    idle_days_elapsed: status === 'unknown' ? null : Math.floor(Math.max(0, elapsed) / DAY_MS),
    telemetry,
    hardware_alerts: activeHardwareWarnings(row, telemetry),
    verified_mode: telemetry === 'fresh' ? row.hardware_mode || 'unknown' : 'unknown',
    reminder_snoozed: status === 'soon' && Date.parse(row?.snoozed_until) > now,
  };
}
