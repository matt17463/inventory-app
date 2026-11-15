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
  omni_studio: 'Omni device feed',
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
    status: ['Operating status', '', ['idle', 'printing', 'paused', 'maintenance', 'error', 'offline', 'sleep',
      'low_power_or_sleep', 'initializing', 'measuring', 'ready', 'firmware_update', 'wifi_setup']],
    uv_head_1_mode: ['UV head 1 mode', '', ['normal', 'sleep', 'vacation']],
    uv_head_2_mode: ['UV head 2 mode', '', ['normal', 'sleep', 'vacation']],
    front_door_open: ['Front door open'],
    rear_door_open: ['Rear door open'],
    lid_open: ['Top lid open'],
    air_filter_installed: ['Air filter installed'],
    active_alarms: ['Active alarms', '', 0, 1000],
    job_progress_pct: ['Current job progress', '%', 0, 100],
    job_remaining_s: ['Estimated time remaining', 's', 0, 604800],
    queued_jobs: ['Queued jobs', '', 0, 10000],
    operating_count: ['Operating cycles', '', 0, 10000000],
    working_hours: ['Total working time', 'h', 0, 1000000],
    standby_hours: ['Total standby time', 'h', 0, 1000000],
    uv_lamp_hours: ['UV lamp runtime', 'h', 0, 1000000],
    purifier_hours: ['Air purifier runtime', 'h', 0, 1000000],
    last_job_duration_s: ['Last job duration', 's', 0, 604800],
    wifi_signal_dbm: ['Wi-Fi signal', 'dBm', -130, 0],
    uv_cyan_pct: ['UV cyan ink', '%', 0, 100],
    uv_magenta_pct: ['UV magenta ink', '%', 0, 100],
    uv_yellow_pct: ['UV yellow ink', '%', 0, 100],
    uv_black_pct: ['UV black ink', '%', 0, 100],
    uv_white_pct: ['UV white ink', '%', 0, 100],
    uv_varnish_pct: ['UV varnish', '%', 0, 100],
    moisturizing_liquid_1_pct: ['UV head 1 moisturizing liquid', '%', 0, 100],
    moisturizing_liquid_2_pct: ['UV head 2 moisturizing liquid', '%', 0, 100],
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
  if (row.printer_id === 'omni' && row.readings.air_filter_installed === false) alertNames.push('Air filter missing');
  if (row.printer_id === 'omni' && row.readings.active_alarms > 0) {
    const count = row.readings.active_alarms;
    alertNames.push(`${count} active printer alarm${count === 1 ? '' : 's'}`);
  }
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
