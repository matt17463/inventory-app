
const zlib = require("zlib");

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_KEY = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;

const DEFAULT_CHUNK_SIZE = Number(process.env.SUPPLIER_CATALOG_SYNC_CHUNK_SIZE || 25);
const MAX_CHUNK_SIZE = Number(process.env.SUPPLIER_CATALOG_SYNC_MAX_CHUNK_SIZE || 100);

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

function safeHeaderMap(feed) {
  const defaultHeaders = {
    "User-Agent":
      feed?.user_agent ||
      process.env.SUPPLIER_CATALOG_SYNC_USER_AGENT ||
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    "Accept": "text/csv,text/plain,application/csv,application/zip,application/octet-stream,*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
  };

  if (feed?.referer) {
    defaultHeaders.Referer = feed.referer;
  }

  let customHeaders = {};

  if (feed?.http_headers && typeof feed.http_headers === "object" && !Array.isArray(feed.http_headers)) {
    customHeaders = feed.http_headers;
  }

  const merged = {
    ...defaultHeaders,
    ...customHeaders,
  };

  // Never allow these to be overwritten from the database.
  delete merged.Host;
  delete merged.host;
  delete merged["Content-Length"];
  delete merged["content-length"];

  return merged;
}

function parseCsvLine(line) {
  const cells = [];
  let value = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

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
      cells.push(value);
      value = "";
      continue;
    }

    value += char;
  }

  cells.push(value);
  return cells;
}

function splitCsvRecords(buffer) {
  const records = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < buffer.length; i += 1) {
    const char = buffer[i];
    const next = buffer[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += char + next;
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      if (clean(current) !== "") records.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  return { records, remainder: current };
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

function mapSupplierRow(row, sourceRowNumber) {
  return {
    source_row: sourceRowNumber,
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

function isUsableSupplierRow(row) {
  return row.brand || row.style || row.color || row.size || row.supplier_sku || row.upc || row.unit_cost !== null;
}

function isZipBuffer(buffer) {
  return buffer && buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
}

function isGzipBuffer(buffer) {
  return buffer && buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b;
}

function decodeBufferText(buffer) {
  if (!buffer || !buffer.length) return "";
  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return buffer.slice(3).toString("utf8");
  }
  return buffer.toString("utf8");
}

function extractCsvTextFromZipBuffer(zipBuffer) {
  let offset = 0;
  const candidates = [];

  while (offset + 30 <= zipBuffer.length) {
    const signature = zipBuffer.readUInt32LE(offset);

    if (signature !== 0x04034b50) break;

    const flags = zipBuffer.readUInt16LE(offset + 6);
    const compressionMethod = zipBuffer.readUInt16LE(offset + 8);
    const compressedSize = zipBuffer.readUInt32LE(offset + 18);
    const fileNameLength = zipBuffer.readUInt16LE(offset + 26);
    const extraFieldLength = zipBuffer.readUInt16LE(offset + 28);

    const fileNameStart = offset + 30;
    const fileNameEnd = fileNameStart + fileNameLength;
    const fileName = zipBuffer.slice(fileNameStart, fileNameEnd).toString("utf8");

    const dataStart = fileNameEnd + extraFieldLength;

    if (flags & 0x08) {
      throw new Error("ZIP source uses data descriptors, which this lightweight ZIP reader cannot safely parse. Use a direct CSV URL or a supplier-specific extractor.");
    }

    const dataEnd = dataStart + compressedSize;

    if (dataEnd > zipBuffer.length) {
      throw new Error("ZIP source appears truncated or invalid.");
    }

    const isDirectory = fileName.endsWith("/");
    const lowerName = fileName.toLowerCase();

    if (!isDirectory) {
      candidates.push({
        fileName,
        lowerName,
        compressionMethod,
        data: zipBuffer.slice(dataStart, dataEnd),
      });
    }

    offset = dataEnd;
  }

  if (!candidates.length) throw new Error("ZIP source did not contain any files.");

  const selected =
    candidates.find((entry) => entry.lowerName.endsWith(".csv")) ||
    candidates.find((entry) => entry.lowerName.endsWith(".txt")) ||
    candidates[0];

  let extracted;

  if (selected.compressionMethod === 0) {
    extracted = selected.data;
  } else if (selected.compressionMethod === 8) {
    extracted = zlib.inflateRawSync(selected.data);
  } else {
    throw new Error(`ZIP entry "${selected.fileName}" uses unsupported compression method ${selected.compressionMethod}.`);
  }

  if (!extracted || !extracted.length) throw new Error(`ZIP entry "${selected.fileName}" was empty.`);

  return {
    fileName: selected.fileName,
    text: decodeBufferText(extracted),
  };
}

async function downloadSupplierText(feed) {
  const response = await fetch(feed.feed_url, {
    redirect: "follow",
    headers: safeHeaderMap(feed),
  });

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error(
        "Supplier file download failed: HTTP 403. The supplier server is refusing Netlify/server access. Try adding required Referer/User-Agent/Auth headers to supplier_catalog_feeds.http_headers, use a direct public CSV/ZIP URL, or ask the supplier for an API/static feed URL."
      );
    }

    throw new Error(`Supplier file download failed: HTTP ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (!buffer.length) throw new Error("Supplier file downloaded but appears to be empty.");

  if (isZipBuffer(buffer)) {
    const extracted = extractCsvTextFromZipBuffer(buffer);
    return {
      text: extracted.text,
      sourceLabel: `${feed.feed_url} :: ${extracted.fileName}`,
      sourceKind: "zip",
    };
  }

  if (isGzipBuffer(buffer)) {
    const extracted = zlib.gunzipSync(buffer);
    return {
      text: decodeBufferText(extracted),
      sourceLabel: feed.feed_url,
      sourceKind: "gzip",
    };
  }

  return {
    text: decodeBufferText(buffer),
    sourceLabel: feed.feed_url,
    sourceKind: "csv",
  };
}

function readCsvChunkFromText(csvText, offset, chunkSize) {
  const records = splitCsvRecords(csvText).records;
  if (!records.length) return { rows: [], total_scanned: 0, usable_seen: 0, has_more_hint: false };

  const headers = parseCsvLine(records[0]).map((header) => clean(header));
  const selectedRows = [];
  let usableSeen = 0;

  for (let i = 1; i < records.length; i += 1) {
    const mapped = mapSupplierRow(rowToObject(headers, parseCsvLine(records[i])), i + 1);
    if (!isUsableSupplierRow(mapped)) continue;

    if (usableSeen >= offset && selectedRows.length < chunkSize) selectedRows.push(mapped);

    usableSeen += 1;

    if (selectedRows.length >= chunkSize) {
      return {
        rows: selectedRows,
        total_scanned: i,
        usable_seen: usableSeen,
        has_more_hint: true,
      };
    }
  }

  return {
    rows: selectedRows,
    total_scanned: records.length - 1,
    usable_seen: usableSeen,
    has_more_hint: false,
  };
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
    const message = typeof body === "string"
      ? body
      : body?.message || body?.hint || body?.details || `Supabase request failed: ${response.status}`;
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

async function getFeed(feedId) {
  const feeds = await supabaseFetch(`/supplier_catalog_feeds?id=eq.${encodeURIComponent(feedId)}&limit=1`);
  return Array.isArray(feeds) ? feeds[0] : null;
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  if (event.httpMethod !== "POST") return json(405, { success: false, message: "Use POST." });

  let feedId = null;

  try {
    requireConfig();

    const payload = JSON.parse(event.body || "{}");
    feedId = payload.feed_id;
    const offset = Math.max(0, Number(payload.offset || 0));
    const requestedChunkSize = Number(payload.chunk_size || DEFAULT_CHUNK_SIZE);
    const chunkSize = Math.min(Math.max(requestedChunkSize, 5), MAX_CHUNK_SIZE);

    if (!feedId) return json(400, { success: false, message: "Missing feed_id." });

    const feed = await getFeed(feedId);

    if (!feed) return json(404, { success: false, message: "Supplier catalog feed not found." });
    if (!feed.is_active) return json(400, { success: false, message: "Supplier catalog feed is inactive." });

    await updateFeed(feedId, {
      last_sync_status: "running",
      last_sync_message: `Downloading supplier source and reading chunk starting at usable row ${offset + 1}...`,
    });

    const downloaded = await downloadSupplierText(feed);

    if (!downloaded.text || downloaded.text.trim().length < 10) {
      throw new Error("Supplier source downloaded but did not contain usable CSV text.");
    }

    const chunk = readCsvChunkFromText(downloaded.text, offset, chunkSize);

    if (!chunk.rows.length) {
      await updateFeed(feedId, {
        last_sync_at: new Date().toISOString(),
        last_sync_status: "success",
        last_sync_message: `Sync complete. No more supplier rows after offset ${offset}.`,
        last_row_count: offset,
      });

      return json(200, {
        success: true,
        complete: true,
        feed_id: feedId,
        offset,
        next_offset: offset,
        imported_this_call: 0,
        has_more: false,
        source_kind: downloaded.sourceKind,
        message: "Supplier catalog sync complete.",
      });
    }

    await updateFeed(feedId, {
      last_sync_status: "running",
      last_sync_message: `Importing ${chunk.rows.length} row(s) from ${downloaded.sourceKind.toUpperCase()} source...`,
    });

    const result = await supabaseFetch(`/rpc/import_supplier_catalog_rows`, {
      method: "POST",
      body: JSON.stringify({
        p_supplier_name: feed.supplier_name,
        p_source_file_name: feed.source_file_name || feed.feed_name || downloaded.sourceLabel || feed.feed_url,
        p_rows: chunk.rows,
        p_update_blank_products: Boolean(feed.update_blank_products),
        p_create_missing_lookups: Boolean(feed.create_missing_lookups),
      }),
    });

    const nextOffset = offset + chunk.rows.length;
    const hasMore = chunk.has_more_hint && chunk.rows.length === chunkSize;

    await updateFeed(feedId, {
      last_sync_at: hasMore ? feed.last_sync_at : new Date().toISOString(),
      last_sync_status: hasMore ? "running" : "success",
      last_sync_message: hasMore
        ? `Imported through usable row ${nextOffset} from ${downloaded.sourceKind.toUpperCase()} source. Continue sync...`
        : `Supplier catalog sync complete. Imported through usable row ${nextOffset}.`,
      last_row_count: nextOffset,
      last_catalog_rows_inserted: Number(feed.last_catalog_rows_inserted || 0) + Number(result?.catalog_rows_inserted || 0),
      last_blank_products_updated: Number(feed.last_blank_products_updated || 0) + Number(result?.blank_products_updated || 0),
    });

    return json(200, {
      success: true,
      complete: !hasMore,
      feed_id: feedId,
      offset,
      chunk_size: chunkSize,
      imported_this_call: chunk.rows.length,
      next_offset: nextOffset,
      has_more: hasMore,
      scanned_this_call: chunk.total_scanned,
      source_kind: downloaded.sourceKind,
      import_result: result,
      message: hasMore
        ? `Imported ${nextOffset} usable supplier row(s).`
        : `Supplier catalog sync complete. Imported through ${nextOffset} usable supplier row(s).`,
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
        // Do not mask original error.
      }
    }

    return json(500, {
      success: false,
      message: error.message || "Supplier catalog feed sync failed.",
      troubleshooting: [
        "HTTP 403 means the supplier refused the download request.",
        "Try adding Referer, Authorization, Cookie, or a supplier-required User-Agent in supplier_catalog_feeds.http_headers.",
        "Ask the supplier for a direct public CSV/ZIP feed URL or API key.",
        "If the file only downloads after browser login, server-side syncing will need an authenticated supplier API/feed.",
      ],
    });
  }
};
