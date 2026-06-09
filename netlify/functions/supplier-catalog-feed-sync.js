
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_KEY = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;

const MAX_ROWS_PER_RPC = Number(process.env.SUPPLIER_CATALOG_SYNC_CHUNK_SIZE || 500);
const MAX_ROWS_TOTAL = Number(process.env.SUPPLIER_CATALOG_SYNC_MAX_ROWS || 25000);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}

function requireConfig() {
  if (!SUPABASE_URL) throw new Error("Missing SUPABASE_URL or VITE_SUPABASE_URL.");
  if (!SUPABASE_KEY) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY.");
}

function clean(value) {
  return String(value ?? "").trim();
}

function normalize(value) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function numberValue(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(/[$,]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function parseCsv(csvText) {
  const rows = [];
  let current = [];
  let value = "";
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i += 1) {
    const char = csvText[i];
    const next = csvText[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      value += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      current.push(value);
      value = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      current.push(value);
      value = "";
      if (current.some((cell) => clean(cell) !== "")) rows.push(current);
      current = [];
      continue;
    }

    value += char;
  }

  current.push(value);
  if (current.some((cell) => clean(cell) !== "")) rows.push(current);

  return rows;
}

function rowToObject(headers, row) {
  const object = {};
  headers.forEach((header, index) => {
    object[header] = row[index] ?? "";
  });
  return object;
}

function columnValue(row, names) {
  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(row, name)) return row[name];
    const found = Object.keys(row).find((key) => normalize(key) === normalize(name));
    if (found) return row[found];
  }
  return "";
}

function mapSupplierRow(row, index) {
  return {
    source_row: index + 2,
    brand: clean(columnValue(row, ["Brand", "Manufacturer", "Mfg", "Vendor Brand"])),
    style: clean(columnValue(row, ["Style", "Style Number", "Style #", "Product Style", "Item Style", "Item Number", "Item #"])),
    color: clean(columnValue(row, ["Color", "Colour", "Color Name"])),
    size: clean(columnValue(row, ["Size", "Size Name"])),
    supplier_sku: clean(columnValue(row, ["Supplier SKU", "Vendor SKU", "Vendor Item", "Item Number", "Item #", "SKU", "Product SKU"])),
    upc: clean(columnValue(row, ["UPC", "Barcode", "GTIN", "EAN"])),
    unit_cost: numberValue(columnValue(row, ["Unit Cost", "Cost", "Price", "Net Price", "Customer Price", "Piece Price"])),
    case_pack_qty: numberValue(columnValue(row, ["Case Pack Qty", "Case Pack", "Pack Qty", "Pack Quantity", "Case Qty"])),
    description: clean(columnValue(row, ["Description", "Product Name", "Name", "Item Description"])),
    notes: clean(columnValue(row, ["Notes", "Note"])),
  };
}

function parseSupplierCatalogCsv(csvText) {
  const parsedRows = parseCsv(csvText);
  if (!parsedRows.length) return [];

  const headers = parsedRows[0].map((header) => clean(header));
  const dataRows = parsedRows.slice(1, MAX_ROWS_TOTAL + 1);

  return dataRows
    .map((row, index) => mapSupplierRow(rowToObject(headers, row), index))
    .filter((row) => row.brand || row.style || row.color || row.size || row.supplier_sku || row.upc || row.unit_cost !== null);
}

async function supabaseFetch(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: options.prefer || "return=representation",
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let body = null;

  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!response.ok) {
    const message = typeof body === "string" ? body : body?.message || body?.hint || body?.details || `Supabase request failed: ${response.status}`;
    throw new Error(message);
  }

  return body;
}

async function updateFeed(feedId, values) {
  return supabaseFetch(`/supplier_catalog_feeds?id=eq.${encodeURIComponent(feedId)}`, {
    method: "PATCH",
    body: JSON.stringify({
      ...values,
      updated_at: new Date().toISOString(),
    }),
  });
}

async function importRowsInChunks(feed, rows) {
  let catalogRowsInserted = 0;
  let blankProductsUpdated = 0;
  let chunksImported = 0;

  for (let start = 0; start < rows.length; start += MAX_ROWS_PER_RPC) {
    const chunk = rows.slice(start, start + MAX_ROWS_PER_RPC);
    chunksImported += 1;

    await updateFeed(feed.id, {
      last_sync_status: "running",
      last_sync_message: `Importing rows ${start + 1}-${start + chunk.length} of ${rows.length}...`,
      last_row_count: rows.length,
    });

    const result = await supabaseFetch(`/rpc/import_supplier_catalog_rows`, {
      method: "POST",
      body: JSON.stringify({
        p_supplier_name: feed.supplier_name,
        p_source_file_name: feed.source_file_name || feed.feed_name || feed.feed_url,
        p_rows: chunk,
        p_update_blank_products: Boolean(feed.update_blank_products),
        p_create_missing_lookups: Boolean(feed.create_missing_lookups),
      }),
    });

    catalogRowsInserted += Number(result?.catalog_rows_inserted || 0);
    blankProductsUpdated += Number(result?.blank_products_updated || 0);
  }

  return {
    chunks_imported: chunksImported,
    catalog_rows_inserted: catalogRowsInserted,
    blank_products_updated: blankProductsUpdated,
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return json(405, { success: false, message: "Use POST." });
  }

  let feedId = null;

  try {
    requireConfig();

    const payload = JSON.parse(event.body || "{}");
    feedId = payload.feed_id;

    if (!feedId) return json(400, { success: false, message: "Missing feed_id." });

    const feeds = await supabaseFetch(`/supplier_catalog_feeds?id=eq.${encodeURIComponent(feedId)}&limit=1`);
    const feed = Array.isArray(feeds) ? feeds[0] : null;

    if (!feed) return json(404, { success: false, message: "Supplier catalog feed not found." });
    if (!feed.is_active) return json(400, { success: false, message: "Supplier catalog feed is inactive." });

    await updateFeed(feedId, {
      last_sync_status: "running",
      last_sync_message: "Downloading supplier CSV...",
    });

    const csvResponse = await fetch(feed.feed_url, {
      headers: {
        "User-Agent": "SkilledCraftingInventoryApp/1.0",
        Accept: "text/csv,text/plain,application/csv,*/*",
      },
    });

    if (!csvResponse.ok) {
      throw new Error(`Supplier CSV download failed: HTTP ${csvResponse.status}`);
    }

    const csvText = await csvResponse.text();

    if (!csvText || csvText.trim().length < 10) {
      throw new Error("Supplier CSV downloaded but appears to be empty.");
    }

    const rows = parseSupplierCatalogCsv(csvText);

    if (!rows.length) {
      throw new Error("CSV downloaded, but no usable supplier catalog rows were found.");
    }

    const importResult = await importRowsInChunks(feed, rows);

    await updateFeed(feedId, {
      last_sync_at: new Date().toISOString(),
      last_sync_status: "success",
      last_sync_message: `Imported ${rows.length} row(s) in ${importResult.chunks_imported} chunk(s).`,
      last_row_count: rows.length,
      last_catalog_rows_inserted: importResult.catalog_rows_inserted,
      last_blank_products_updated: importResult.blank_products_updated,
    });

    return json(200, {
      success: true,
      message: "Supplier catalog feed synced.",
      feed_id: feedId,
      rows_parsed: rows.length,
      import_result: importResult,
    });
  } catch (error) {
    if (feedId) {
      try {
        await updateFeed(feedId, {
          last_sync_at: new Date().toISOString(),
          last_sync_status: "failed",
          last_sync_message: error.message || "Supplier catalog sync failed.",
        });
      } catch {
        // Do not mask the original error.
      }
    }

    return json(500, {
      success: false,
      message: error.message || "Supplier catalog feed sync failed.",
      troubleshooting: [
        "Confirm the CSV URL is publicly reachable.",
        "Confirm Netlify environment variables SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.",
        "Confirm supplier_catalog_feeds exists by running the website CSV feed sync SQL.",
        "If the supplier catalog is very large, reduce SUPPLIER_CATALOG_SYNC_CHUNK_SIZE to 250.",
      ],
    });
  }
};
