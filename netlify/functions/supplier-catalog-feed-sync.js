import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { authorizeEmployee, createServiceClient, jsonResponse } from './_shared/security.js';
import { supplierMatchKey } from './_shared/supplierConfirmationParser.js';
import { matchSupplierColor } from './_shared/supplierColorMatcher.js';

const DEFAULT_CHUNK_SIZE = Number(process.env.SUPPLIER_CATALOG_SYNC_CHUNK_SIZE || 50);
const MAX_CHUNK_SIZE = Number(process.env.SUPPLIER_CATALOG_SYNC_MAX_CHUNK_SIZE || 250);
const DOWNLOAD_TIMEOUT_MS = Number(process.env.SUPPLIER_CATALOG_DOWNLOAD_TIMEOUT_MS || 30000);
const MAX_SOURCE_BYTES = Number(process.env.SUPPLIER_CATALOG_MAX_SOURCE_BYTES || 100 * 1024 * 1024);
const CACHE_BUCKET = 'supplier-sync-cache';

function clean(value) {
  return String(value ?? "").trim();
}

function normalize(value) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function supplierKey(value) {
  const key = supplierMatchKey(value);
  if (key.includes('sand') || key.includes('ssactivewear')) return 'ss_activewear';
  if (key.includes('momentec') || key.includes('augusta')) return 'momentec';
  return key;
}

async function canonicalizeChunkColors(supabase, supplierName, rows) {
  const system = supplierKey(supplierName);
  const [colorsResult, rulesResult, aliasesResult] = await Promise.all([
    supabase.from('colors').select('*'),
    supabase.rpc('sc_get_color_pairing_rules', { p_status: 'active' }),
    supabase.from('sc_import_color_aliases').select('*').eq('source_system', system),
  ]);
  for (const result of [colorsResult, rulesResult, aliasesResult]) if (result.error) throw result.error;
  const colors = colorsResult.data || [];
  const activeById = new Map(colors.filter((color) => color.is_active !== false).map((color) => [String(color.id), color]));
  const resolved = new Map();
  const unresolved = [];
  for (const value of [...new Set(rows.map((row) => clean(row.color)).filter(Boolean))]) {
    const match = matchSupplierColor(value, colors, rulesResult.data || [], aliasesResult.data || [], system);
    const canonical = activeById.get(String(match.color_id || ''));
    if (canonical) resolved.set(supplierMatchKey(value), canonical.name);
    else unresolved.push(value);
  }
  if (unresolved.length) {
    throw new Error(`Supplier feed stopped before import: pair these colors to existing WooCommerce colors first: ${unresolved.slice(0, 12).join(', ')}${unresolved.length > 12 ? `, +${unresolved.length - 12} more` : ''}. Use Supplier Catalog Import to save the pairings, then restart this feed.`);
  }
  return rows.map((row) => ({ ...row, color: resolved.get(supplierMatchKey(row.color)) || row.color }));
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



function safeSourceUrl(value) {
  const parsed = new URL(clean(value));
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Supplier feed URL must use HTTP or HTTPS.');
  }
  if (['localhost', '127.0.0.1', '::1'].includes(parsed.hostname.toLowerCase())) {
    throw new Error('Local supplier feed URLs are not allowed.');
  }
  const sanitized = new URL(parsed.toString());
  sanitized.username = '';
  sanitized.password = '';
  sanitized.search = '';
  sanitized.hash = '';
  return { downloadUrl: parsed.toString(), auditUrl: sanitized.toString() };
}

async function readResponseBuffer(response, maxBytes) {
  const declared = Number(response.headers.get('content-length') || 0);
  if (declared > maxBytes) {
    throw new Error(`Supplier source is ${declared} bytes, above the ${maxBytes} byte safety limit.`);
  }

  if (!response.body?.getReader) {
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > maxBytes) throw new Error(`Supplier source exceeded the ${maxBytes} byte safety limit.`);
    return buffer;
  }

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel('source too large').catch(() => {});
      throw new Error(`Supplier source exceeded the ${maxBytes} byte safety limit.`);
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, total);
}

async function downloadSupplierBuffer(feed) {
  const { downloadUrl, auditUrl } = safeSourceUrl(feed.feed_url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const response = await fetch(downloadUrl, {
      redirect: 'follow',
      headers: safeHeaderMap(feed),
      signal: controller.signal,
    });
    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('Supplier file download failed with HTTP 403. Verify the configured feed URL and required request headers.');
      }
      throw new Error(`Supplier file download failed: HTTP ${response.status}`);
    }
    const buffer = await readResponseBuffer(response, MAX_SOURCE_BYTES);
    if (!buffer.length) throw new Error('Supplier file downloaded but appears to be empty.');
    return {
      buffer,
      auditUrl,
      etag: clean(response.headers.get('etag')) || null,
      lastModified: clean(response.headers.get('last-modified')) || null,
      contentType: clean(response.headers.get('content-type')) || null,
      sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
    };
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error(`Supplier file download timed out after ${DOWNLOAD_TIMEOUT_MS} ms.`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function supplierTextFromBuffer(buffer, sourceLabel) {
  if (isZipBuffer(buffer)) {
    const extracted = extractCsvTextFromZipBuffer(buffer);
    return { text: extracted.text, sourceLabel: `${sourceLabel} :: ${extracted.fileName}`, sourceKind: 'zip' };
  }
  if (isGzipBuffer(buffer)) {
    return { text: decodeBufferText(zlib.gunzipSync(buffer)), sourceLabel, sourceKind: 'gzip' };
  }
  return { text: decodeBufferText(buffer), sourceLabel, sourceKind: 'csv' };
}

async function getFeed(supabase, feedId) {
  const { data, error } = await supabase
    .from('supplier_catalog_feeds')
    .select('*')
    .eq('id', feedId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function updateFeed(supabase, feedId, values) {
  const { error } = await supabase
    .from('supplier_catalog_feeds')
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq('id', feedId);
  if (error) throw error;
}

async function getRun(supabase, runId) {
  const { data, error } = await supabase
    .from('sc_supplier_catalog_sync_runs')
    .select('*')
    .eq('id', Number(runId))
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function findRunningRun(supabase, feedId) {
  const { data, error } = await supabase
    .from('sc_supplier_catalog_sync_runs')
    .select('*')
    .eq('feed_id_text', String(feedId))
    .eq('status', 'running')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function updateRun(supabase, runId, values) {
  const { data, error } = await supabase
    .from('sc_supplier_catalog_sync_runs')
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq('id', Number(runId))
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

async function createRun(supabase, feed, userId) {
  const existing = await findRunningRun(supabase, feed.id);
  if (existing) return existing;

  const { data, error } = await supabase
    .from('sc_supplier_catalog_sync_runs')
    .insert({
      feed_id_text: String(feed.id),
      initiated_by: userId || null,
      status: 'running',
      source_url: safeSourceUrl(feed.feed_url).auditUrl,
      metadata: { feed_name: feed.feed_name || null, supplier_name: feed.supplier_name || null },
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

async function cacheSource(supabase, run, feed) {
  const downloaded = await downloadSupplierBuffer(feed);
  const objectPath = `${String(feed.id).replace(/[^a-zA-Z0-9_-]/g, '_')}/${run.id}/source.bin`;
  const { error: uploadError } = await supabase.storage
    .from(CACHE_BUCKET)
    .upload(objectPath, downloaded.buffer, {
      contentType: downloaded.contentType || 'application/octet-stream',
      upsert: true,
      cacheControl: '0',
    });
  if (uploadError) throw new Error(`Unable to cache supplier source: ${uploadError.message}`);

  const source = supplierTextFromBuffer(downloaded.buffer, downloaded.auditUrl);
  const updated = await updateRun(supabase, run.id, {
    cache_bucket: CACHE_BUCKET,
    cache_object_path: objectPath,
    source_url: downloaded.auditUrl,
    source_label: source.sourceLabel,
    source_kind: source.sourceKind,
    source_etag: downloaded.etag,
    source_last_modified: downloaded.lastModified,
    source_sha256: downloaded.sha256,
    source_bytes: downloaded.buffer.length,
  });
  return { run: updated, buffer: downloaded.buffer, source };
}

async function loadCachedSource(supabase, run) {
  if (!run.cache_object_path) throw new Error('Supplier sync run has no cached source. Start a new run.');
  const { data, error } = await supabase.storage.from(run.cache_bucket || CACHE_BUCKET).download(run.cache_object_path);
  if (error) throw new Error(`Unable to read cached supplier source: ${error.message}`);
  const buffer = Buffer.from(await data.arrayBuffer());
  if (!buffer.length) throw new Error('Cached supplier source is empty.');
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  if (run.source_sha256 && sha256 !== run.source_sha256) throw new Error('Cached supplier source checksum does not match the recorded run.');
  return { buffer, source: supplierTextFromBuffer(buffer, run.source_label || run.source_url || 'supplier source') };
}

async function removeCachedSource(supabase, run) {
  if (!run?.cache_object_path) return;
  const { error } = await supabase.storage.from(run.cache_bucket || CACHE_BUCKET).remove([run.cache_object_path]);
  if (error) console.warn('Supplier cache cleanup failed:', error.message);
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return jsonResponse(204, {}, event);
  if (event.httpMethod === 'GET') {
    return jsonResponse(200, { success: true, message: 'supplier-catalog-feed-sync resumable cache v2 active' }, event);
  }
  if (event.httpMethod !== 'POST') return jsonResponse(405, { success: false, message: 'Use POST.' }, event);

  const authorization = await authorizeEmployee(event, {
    functionName: 'supplier-catalog-feed-sync',
    allowedRoles: ['admin', 'manager'],
  });
  if (!authorization.ok) return jsonResponse(authorization.statusCode, { success: false, message: authorization.message }, event);

  const supabase = createServiceClient();
  let run = null;
  let feed = null;
  try {
    const payload = JSON.parse(event.body || '{}');
    const feedId = payload.feed_id;
    const requestedOffset = Math.max(0, Number(payload.offset || 0));
    const requestedChunkSize = Number(payload.chunk_size || DEFAULT_CHUNK_SIZE);
    const chunkSize = Math.min(Math.max(requestedChunkSize, 5), MAX_CHUNK_SIZE);
    if (!feedId) return jsonResponse(400, { success: false, message: 'Missing feed_id.' }, event);

    feed = await getFeed(supabase, feedId);
    if (!feed) return jsonResponse(404, { success: false, message: 'Supplier catalog feed not found.' }, event);
    if (!feed.is_active) return jsonResponse(400, { success: false, message: 'Supplier catalog feed is inactive.' }, event);

    run = payload.run_id ? await getRun(supabase, payload.run_id) : await createRun(supabase, feed, authorization.user.id);
    if (!run) throw new Error('Supplier sync run was not found.');
    if (String(run.feed_id_text) !== String(feed.id)) throw new Error('Supplier sync run does not belong to the requested feed.');
    if (run.status !== 'running') {
      return jsonResponse(409, { success: false, message: `Supplier sync run is ${run.status}. Start a new run.`, run_id: run.id }, event);
    }

    const offset = Math.max(requestedOffset, Number(run.last_offset || 0));
    await updateFeed(supabase, feed.id, {
      last_sync_status: 'running',
      last_sync_message: run.cache_object_path
        ? `Reading cached supplier source at usable row ${offset + 1}...`
        : 'Downloading and caching supplier source...',
      ...(offset === 0 ? { last_catalog_rows_inserted: 0, last_blank_products_updated: 0, last_row_count: 0 } : {}),
    });

    let cached;
    if (run.cache_object_path) cached = await loadCachedSource(supabase, run);
    else {
      const created = await cacheSource(supabase, run, feed);
      run = created.run;
      cached = { buffer: created.buffer, source: created.source };
    }

    if (!cached.source.text || cached.source.text.trim().length < 10) throw new Error('Supplier source did not contain usable CSV text.');
    const chunk = readCsvChunkFromText(cached.source.text, offset, chunkSize);

    if (!chunk.rows.length) {
      run = await updateRun(supabase, run.id, {
        status: 'completed',
        completed_at: new Date().toISOString(),
        last_offset: offset,
      });
      await updateFeed(supabase, feed.id, {
        last_sync_at: new Date().toISOString(),
        last_sync_status: 'success',
        last_sync_message: `Supplier catalog sync complete at usable row ${offset}.`,
        last_row_count: offset,
      });
      await removeCachedSource(supabase, run);
      return jsonResponse(200, {
        success: true,
        complete: true,
        run_id: run.id,
        feed_id: feed.id,
        offset,
        next_offset: offset,
        imported_this_call: 0,
        has_more: false,
        source_kind: run.source_kind,
        message: 'Supplier catalog sync complete.',
      }, event);
    }

    const canonicalRows = await canonicalizeChunkColors(supabase, feed.supplier_name, chunk.rows);
    const { data: result, error: importError } = await supabase.rpc('import_supplier_catalog_rows', {
      p_supplier_name: feed.supplier_name,
      p_source_file_name: feed.source_file_name || feed.feed_name || run.source_label || feed.feed_url,
      p_rows: canonicalRows,
      p_update_blank_products: Boolean(feed.update_blank_products),
      p_create_missing_lookups: Boolean(feed.create_missing_lookups),
    });
    if (importError) throw importError;

    const nextOffset = offset + chunk.rows.length;
    const hasMore = chunk.has_more_hint && chunk.rows.length === chunkSize;
    const inserted = Number(result?.catalog_rows_inserted || 0);
    const updated = Number(result?.catalog_rows_updated || 0);
    const blanksUpdated = Number(result?.blank_products_updated || 0);

    run = await updateRun(supabase, run.id, {
      status: hasMore ? 'running' : 'completed',
      completed_at: hasMore ? null : new Date().toISOString(),
      rows_processed: Number(run.rows_processed || 0) + chunk.rows.length,
      rows_inserted: Number(run.rows_inserted || 0) + inserted,
      rows_updated: Number(run.rows_updated || 0) + updated,
      blank_products_updated: Number(run.blank_products_updated || 0) + blanksUpdated,
      last_offset: nextOffset,
    });

    await updateFeed(supabase, feed.id, {
      last_sync_at: hasMore ? feed.last_sync_at : new Date().toISOString(),
      last_sync_status: hasMore ? 'running' : 'success',
      last_sync_message: hasMore
        ? `Imported through usable row ${nextOffset} from cached ${run.source_kind || 'supplier'} source.`
        : `Supplier catalog sync complete through usable row ${nextOffset}.`,
      last_row_count: nextOffset,
      last_catalog_rows_inserted: Number(run.rows_inserted || 0),
      last_blank_products_updated: Number(run.blank_products_updated || 0),
    });

    if (!hasMore) await removeCachedSource(supabase, run);

    return jsonResponse(200, {
      success: true,
      complete: !hasMore,
      run_id: run.id,
      feed_id: feed.id,
      offset,
      chunk_size: chunkSize,
      imported_this_call: chunk.rows.length,
      next_offset: nextOffset,
      has_more: hasMore,
      source_kind: run.source_kind,
      source_downloaded_once: true,
      import_result: result,
      run_totals: {
        rows_processed: run.rows_processed,
        rows_inserted: run.rows_inserted,
        rows_updated: run.rows_updated,
        blank_products_updated: run.blank_products_updated,
      },
      message: hasMore
        ? `Imported ${nextOffset} usable supplier row(s).`
        : `Supplier catalog sync complete. Imported through ${nextOffset} usable supplier row(s).`,
    }, event);
  } catch (error) {
    console.error('supplier-catalog-feed-sync error:', error);
    if (run?.id) {
      try {
        run = await updateRun(supabase, run.id, {
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: clean(error.message).slice(0, 4000),
        });
      } catch { /* retain original error */ }
    }
    if (feed?.id) {
      try {
        await updateFeed(supabase, feed.id, {
          last_sync_at: new Date().toISOString(),
          last_sync_status: 'failed',
          last_sync_message: clean(error.message).slice(0, 2000),
        });
      } catch { /* retain original error */ }
    }
    return jsonResponse(500, {
      success: false,
      run_id: run?.id || null,
      message: error.message || 'Supplier catalog feed sync failed.',
    }, event);
  }
};
