function clean(value) {
  return String(value ?? '').trim();
}

function normalizeHeader(value) {
  return clean(value)
    .replace(/:+$/, '')
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

function normalizeKey(value) {
  return clean(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function numberValue(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = Number(clean(value).replace(/[$,]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function fileStem(fileName) {
  const safe = clean(fileName).split(/[\\/]/).pop() || '';
  return safe.replace(/\.(xlsx?|xls)$/i, '').replace(/\.[^.]+$/, '') || 'sanmar-order';
}

function headerMap(row) {
  const map = new Map();
  row.forEach((value, index) => {
    const key = normalizeHeader(value);
    if (key && !map.has(key)) map.set(key, index);
  });
  return map;
}

function columnIndex(map, ...names) {
  for (const name of names) {
    const index = map.get(normalizeHeader(name));
    if (index != null) return index;
  }
  return -1;
}

function cell(row, map, ...names) {
  const index = columnIndex(map, ...names);
  return index >= 0 ? clean(row?.[index]) : '';
}

function hasRequiredSanMarHeaders(row) {
  const headers = new Set(row.map(normalizeHeader));
  return ['STYLE', 'COLOR', 'SIZE', 'PIECES', 'PRICE', 'AMOUNT']
    .every((name) => headers.has(name));
}

function orderNumberFrom(row, map, fileName) {
  return cell(
    row,
    map,
    'ORDER NUMBER',
    'ORDER NO',
    'ORDER #',
    'INVOICE NUMBER',
    'INVOICE NO',
    'INVOICE #',
  ) || fileStem(fileName);
}

/**
 * Convert SanMar worksheet rows (SheetJS `sheet_to_json(..., { header: 1 })`)
 * into the supplier-receiving confirmation contract used by the inventory app.
 *
 * SanMar receipts do not expose a separate vendor SKU in the supplied workbook.
 * A stable Style + Color + Size key is therefore used as the supplier SKU and
 * receiving line key. Rows split across warehouses are aggregated so repeated
 * receipts retain a stable natural key.
 */
export function parseSanMarRows(rawRows, { fileName = 'sanmar.xls' } = {}) {
  const rows = Array.isArray(rawRows) ? rawRows : [];
  const headerRowIndex = rows.findIndex((row) => Array.isArray(row) && hasRequiredSanMarHeaders(row));
  if (headerRowIndex < 0) {
    throw new Error(
      'This Excel file does not match the SanMar receipt format. ' +
      'Expected columns: STYLE, COLOR, SIZE, PIECES, PRICE, and AMOUNT.'
    );
  }

  const headers = headerMap(rows[headerRowIndex]);
  const dataRows = rows.slice(headerRowIndex + 1).filter(Array.isArray);
  const firstDataRow = dataRows.find((row) => (
    cell(row, headers, 'STYLE') ||
    cell(row, headers, 'ORDERDATE', 'ORDER DATE') ||
    cell(row, headers, 'CUSTOMER NO', 'CUSTOMER NUMBER')
  )) || [];

  const grouped = new Map();
  for (const row of dataRows) {
    const style = cell(row, headers, 'STYLE');
    const color = cell(row, headers, 'COLOR');
    const size = cell(row, headers, 'SIZE');
    const quantity = numberValue(cell(row, headers, 'PIECES', 'QTY', 'QUANTITY'));
    if (!style || !color || !size || quantity <= 0) continue;

    const unitCost = numberValue(cell(row, headers, 'PRICE', 'UNIT PRICE', 'UNIT COST'));
    const reportedAmount = numberValue(cell(row, headers, 'AMOUNT', 'EXTENDED AMOUNT', 'TOTAL'));
    const lineAmount = reportedAmount || (unitCost * quantity);
    const warehouse = cell(row, headers, 'WAREHOUSE');
    const weight = numberValue(cell(row, headers, 'WEIGHT'));
    const groupingKey = [style, color, size].map(normalizeKey).join('|');

    const existing = grouped.get(groupingKey) || {
      style,
      color,
      size,
      quantity: 0,
      amount: 0,
      weightedCostAmount: 0,
      warehouses: new Set(),
      weight: 0,
    };

    existing.quantity += quantity;
    existing.amount += lineAmount;
    existing.weightedCostAmount += unitCost * quantity;
    existing.weight += weight;
    if (warehouse) existing.warehouses.add(warehouse);
    grouped.set(groupingKey, existing);
  }

  if (!grouped.size) {
    throw new Error('The SanMar Excel file did not contain any receivable item rows with a positive PIECES quantity.');
  }

  const lines = [...grouped.values()].map((item) => {
    const unitCost = item.quantity > 0
      ? (item.amount > 0 ? item.amount / item.quantity : item.weightedCostAmount / item.quantity)
      : 0;
    const warehouseText = [...item.warehouses].join(', ');
    const supplierSku = `${item.style} | ${item.color} | ${item.size}`;
    const supplierLineKey = `sanmar:${normalizeKey(item.style)}:${normalizeKey(item.color)}:${normalizeKey(item.size)}`;
    const descriptionParts = [item.style, item.color, item.size];
    if (warehouseText) descriptionParts.push(`Warehouse: ${warehouseText}`);

    return {
      supplier_line_key: supplierLineKey,
      supplier_sku: supplierSku,
      description: descriptionParts.join(' / '),
      brand: '',
      style: item.style,
      color: item.color,
      size: item.size,
      ordered_quantity: item.quantity,
      unit_cost: Number(unitCost.toFixed(4)),
      line_total: Number(item.amount.toFixed(2)),
      source_page: 1,
      warehouse: warehouseText,
      weight: Number(item.weight.toFixed(4)),
    };
  });

  const totalUnits = lines.reduce((sum, line) => sum + Number(line.ordered_quantity || 0), 0);
  const subtotal = lines.reduce((sum, line) => sum + Number(line.line_total || 0), 0);

  return {
    supplier_key: 'sanmar',
    supplier_name: 'SanMar',
    order_number: orderNumberFrom(firstDataRow, headers, fileName),
    po_number: cell(firstDataRow, headers, 'CUSTOMER PO', 'PO', 'PO NUMBER'),
    order_date: cell(firstDataRow, headers, 'ORDERDATE', 'ORDER DATE'),
    customer_number: cell(firstDataRow, headers, 'CUSTOMER NO', 'CUSTOMER NUMBER'),
    total_lines: lines.length,
    total_units: totalUnits,
    subtotal: Number(subtotal.toFixed(2)),
    lines,
  };
}
