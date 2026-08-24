import readXlsxFile from 'read-excel-file/browser';

const MAX_SPREADSHEET_BYTES = 15 * 1024 * 1024;
const MAX_SPREADSHEET_ROWS = 50000;

function clean(value) {
  return String(value ?? '').trim();
}

function extension(fileName) {
  return clean(fileName).toLowerCase().split('.').pop() || '';
}

function uniqueHeaders(values) {
  const counts = new Map();
  return values.map((value, index) => {
    const base = clean(value) || `Column ${index + 1}`;
    const count = (counts.get(base) || 0) + 1;
    counts.set(base, count);
    return count === 1 ? base : `${base} (${count})`;
  });
}

export function matrixToObjects(matrix = []) {
  if (!Array.isArray(matrix) || !matrix.length) return [];
  const headers = uniqueHeaders(matrix[0] || []);
  return matrix.slice(1).map((values) => Object.fromEntries(
    headers.map((header, index) => [header, values?.[index] ?? ''])
  ));
}

export function parseDelimitedText(text, delimiter = null) {
  const source = String(text || '').replace(/^\uFEFF/, '');
  const firstLine = source.split(/\r?\n/, 1)[0] || '';
  const separator = delimiter || (firstLine.split('\t').length > firstLine.split(',').length ? '\t' : ',');
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (char === '"') {
      if (quoted && next === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === separator && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(cell);
      if (row.some((value) => clean(value))) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((value) => clean(value))) rows.push(row);
  return rows;
}

function validateSize(size, fileName) {
  if (Number(size || 0) > MAX_SPREADSHEET_BYTES) {
    throw new Error(`${fileName || 'Spreadsheet'} is larger than 15 MB. Split it into smaller files before importing.`);
  }
}

function validateRows(rows, fileName) {
  if (rows.length > MAX_SPREADSHEET_ROWS) {
    throw new Error(`${fileName || 'Spreadsheet'} contains more than 50,000 rows. Split it into smaller files before importing.`);
  }
  return rows;
}

export async function readSpreadsheetSheets(input, fileName = '', size = 0) {
  const kind = extension(fileName);
  validateSize(size || input?.size || input?.byteLength, fileName);

  if (kind === 'csv' || kind === 'txt' || kind === 'tsv') {
    const text = typeof input === 'string'
      ? input
      : input instanceof Blob
        ? await input.text()
        : new TextDecoder('utf-8').decode(input instanceof Uint8Array ? input : new Uint8Array(input));
    const data = validateRows(parseDelimitedText(text), fileName);
    return [{ sheet: 'Sheet1', data }];
  }

  if (!['xlsx', 'xlsm'].includes(kind)) {
    throw new Error('Use an XLSX, XLSM, CSV, TSV, or TXT file. Legacy XLS files should be saved as XLSX or CSV first.');
  }

  const sheets = await readXlsxFile(input);
  sheets.forEach((sheet) => validateRows(sheet.data || [], `${fileName} — ${sheet.sheet}`));
  return sheets;
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function downloadCsvTemplate(fileName, columns, rows) {
  const lines = [columns, ...(rows || []).map((row) => columns.map((column) => row[column] ?? ''))]
    .map((values) => values.map(csvCell).join(','));
  const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export const spreadsheetLimits = {
  maxBytes: MAX_SPREADSHEET_BYTES,
  maxRows: MAX_SPREADSHEET_ROWS,
};
