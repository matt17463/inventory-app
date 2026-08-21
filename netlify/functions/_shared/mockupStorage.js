import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import sharp from 'sharp';

const SUPABASE_SOURCE_BUCKET = 'sc-mockup-source';
const SUPABASE_OUTPUT_BUCKET = 'sc-mockup-output';
const SUPABASE_PRODUCTION_BUCKET = 'sc-mockup-production';
export const SUPABASE_MOCKUP_BUCKETS = new Set([
  SUPABASE_SOURCE_BUCKET,
  SUPABASE_OUTPUT_BUCKET,
  SUPABASE_PRODUCTION_BUCKET,
]);

let cachedR2Client;

function env(name) {
  return String(process.env[name] || '').trim();
}

function required(name) {
  const value = env(name);
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

export function r2Configured() {
  return Boolean(env('R2_ACCOUNT_ID') && env('R2_ACCESS_KEY_ID') && env('R2_SECRET_ACCESS_KEY') && env('R2_BUCKET_NAME'));
}

export function defaultMockupStorageProvider() {
  const requested = env('MOCKUP_STORAGE_PROVIDER').toLowerCase() || 'supabase';
  if (requested === 'r2' && !r2Configured()) {
    throw new Error('MOCKUP_STORAGE_PROVIDER is r2, but one or more R2 environment variables are missing.');
  }
  if (!['r2', 'supabase'].includes(requested)) throw new Error(`Unsupported MOCKUP_STORAGE_PROVIDER: ${requested}.`);
  return requested;
}

export function r2BucketName() {
  return required('R2_BUCKET_NAME');
}

export function r2Client() {
  if (!cachedR2Client) {
    cachedR2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${required('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: required('R2_ACCESS_KEY_ID'),
        secretAccessKey: required('R2_SECRET_ACCESS_KEY'),
      },
    });
  }
  return cachedR2Client;
}

export function cleanObjectName(value, fallback = 'asset') {
  const raw = String(value || fallback);
  const dot = raw.lastIndexOf('.');
  const extension = dot > 0 ? `.${raw.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8)}` : '';
  const base = (dot > 0 ? raw.slice(0, dot) : raw)
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90) || fallback;
  return `${base}${extension}`;
}

export function safeObjectKey(value) {
  const key = String(value || '').replace(/^\/+/, '');
  if (!key || key.includes('..') || key.includes('\\') || key.length > 900) throw new Error('Invalid mockup storage path.');
  return key;
}

export function providerFor(row, prefix = '') {
  const value = row?.[`${prefix}storage_provider`];
  if (value) return String(value).toLowerCase();
  return row?.[`${prefix}storage_bucket`] ? 'supabase' : '';
}

export function storedReference(row, { prefix = '', preferPreview = false } = {}) {
  if (preferPreview && row?.preview_storage_path) {
    return {
      provider: String(row.preview_storage_provider || providerFor(row, prefix) || 'supabase').toLowerCase(),
      bucket: row.preview_storage_bucket || row[`${prefix}storage_bucket`],
      path: row.preview_storage_path,
      mimeType: 'image/webp',
    };
  }
  return {
    provider: providerFor(row, prefix),
    bucket: row?.[`${prefix}storage_bucket`],
    path: row?.[`${prefix}storage_path`],
    mimeType: row?.mime_type || 'application/octet-stream',
  };
}

async function bodyBuffer(body) {
  if (!body) return Buffer.alloc(0);
  if (typeof body.transformToByteArray === 'function') return Buffer.from(await body.transformToByteArray());
  const chunks = [];
  for await (const chunk of body) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export async function createPreviewBuffer(bytes, mimeType = '') {
  if (!String(mimeType).toLowerCase().startsWith('image/') || /svg|gif/i.test(mimeType)) return null;
  try {
    const maxPixels = Math.min(Math.max(Number(env('MOCKUP_PREVIEW_MAX_PIXELS') || 800), 320), 1600);
    const quality = Math.min(Math.max(Number(env('MOCKUP_PREVIEW_QUALITY') || 78), 40), 95);
    return await sharp(bytes, { limitInputPixels: 100_000_000 })
      .rotate()
      .resize({ width: maxPixels, height: maxPixels, fit: 'inside', withoutEnlargement: true })
      .webp({ quality, alphaQuality: quality, effort: 4 })
      .toBuffer();
  } catch (error) {
    console.warn('Mockup preview generation skipped:', error.message);
    return null;
  }
}

export async function loadStoredAsset(supabase, row, options = {}) {
  const reference = storedReference(row, options);
  if (!reference.provider || !reference.bucket || !reference.path) throw new Error('Mockup asset does not have a stored file.');
  if (reference.provider === 'r2') {
    if (reference.bucket !== r2BucketName()) throw new Error('Mockup asset references an unexpected R2 bucket.');
    const result = await r2Client().send(new GetObjectCommand({ Bucket: reference.bucket, Key: safeObjectKey(reference.path) }));
    return {
      bytes: await bodyBuffer(result.Body),
      mimeType: row.mime_type || result.ContentType || reference.mimeType,
      name: row.original_file_name || reference.path.split('/').pop() || 'asset',
    };
  }
  if (reference.provider === 'supabase') {
    if (!SUPABASE_MOCKUP_BUCKETS.has(reference.bucket)) throw new Error(`Unsupported Supabase mockup bucket: ${reference.bucket}.`);
    const { data, error } = await supabase.storage.from(reference.bucket).download(reference.path);
    if (error || !data) throw error || new Error('Supabase returned no file data.');
    return {
      bytes: Buffer.from(await data.arrayBuffer()),
      mimeType: row.mime_type || data.type || reference.mimeType,
      name: row.original_file_name || reference.path.split('/').pop() || 'asset',
    };
  }
  throw new Error(`Unsupported mockup storage provider: ${reference.provider}.`);
}

export async function signedStoredAssetUrl(supabase, row, expiresIn = 3600, options = {}) {
  const reference = storedReference(row, options);
  if (!reference.provider || !reference.bucket || !reference.path) return '';
  if (reference.provider === 'r2') {
    if (reference.bucket !== r2BucketName()) throw new Error('Mockup asset references an unexpected R2 bucket.');
    return getSignedUrl(
      r2Client(),
      new GetObjectCommand({ Bucket: reference.bucket, Key: safeObjectKey(reference.path) }),
      { expiresIn: Math.min(Math.max(Number(expiresIn || 3600), 60), 604800) },
    );
  }
  if (reference.provider === 'supabase') {
    const { data, error } = await supabase.storage.from(reference.bucket).createSignedUrl(reference.path, expiresIn);
    if (error) throw error;
    return data?.signedUrl || '';
  }
  throw new Error(`Unsupported mockup storage provider: ${reference.provider}.`);
}

export async function presignedR2Put({ key, contentType, expiresIn = 900 }) {
  return getSignedUrl(
    r2Client(),
    new PutObjectCommand({ Bucket: r2BucketName(), Key: safeObjectKey(key), ContentType: contentType || 'application/octet-stream' }),
    { expiresIn: Math.min(Math.max(Number(expiresIn || 900), 60), 3600) },
  );
}

export async function putMockupObject(supabase, { key, bytes, contentType = 'application/octet-stream', makePreview = true }) {
  const provider = defaultMockupStorageProvider();
  const safeKey = safeObjectKey(key);
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  const preview = makePreview ? await createPreviewBuffer(buffer, contentType) : null;
  const previewKey = preview ? `previews/${safeKey.replace(/\.[a-z0-9]{1,8}$/i, '')}.webp` : null;
  if (provider === 'r2') {
    const bucket = r2BucketName();
    await r2Client().send(new PutObjectCommand({ Bucket: bucket, Key: safeKey, Body: buffer, ContentType: contentType }));
    if (preview) await r2Client().send(new PutObjectCommand({ Bucket: bucket, Key: previewKey, Body: preview, ContentType: 'image/webp', CacheControl: 'public, max-age=31536000, immutable' }));
    return {
      storage_provider: 'r2', storage_bucket: bucket, storage_path: safeKey, file_size_bytes: buffer.length,
      preview_storage_provider: preview ? 'r2' : null,
      preview_storage_bucket: preview ? bucket : null,
      preview_storage_path: previewKey,
      preview_size_bytes: preview?.length || null,
    };
  }
  const bucket = /(^|\/)outputs\//.test(safeKey) ? SUPABASE_OUTPUT_BUCKET : SUPABASE_SOURCE_BUCKET;
  const { error } = await supabase.storage.from(bucket).upload(safeKey, buffer, { contentType, cacheControl: '31536000', upsert: true });
  if (error) throw error;
  if (preview) {
    const previewUpload = await supabase.storage.from(bucket).upload(previewKey, preview, { contentType: 'image/webp', cacheControl: '31536000', upsert: true });
    if (previewUpload.error) throw previewUpload.error;
  }
  return {
    storage_provider: 'supabase', storage_bucket: bucket, storage_path: safeKey, file_size_bytes: buffer.length,
    preview_storage_provider: preview ? 'supabase' : null,
    preview_storage_bucket: preview ? bucket : null,
    preview_storage_path: previewKey,
    preview_size_bytes: preview?.length || null,
  };
}

export async function deleteStoredReference(supabase, reference) {
  if (!reference?.provider || !reference?.bucket || !reference?.path) return;
  if (reference.provider === 'r2') {
    if (reference.bucket !== r2BucketName()) throw new Error('Refusing to delete from an unexpected R2 bucket.');
    await r2Client().send(new DeleteObjectCommand({ Bucket: reference.bucket, Key: safeObjectKey(reference.path) }));
    return;
  }
  if (reference.provider === 'supabase') {
    const { error } = await supabase.storage.from(reference.bucket).remove([reference.path]);
    if (error) throw error;
    return;
  }
  throw new Error(`Unsupported mockup storage provider: ${reference.provider}.`);
}

export async function deleteStoredAsset(supabase, row, { includePreview = true, prefix = '' } = {}) {
  const references = [storedReference(row, { prefix })];
  if (includePreview && row?.preview_storage_path) references.push(storedReference(row, { prefix, preferPreview: true }));
  for (const reference of references) await deleteStoredReference(supabase, reference);
}

export async function verifiedR2Upload({ key, bytes, contentType }) {
  const bucket = r2BucketName();
  const safeKey = safeObjectKey(key);
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  await r2Client().send(new PutObjectCommand({ Bucket: bucket, Key: safeKey, Body: buffer, ContentType: contentType || 'application/octet-stream' }));
  const head = await r2Client().send(new HeadObjectCommand({ Bucket: bucket, Key: safeKey }));
  if (Number(head.ContentLength) !== buffer.length) throw new Error(`R2 verification failed for ${safeKey}.`);
  return { bucket, key: safeKey, size: buffer.length };
}
