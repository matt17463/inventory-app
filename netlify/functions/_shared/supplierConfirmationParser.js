function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function money(value) {
  const parsed = Number(String(value ?? '').replace(/[$,]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function integer(value) {
  const parsed = Number(String(value ?? '').replace(/[,]/g, ''));
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
}

function near(value, target, tolerance = 6) {
  return Math.abs(Number(value) - Number(target)) <= tolerance;
}

function regionForAnchor(cells, anchors, index) {
  const anchor = anchors[index];
  const upper = index === 0 ? Number.POSITIVE_INFINITY : (anchors[index - 1].y + anchor.y) / 2;
  const lower = index === anchors.length - 1 ? Number.NEGATIVE_INFINITY : (anchor.y + anchors[index + 1].y) / 2;
  return cells.filter((cell) => cell.y < upper && cell.y >= lower);
}

function joinedCells(cells) {
  return clean([...cells]
    .sort((left, right) => right.y - left.y || left.x - right.x)
    .map((cell) => cell.str)
    .join(' '));
}

function nearest(cells, anchor, predicate) {
  return [...cells]
    .filter(predicate)
    .sort((left, right) => Math.abs(left.y - anchor.y) - Math.abs(right.y - anchor.y) || left.x - right.x)[0] || null;
}

function inferredStyle(description) {
  const match = clean(description).match(/-\s*([A-Z0-9][A-Z0-9-]*)\s*$/i);
  return match ? match[1] : '';
}

function inferredBrand(description) {
  return clean(description).split(/\s+-\s+/)[0] || '';
}

function audienceFor(description) {
  const normalized = clean(description).toUpperCase();
  if (normalized.includes('YOUTH') || normalized.includes('KIDS')) return 'youth';
  if (normalized.includes('LADIES') || normalized.includes("WOMEN'S") || normalized.includes('WOMENS')) return 'womens';
  if (normalized.includes("MEN'S") || normalized.includes('MENS') || normalized.includes('UNISEX')) return 'adult';
  return '';
}

function pageCells(page) {
  return (page?.cells || [])
    .map((cell) => ({ x: Number(cell.x || 0), y: Number(cell.y || 0), str: clean(cell.str) }))
    .filter((cell) => cell.str);
}

function findHeaderValue(pages, labelPattern, valuePattern, options = {}) {
  for (const page of pages) {
    const cells = pageCells(page);
    const label = cells.find((cell) => labelPattern.test(cell.str));
    if (!label) continue;
    const candidates = cells.filter((cell) => valuePattern.test(cell.str) && cell.str !== label.str);
    const ranked = candidates.sort((left, right) => {
      const leftScore = Math.abs(left.y - label.y) + (left.y > label.y ? 100 : 0) + Math.abs(left.x - label.x) * 0.1;
      const rightScore = Math.abs(right.y - label.y) + (right.y > label.y ? 100 : 0) + Math.abs(right.x - label.x) * 0.1;
      return leftScore - rightScore;
    });
    const found = ranked.find((cell) => options.excludePattern ? !options.excludePattern.test(cell.str) : true);
    if (found) return clean(found.str.match(valuePattern)?.[0] || found.str);
  }
  return '';
}

function sameRowValue(pages, labelPattern, valuePattern) {
  for (const page of pages) {
    const cells = pageCells(page);
    const label = cells.find((cell) => labelPattern.test(cell.str));
    if (!label) continue;
    const value = cells
      .filter((cell) => cell.x > label.x && near(cell.y, label.y, 4) && valuePattern.test(cell.str))
      .sort((left, right) => left.x - right.x)[0];
    if (value) return clean(value.str.match(valuePattern)?.[0] || value.str);
  }
  return '';
}

function parseSsActivewear(pages) {
  const lines = [];
  for (const page of pages) {
    const cells = pageCells(page);
    const anchors = cells
      .filter((cell) => cell.x < 65 && /^[0-9A-F]{8}$/i.test(cell.str))
      .sort((left, right) => right.y - left.y);

    anchors.forEach((anchor, index) => {
      // S&S prints each item on one visual row. Keeping the region tight prevents
      // page headers/footers from being attached to the first or last item.
      const region = cells.filter((cell) => near(cell.y, anchor.y, 8));
      const sizeCell = nearest(region, anchor, (cell) => cell.x >= 420 && cell.x < 480 && near(cell.y, anchor.y, 8));
      const quantityCell = nearest(region, anchor, (cell) => cell.x >= 480 && cell.x < 520 && /^\d+$/.test(cell.str) && near(cell.y, anchor.y, 8));
      const priceCell = nearest(region, anchor, (cell) => cell.x >= 520 && cell.x < 560 && /^\d+[.,]\d{2}$/.test(cell.str) && near(cell.y, anchor.y, 8));
      const totalCell = nearest(region, anchor, (cell) => cell.x >= 560 && /^\d+[.,]\d{2}$/.test(cell.str) && near(cell.y, anchor.y, 8));
      const description = joinedCells(region.filter((cell) => cell.x >= 70 && cell.x < 335));
      const color = joinedCells(region.filter((cell) => cell.x >= 335 && cell.x < 420));
      const size = clean(sizeCell?.str);
      const quantity = integer(quantityCell?.str);
      if (!size || quantity <= 0) return;

      lines.push({
        supplier_line_key: anchor.str,
        supplier_sku: anchor.str,
        description,
        brand: inferredBrand(description),
        style: inferredStyle(description),
        color,
        size,
        audience: audienceFor(description),
        ordered_quantity: quantity,
        unit_cost: money(priceCell?.str),
        line_total: money(totalCell?.str),
        source_page: Number(page.pageNumber || 1),
      });
    });
  }

  const confirmationLabel = pages.flatMap(pageCells).find((cell) => /Order Confirmation:\s*\d+/i.test(cell.str));
  const orderNumber = clean(confirmationLabel?.str.match(/Order Confirmation:\s*(\d+)/i)?.[1]);
  // S&S leaves this field blank on some confirmations. Only accept a value on
  // the PO label's own row so a nearby address/order value is never mistaken for a PO.
  const poNumber = sameRowValue(pages, /^PO Number:/i, /[A-Z0-9-]{3,}/i);
  return {
    supplier_key: 'ss_activewear',
    supplier_name: 'S&S Activewear',
    order_number: orderNumber,
    po_number: poNumber,
    order_date: findHeaderValue(pages, /Order Confirmation:/i, /\d{1,2}\/\d{1,2}\/\d{4}/),
    lines,
  };
}

const MOMENTEC_SIZE_CODES = {
  XXS: '2S', XS: 'XS', S: 'S', M: 'M', L: 'L', XL: 'XL',
  '2XL': '2XL', '3XL': '3XL', '4XL': '4XL', '5XL': '5XL',
};

function splitMomentecItem(rawItem, displayedSize, explicitColor) {
  const text = clean(rawItem).replace(/\s+/g, ' ');
  const prefix = text.match(/^([A-Z0-9]+\.[A-Z0-9]+\.)/i)?.[1] || '';
  if (!prefix) return { supplierSku: text, color: clean(explicitColor), style: text.split('.')[0] || '' };
  const rest = text.slice(prefix.length);
  const expectedCode = MOMENTEC_SIZE_CODES[clean(displayedSize).toUpperCase()] || clean(displayedSize).toUpperCase();
  const code = rest.toUpperCase().startsWith(expectedCode) ? rest.slice(0, expectedCode.length) : (rest.match(/^[A-Z0-9]+/)?.[0] || '');
  const suffix = clean(rest.slice(code.length));
  return {
    supplierSku: `${prefix}${code}`,
    color: clean(explicitColor) || suffix,
    style: prefix.split('.')[0] || '',
  };
}

function parseMomentec(pages) {
  const lines = [];
  for (const page of pages) {
    const cells = pageCells(page);
    const anchors = cells
      .filter((cell) => cell.x < 45 && (/^\d{1,4}$/.test(cell.str) || /^\d{1,4}\s+[A-Z0-9]+\.[A-Z0-9]+\./i.test(cell.str)) && cell.y > 30)
      .map((cell) => {
        const merged = cell.str.match(/^(\d{1,4})\s+(.+)$/);
        return merged ? { ...cell, str: merged[1], mergedItem: merged[2] } : cell;
      })
      .sort((left, right) => right.y - left.y);

    anchors.forEach((anchor, index) => {
      const region = regionForAnchor(cells, anchors, index);
      const itemCell = anchor.mergedItem
        ? { x: 49.8, y: anchor.y, str: anchor.mergedItem }
        : nearest(region, anchor, (cell) => cell.x >= 45 && cell.x < 190 && /\./.test(cell.str) && near(cell.y, anchor.y, 6));
      const explicitColor = nearest(region, anchor, (cell) => cell.x >= 130 && cell.x < 190 && near(cell.y, anchor.y, 6));
      const sizeCell = nearest(region, anchor, (cell) => cell.x >= 190 && cell.x < 230 && near(cell.y, anchor.y, 6));
      const quantityCell = nearest(region, anchor, (cell) => cell.x >= 420 && cell.x < 480 && /^\d+$/.test(cell.str) && near(cell.y, anchor.y, 6));
      const priceCell = nearest(region, anchor, (cell) => cell.x >= 480 && cell.x < 525 && /^\d+[.,]\d{2}$/.test(cell.str) && near(cell.y, anchor.y, 6));
      const totalCell = nearest(region, anchor, (cell) => cell.x >= 525 && /^\d+[.,]\d{2}$/.test(cell.str) && near(cell.y, anchor.y, 6));
      const size = clean(sizeCell?.str);
      const quantity = integer(quantityCell?.str);
      if (!itemCell || !size || quantity <= 0) return;

      const description = joinedCells(region.filter((cell) => (
        cell.x >= 45 && cell.x < 400 && cell.y < anchor.y - 6 && cell.y >= anchor.y - 26 && !/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(cell.str)
      )));
      const item = splitMomentecItem(itemCell.str, size, explicitColor?.str);
      lines.push({
        supplier_line_key: item.supplierSku || `${page.pageNumber}-${anchor.str}`,
        supplier_sku: item.supplierSku,
        description,
        brand: '',
        style: item.style,
        color: item.color,
        size,
        audience: audienceFor(description),
        ordered_quantity: quantity,
        unit_cost: money(priceCell?.str),
        line_total: money(totalCell?.str),
        source_page: Number(page.pageNumber || 1),
        source_line_number: integer(anchor.str),
      });
    });
  }

  const descriptionByStyle = new Map();
  lines.forEach((line) => {
    if (line.description && !descriptionByStyle.has(line.style)) descriptionByStyle.set(line.style, line.description);
  });
  lines.forEach((line) => {
    if (!line.description) line.description = descriptionByStyle.get(line.style) || '';
    if (!line.audience) line.audience = audienceFor(line.description);
  });

  const orderNumber = pages.flatMap(pageCells).find((cell) => /^\d{10}$/.test(cell.str))?.str || '';
  const poNumber = findHeaderValue(pages, /Purchase Order Number/i, /^\d{8}$/);
  const orderDate = pages.flatMap(pageCells).find((cell) => /^\d{2}\/\d{2}\/\d{4}$/.test(cell.str))?.str || '';
  return {
    supplier_key: 'momentec',
    supplier_name: 'Momentec',
    order_number: clean(orderNumber),
    po_number: clean(poNumber),
    order_date: clean(orderDate),
    lines,
  };
}

export function parseSupplierConfirmationPages(pages) {
  const allText = pages.flatMap(pageCells).map((cell) => cell.str).join(' ');
  let parsed;
  if (/S&S Activewear/i.test(allText) && /Order Confirmation:/i.test(allText)) parsed = parseSsActivewear(pages);
  else if (/momentecbrands\.com|PO Box 14939/i.test(allText) && /ORDER CONFIRMATION/i.test(allText)) parsed = parseMomentec(pages);
  else throw new Error('This PDF is not a recognized S&S Activewear or Momentec order confirmation.');

  if (!parsed.order_number) throw new Error('The supplier order number could not be read from this confirmation.');
  if (!parsed.lines.length) throw new Error('No receiving line items could be read from this confirmation.');
  const duplicateKeys = parsed.lines.filter((line, index, rows) => rows.findIndex((candidate) => candidate.supplier_line_key === line.supplier_line_key) !== index);
  if (duplicateKeys.length) throw new Error('The confirmation contains duplicate supplier line identifiers and needs review before import.');
  return {
    ...parsed,
    total_lines: parsed.lines.length,
    total_units: parsed.lines.reduce((sum, line) => sum + Number(line.ordered_quantity || 0), 0),
    subtotal: Number(parsed.lines.reduce((sum, line) => sum + Number(line.line_total || 0), 0).toFixed(2)),
  };
}

export function supplierSizeCandidates(size, audience = '') {
  const raw = clean(size).toUpperCase();
  if (!raw) return [];
  const base = raw === 'ONE SIZE' || raw === 'OSFA' ? 'OS' : raw;
  const candidates = [raw, base];
  if (audience === 'youth') candidates.push(`Y${base}`);
  if (audience === 'womens') candidates.push(`W${base}`);
  if (audience === 'adult') candidates.push(`A${base}`);
  return [...new Set(candidates.filter(Boolean))];
}

export function supplierMatchKey(value) {
  return clean(value)
    .toLowerCase()
    .replace(/grey/g, 'gray')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '');
}
