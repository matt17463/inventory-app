#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { basename, extname } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import sharp from 'sharp';

const execute = process.argv.includes('--execute');
const deleteOrphans = process.argv.includes('--delete-orphans');

function required(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

const supabase = createClient(required('SUPABASE_URL').replace(/\/rest\/v1\/?$/, ''), required('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
});
const r2Bucket = required('R2_BUCKET_NAME');
const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${required('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: required('R2_ACCESS_KEY_ID'), secretAccessKey: required('R2_SECRET_ACCESS_KEY') },
});

const plans = [
  {
    label: 'sample image', table: 'sample_products', id: 'id', provider: 'image_storage_provider',
    bucket: 'image_storage_bucket', path: 'image_path', size: 'image_file_size_bytes', mime: 'image_mime_type',
    legacyBucket: 'sample-product-images', prefix: 'operational/samples/migrated', makePreview: true,
    previewProvider: 'preview_storage_provider', previewBucket: 'preview_storage_bucket',
    previewPath: 'preview_storage_path', previewSize: 'preview_size_bytes',
  },
  {
    label: 'production photo', table: 'sc_production_photos', id: 'id', provider: 'storage_provider',
    bucket: 'storage_bucket', path: 'storage_path', size: 'file_size_bytes', mime: 'mime_type',
    legacyBucket: 'production-photo-proof', prefix: 'operational/production/migrated', makePreview: true,
    previewProvider: 'preview_storage_provider', previewBucket: 'preview_storage_bucket',
    previewPath: 'preview_storage_path', previewSize: 'preview_size_bytes',
  },
  {
    label: 'supplier confirmation', table: 'sc_supplier_receiving_imports', id: 'id', provider: 'document_storage_provider',
    bucket: 'document_storage_bucket', path: 'document_path', size: 'document_size_bytes', mime: 'document_mime_type',
    legacyBucket: 'sc-receiving-documents', prefix: 'operational/receiving/migrated', makePreview: false,
  },
  {
    label: 'supplier cache', table: 'sc_supplier_catalog_sync_runs', id: 'id', provider: 'cache_storage_provider',
    bucket: 'cache_bucket', path: 'cache_object_path', size: 'source_bytes', mime: null,
    legacyBucket: 'supplier-sync-cache', prefix: 'operational/supplier-cache/migrated', makePreview: false,
  },
];

function safeName(value) {
  const raw = basename(String(value || 'asset.bin'));
  const extension = extname(raw).toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 9);
  const base = raw.slice(0, Math.max(0, raw.length - extname(raw).length)).toLowerCase()
    .normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'asset';
  return `${base}${extension}`;
}

async function streamBuffer(body) {
  if (typeof body?.transformToByteArray === 'function') return Buffer.from(await body.transformToByteArray());
  const chunks = [];
  for await (const chunk of body || []) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function verifiedPut(key, bytes, contentType) {
  await r2.send(new PutObjectCommand({ Bucket: r2Bucket, Key: key, Body: bytes, ContentType: contentType, CacheControl: 'private, max-age=31536000, immutable' }));
  const head = await r2.send(new HeadObjectCommand({ Bucket: r2Bucket, Key: key }));
  if (Number(head.ContentLength) !== bytes.length) throw new Error(`R2 length verification failed for ${key}.`);
  const loaded = await r2.send(new GetObjectCommand({ Bucket: r2Bucket, Key: key }));
  const roundTrip = await streamBuffer(loaded.Body);
  if (createHash('sha256').update(roundTrip).digest('hex') !== createHash('sha256').update(bytes).digest('hex')) {
    throw new Error(`R2 checksum verification failed for ${key}.`);
  }
}

async function preview(bytes, mimeType) {
  if (!String(mimeType).startsWith('image/') || /svg|gif/i.test(mimeType)) return null;
  return sharp(bytes, { limitInputPixels: 100_000_000 }).rotate()
    .resize({ width: 720, height: 720, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 76, alphaQuality: 76, effort: 4 }).toBuffer();
}

async function rowsFor(plan) {
  const fields = [plan.id, plan.provider, plan.bucket, plan.path, plan.size, plan.mime].filter(Boolean).join(',');
  const rows = [];
  for (let from = 0; ; from += 500) {
    const response = await supabase.from(plan.table).select(fields).not(plan.path, 'is', null).range(from, from + 499);
    if (response.error) throw response.error;
    rows.push(...(response.data || []));
    if ((response.data || []).length < 500) break;
  }
  return rows.filter((row) => String(row[plan.provider] || 'supabase').toLowerCase() !== 'r2');
}

async function migrateRow(plan, row) {
  const legacyBucket = row[plan.bucket] || plan.legacyBucket;
  const legacyPath = row[plan.path];
  if (legacyBucket !== plan.legacyBucket) throw new Error(`Unexpected legacy bucket ${legacyBucket}.`);
  if (!execute) {
    return {
      action: 'would migrate', legacyBucket, legacyPath,
      key: `${plan.prefix}/${row[plan.id]}/<verified-sha256>-${safeName(legacyPath)}`,
      bytes: Number(plan.size ? row[plan.size] : 0) || 0,
    };
  }
  const downloaded = await supabase.storage.from(legacyBucket).download(legacyPath);
  if (downloaded.error || !downloaded.data) throw downloaded.error || new Error('Legacy download returned no data.');
  const bytes = Buffer.from(await downloaded.data.arrayBuffer());
  const contentType = row[plan.mime] || downloaded.data.type || 'application/octet-stream';
  const digest = createHash('sha256').update(bytes).digest('hex');
  const key = `${plan.prefix}/${row[plan.id]}/${digest.slice(0, 16)}-${safeName(legacyPath)}`;
  const previewBytes = plan.makePreview ? await preview(bytes, contentType).catch(() => null) : null;
  const previewKey = previewBytes ? `${plan.prefix.replace(/\/migrated$/, 'previews/migrated')}/${row[plan.id]}/${digest.slice(0, 16)}.webp` : null;
  await verifiedPut(key, bytes, contentType);
  if (previewBytes) await verifiedPut(previewKey, previewBytes, 'image/webp');
  const update = {
    [plan.provider]: 'r2', [plan.bucket]: r2Bucket, [plan.path]: key,
    ...(plan.size ? { [plan.size]: bytes.length } : {}),
    ...(plan.mime ? { [plan.mime]: contentType } : {}),
    ...(plan.previewProvider ? {
      [plan.previewProvider]: previewBytes ? 'r2' : null,
      [plan.previewBucket]: previewBytes ? r2Bucket : null,
      [plan.previewPath]: previewKey,
      [plan.previewSize]: previewBytes?.length || null,
    } : {}),
  };
  const saved = await supabase.from(plan.table).update(update).eq(plan.id, row[plan.id]);
  if (saved.error) {
    await r2.send(new DeleteObjectCommand({ Bucket: r2Bucket, Key: key })).catch(() => {});
    if (previewKey) await r2.send(new DeleteObjectCommand({ Bucket: r2Bucket, Key: previewKey })).catch(() => {});
    throw saved.error;
  }
  const removed = await supabase.storage.from(legacyBucket).remove([legacyPath]);
  if (removed.error) throw new Error(`Database points to verified R2 copy, but legacy cleanup failed: ${removed.error.message}`);
  return { action: 'migrated', legacyBucket, legacyPath, key, bytes: bytes.length };
}

async function listFiles(bucket, folder = '') {
  const files = [];
  for (let offset = 0; ; offset += 1000) {
    const result = await supabase.storage.from(bucket).list(folder, { limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } });
    if (result.error) throw result.error;
    for (const item of result.data || []) {
      const path = folder ? `${folder}/${item.name}` : item.name;
      if (item.id) files.push(path);
      else files.push(...await listFiles(bucket, path));
    }
    if ((result.data || []).length < 1000) break;
  }
  return files;
}

async function reviewLegacyProductImages() {
  const files = await listFiles('product-images');
  const refs = await supabase.from('blank_products').select('id,image_storage_path,image_url');
  if (refs.error) throw refs.error;
  const referenced = new Set((refs.data || []).flatMap((row) => {
    const fromUrl = String(row.image_url || '').match(/\/product-images\/(.*)$/)?.[1];
    return [row.image_storage_path, fromUrl].filter(Boolean);
  }));
  const orphans = files.filter((path) => !referenced.has(path));
  const active = files.filter((path) => referenced.has(path));
  console.log(JSON.stringify({ scope: 'legacy product images', files: files.length, referenced: active.length, orphans: orphans.length }, null, 2));
  if (active.length) console.warn('Referenced product-images files were left unchanged because blank-product URLs require a separate catalog-image workflow.');
  if (execute && deleteOrphans && orphans.length) {
    for (let index = 0; index < orphans.length; index += 100) {
      const removed = await supabase.storage.from('product-images').remove(orphans.slice(index, index + 100));
      if (removed.error) throw removed.error;
    }
    console.log(`Deleted ${orphans.length} unreferenced product-images object(s).`);
  } else if (orphans.length) {
    console.log(`Dry run: ${orphans.length} orphan(s) can be removed with --execute --delete-orphans.`);
  }
}

async function main() {
  console.log(execute ? 'EXECUTE MODE: verified R2 copies will replace legacy references.' : 'DRY RUN: no database or storage changes will be made.');
  const results = [];
  for (const plan of plans) {
    const rows = await rowsFor(plan);
    console.log(`${plan.label}: ${rows.length} legacy record(s).`);
    for (const row of rows) {
      try { results.push({ label: plan.label, id: row[plan.id], ...await migrateRow(plan, row) }); }
      catch (error) { results.push({ label: plan.label, id: row[plan.id], action: 'failed', error: error.message }); }
    }
  }
  await reviewLegacyProductImages();
  console.table(results.map(({ label, id, action, bytes, error }) => ({ label, id, action, bytes: bytes || 0, error: error || '' })));
  const failures = results.filter((item) => item.action === 'failed');
  if (failures.length) throw new Error(`${failures.length} object(s) failed. Legacy copies were retained for failed records.`);
  console.log(execute ? 'Migration complete. Refresh Asset Storage Health.' : 'Review the dry run, then rerun with --execute.');
}

main().catch((error) => { console.error(error.message || error); process.exitCode = 1; });
