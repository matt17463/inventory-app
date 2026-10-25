import { createHash, timingSafeEqual } from 'node:crypto';

export const STORAGE_BACKUP_BUCKETS = Object.freeze([
  'product-images', 'production-photo-proof', 'sample-product-images',
  'sc-mockup-output', 'sc-mockup-production', 'sc-mockup-source',
  'sc-private-print-pdfs', 'sc-receiving-documents', 'supplier-sync-cache',
]);

export function storageBackupAuthorized(provided, expected) {
  if (typeof provided !== 'string' || typeof expected !== 'string' || expected.length < 48 || provided.length > 4096) return false;
  const hash = value => createHash('sha256').update(value).digest();
  return timingSafeEqual(hash(provided), hash(expected));
}

export function storageBackupRequest(input) {
  if (!input || !STORAGE_BACKUP_BUCKETS.includes(input.bucket)) throw new Error('Invalid backup bucket.');
  const prefix = input.prefix ?? '';
  const offset = input.offset ?? 0;
  if (typeof prefix !== 'string' || prefix.length > 2048 || prefix.startsWith('/') || (prefix.includes('\\') || [...prefix].some(char => char.codePointAt(0) < 32)) || prefix.split('/').includes('..')) throw new Error('Invalid prefix.');
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1000000) throw new Error('Invalid offset.');
  return { bucket: input.bucket, prefix, offset };
}

export async function storageBackupPage(client, request) {
  const { bucket, prefix, offset } = storageBackupRequest(request);
  const store = client.storage.from(bucket);
  const { data, error } = await store.list(prefix, { limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } });
  if (error || !Array.isArray(data)) throw new Error('Storage listing failed.');
  const folders = [], files = [];
  for (const item of data) {
    if (typeof item.name !== 'string' || item.name.includes('/') || item.name.includes('\\') || ['.', '..'].includes(item.name)) throw new Error('Invalid storage entry.');
    const path = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id == null && item.metadata == null) folders.push(path);
    else files.push({ path, bytes: item.metadata?.size, updated_at: item.updated_at });
  }
  if (files.length) {
    const result = await store.createSignedUrls(files.map(file => file.path), 1800);
    if (result.error || !Array.isArray(result.data) || result.data.length !== files.length) throw new Error('Storage signing failed.');
    const urls = new Map(result.data.map(item => [item.path, item.signedUrl]));
    for (const file of files) {
      file.download_url = urls.get(file.path);
      if (!Number.isSafeInteger(file.bytes) || file.bytes < 0 || !file.download_url) throw new Error('Incomplete storage metadata.');
    }
  }
  return { bucket, folders, files, next_offset: data.length === 1000 ? offset + 1000 : null };
}
