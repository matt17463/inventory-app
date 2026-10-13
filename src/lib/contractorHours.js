export function localDate(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
export function periodRange(period, anchor = localDate()) {
  const date = new Date(anchor + 'T12:00:00');
  if (Number.isNaN(date.getTime())) throw new Error('Invalid report date');
  const start = new Date(date);
  const end = new Date(date);
  if (period === 'week') {
    start.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    end.setTime(start.getTime());
    end.setDate(start.getDate() + 6);
  } else if (period === 'month') {
    start.setDate(1);
    end.setMonth(start.getMonth() + 1, 0);
  } else if (period === 'quarter') {
    start.setMonth(Math.floor(date.getMonth() / 3) * 3, 1);
    end.setFullYear(start.getFullYear(), start.getMonth() + 3, 0);
  } else if (period === 'year') {
    start.setMonth(0, 1);
    end.setMonth(11, 31);
  } else {
    throw new Error('Unknown report period');
  }
  return { start: localDate(start), end: localDate(end) };
}

export function effectiveRate(rates, contractorId, workDate) {
  return rates.filter((r) => r.contractor_id === contractorId && r.effective_on <= workDate)
    .sort((a, b) => b.effective_on.localeCompare(a.effective_on))[0]?.hourly_rate ?? null;
}
export function contractorReport(entries, rates = []) {
  const rows = entries.map((entry) => {
    const rate = effectiveRate(rates, entry.contractor_id, entry.work_date);
    return { ...entry, rate, amount: rate === null || entry.hours === null ? null : Math.round(Number(entry.hours) * Number(rate) * 100) / 100 };
  });
  const billable = rows.filter((row) => !['void','open','rejected'].includes(row.status));
  const sumHours = (records) => Math.round(records.reduce((total, row) => total + Number(row.hours || 0), 0) * 100) / 100;
  const sumAmount = (records) => Math.round(records.reduce((total, row) => total + Number(row.amount || 0), 0) * 100) / 100;
  return {
    rows,
    totalHours: sumHours(billable),
    pendingHours: sumHours(rows.filter((row) => row.status === 'submitted')),
    approvedHours: sumHours(rows.filter((row) => row.status === 'approved')),
    paidHours: sumHours(rows.filter((row) => row.status === 'paid')),
    dueAmount: sumAmount(rows.filter((row) => row.status === 'approved')),
    paidAmount: sumAmount(rows.filter((row) => row.status === 'paid')),
  };
}
function csvCell(value) {
  const text = String(value ?? '');
  // Avoid spreadsheet formula injection from user-entered contractor names and notes.
  const safe = /^[\s]*[=+@\-]/.test(text) ? "'" + text : text;
  return '"' + safe.replace(/"/g, '""') + '"';
}
export function contractorCsv(rows, names = {}) {
  const headings = ['Contractor','Work date','Method','Start','End','Hours','Activity','Notes','Status','Hourly rate','Amount'];
  return [headings.map(csvCell).join(','), ...rows.map((row) =>
    [names[row.contractor_id] || row.contractor_id,row.work_date,row.method,
      row.started_at || '',row.ended_at || '',row.hours ?? '',row.activity,row.notes,row.status,
      row.rate ?? '',row.amount ?? ''].map(csvCell).join(','),
  )].join('\r\n');
}
