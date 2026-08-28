import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import sharp from 'sharp';
import { r2BucketName, r2Client, r2Configured, safeObjectKey } from './mockupStorage.js';

export const LEGACY_OPERATIONAL_BUCKETS = new Set([
  'sample-product-images',
  'product-images',
  'production-photo-proof',
  'sc-receiving-documents',
  'supplier-sync-cache',
]);

const ALLOWED_PREFIXES = [
  'operational/samples/',
  'operational/products/',
  'operational/production/',
  'operational/receiving/',
  'operational/supplier-cache/',
];

function env(name) {
  return String(process.env[name] || '').trim();
}

export function operationalStorageProvider() {
  const provider = (env('ASSET_STORAGE_PROVIDER') || env('MOCKUP_STORAGE_PROVIDER')).toLowerCase();
  if (!provider) {
    throw new Error('ASSET_STORAGE_PROVIDER is not configured. Production storage is fail-closed to prevent Supabase egress fallback.');
  }
  if (provider !== 'r2') {
    throw new Error(`ASSET_STORAGE_PROVIDER must be r2; received ${provider}.`);
  }
  if (!r2Configured()) throw new Error('R2 storage credentials are incomplete. No Supabase fallback was attempted.');
  return provider;
}

export function operationalR2Configured() {
  try {
    return operationalStorageProvider() === 'r2';
  } catch {
    return false;
  }
}

export function safeOperationalKey(value) {
  const key = safeObjectKey(value);
  if (!ALLOWED_PREFIXES.some((prefix) => key.startsWith(prefix))) {
    throw new Error('The operational asset path is outside an approved R2 prefix.');
  }
  return key;
}

async function streamBuffer(body) {
  if (!body) return Buffer.alloc(0);
  if (typeof body.transformToByteArray === 'function') return Buffer.from(await body.transformToByteArray());
  const chunks = [];
  for await (const chunk of body) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export async function operationalPreview(bytes, mimeType = '') {
  if (!String(mimeType).toLowerCase().startsWith('image/') || /svg|gif/i.test(mimeType)) return null;
  const maxPixels = Math.min(Math.max(Number(env('ASSET_PREVIEW_MAX_PIXELS') || 720), 320), 1600);
  const quality = Math.min(Math.max(Number(env('ASSET_PREVIEW_QUALITY') || 76), 40), 95);
  return sharp(bytes, { limitInputPixels: 100_000_000 })
    .rotate()
    .resize({ width: maxPixels, height: maxPixels, fit: 'inside', withoutEnlargement: true })
    .webp({ quality, alphaQuality: quality, effort: 4 })
    .toBuffer();
}

export async function putOperationalObject({ key, bytes, contentType = 'application/octet-stream', makePreview = false }) {
  operationalStorageProvider();
  const path = safeOperationalKey(key);
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  const bucket = r2BucketName();
  await r2Client().send(new PutObjectCommand({
    Bucket: bucket,
    Key: path,
    Body: buffer,
    ContentType: contentType,
    CacheControl: 'private, max-age=31536000, immutable',
  }));
  const head = await r2Client().send(new HeadObjectCommand({ Bucket: bucket, Key: path }));
  if (Number(head.ContentLength) !== buffer.length) throw new Error(`R2 verification failed for ${path}.`);

  const preview = makePreview ? await operationalPreview(buffer, contentType).catch(() => null) : null;
  const previewPath = preview ? `operational/${path.split('/')[1]}/previews/${path.split('/').slice(2).join('/').replace(/\.[a-z0-9]{1,8}$/i, '')}.webp` : null;
  if (preview) {
    await r2Client().send(new PutObjectCommand({
      Bucket: bucket,
      Key: safeOperationalKey(previewPath),
      Body: preview,
      ContentType: 'image/webp',
      CacheControl: 'private, max-age=31536000, immutable',
    }));
  }
  return {
    storage_provider: 'r2',
    storage_bucket: bucket,
    storage_path: path,
    file_size_bytes: buffer.length,
    preview_storage_provider: preview ? 'r2' : null,
    preview_storage_bucket: preview ? bucket : null,
    preview_storage_path: previewPath,
    preview_size_bytes: preview?.length || null,
  };
}

export async function getOperationalObject(supabase, reference) {
  const provider = String(reference?.provider || reference?.storage_provider || '').toLowerCase();
  const bucket = reference?.bucket || reference?.storage_bucket;
  const path = reference?.path || reference?.storage_path;
  if (!bucket || !path) throw new Error('Operational asset reference is incomplete.');
  if (provider === 'r2') {
    operationalStorageProvider();
    if (bucket !== r2BucketName()) throw new Error('Unexpected R2 bucket.');
    const result = await r2Client().send(new GetObjectCommand({ Bucket: bucket, Key: safeOperationalKey(path) }));
    return { bytes: await streamBuffer(result.Body), contentType: result.ContentType || reference.mime_type || 'application/octet-stream' };
  }
  if (provider === 'supabase' || (!provider && LEGACY_OPERATIONAL_BUCKETS.has(bucket))) {
    if (!LEGACY_OPERATIONAL_BUCKETS.has(bucket)) throw new Error('Unexpected legacy Supabase bucket.');
    const { data, error } = await supabase.storage.from(bucket).download(path);
    if (error || !data) throw error || new Error('Supabase returned no file.');
    return { bytes: Buffer.from(await data.arrayBuffer()), contentType: data.type || reference.mime_type || 'application/octet-stream' };
  }
  throw new Error(`Unsupported operational storage provider: ${provider || 'missing'}.`);
}

export async function signedOperationalUrl(supabase, reference, expiresIn = 3600) {
  const provider = String(reference?.provider || reference?.storage_provider || '').toLowerCase();
  const bucket = reference?.bucket || reference?.storage_bucket;
  const path = reference?.path || reference?.storage_path;
  if (!bucket || !path) return '';
  if (provider === 'r2') {
    operationalStorageProvider();
    if (bucket !== r2BucketName()) throw new Error('Unexpected R2 bucket.');
    return getSignedUrl(r2Client(), new GetObjectCommand({ Bucket: bucket, Key: safeOperationalKey(path) }), {
      expiresIn: Math.min(Math.max(Number(expiresIn || 3600), 60), 86400),
    });
  }
  if (provider === 'supabase' || (!provider && LEGACY_OPERATIONAL_BUCKETS.has(bucket))) {
    if (!LEGACY_OPERATIONAL_BUCKETS.has(bucket)) throw new Error('Unexpected legacy Supabase bucket.');
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
    if (error) throw error;
    return data?.signedUrl || '';
  }
  throw new Error(`Unsupported operational storage provider: ${provider || 'missing'}.`);
}

export async function deleteOperationalObject(supabase, reference) {
  const provider = String(reference?.provider || reference?.storage_provider || '').toLowerCase();
  const bucket = reference?.bucket || reference?.storage_bucket;
  const path = reference?.path || reference?.storage_path;
  if (!bucket || !path) return;
  if (provider === 'r2') {
    operationalStorageProvider();
    if (bucket !== r2BucketName()) throw new Error('Unexpected R2 bucket.');
    await r2Client().send(new DeleteObjectCommand({ Bucket: bucket, Key: safeOperationalKey(path) }));
    return;
  }
  if (provider === 'supabase' || (!provider && LEGACY_OPERATIONAL_BUCKETS.has(bucket))) {
    if (!LEGACY_OPERATIONAL_BUCKETS.has(bucket)) throw new Error('Unexpected legacy Supabase bucket.');
    const { error } = await supabase.storage.from(bucket).remove([path]);
    if (error) throw error;
    return;
  }
  throw new Error(`Unsupported operational storage provider: ${provider || 'missing'}.`);
}

export async function operationalStorageHealth() {
  operationalStorageProvider();
  await r2Client().send(new HeadBucketCommand({ Bucket: r2BucketName() }));
  const counts = {};
  for (const prefix of ALLOWED_PREFIXES) {
    const result = await r2Client().send(new ListObjectsV2Command({ Bucket: r2BucketName(), Prefix: prefix, MaxKeys: 1 }));
    counts[prefix] = Number(result.KeyCount || 0);
  }
  return { provider: 'r2', bucket: r2BucketName(), reachable: true, prefixes: counts };
}
