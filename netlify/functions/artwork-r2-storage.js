import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import {
  cleanObjectName,
  presignedR2Put,
  r2BucketName,
  r2Client,
  r2Configured,
  safeObjectKey,
} from './_shared/mockupStorage.js';

const MAX_FILE_BYTES = 52_428_800;
const ALLOWED_MIME = /^(image\/(png|jpeg|webp|svg\+xml)|application\/pdf)$/i;

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(body),
  };
}

function header(event, name) {
  const wanted = String(name || '').toLowerCase();
  const entry = Object.entries(event.headers || {}).find(([key]) => key.toLowerCase() === wanted);
  return entry ? String(entry[1] || '') : '';
}

function expectedSecret() {
  return String(
    process.env.SC_ARTWORK_R2_SECRET
    || process.env.SC_ARTWORK_WEBHOOK_SECRET
    || process.env.SC_INVENTORY_BRIDGE_SECRET
    || process.env.VITE_SC_INVENTORY_BRIDGE_SECRET
    || '',
  ).trim();
}

function authenticate(event) {
  const expected = expectedSecret();
  if (!expected) throw new Error('Artwork R2 bridge secret is not configured. Set SC_ARTWORK_R2_SECRET or SC_ARTWORK_WEBHOOK_SECRET.');
  const provided = header(event, 'x-sc-artwork-secret') || header(event, 'x-webhook-secret');
  if (!provided || provided !== expected) {
    const error = new Error('Invalid artwork R2 bridge secret.');
    error.statusCode = 401;
    throw error;
  }
}

function parseBody(event) {
  try {
    return JSON.parse(event.body || '{}');
  } catch {
    const error = new Error('Invalid JSON body.');
    error.statusCode = 400;
    throw error;
  }
}

function safeSegment(value, fallback = 'item') {
  const clean = String(value || fallback)
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return clean || fallback;
}

function fileSize(value) {
  const number = Number(value || 0);
  if (!Number.isSafeInteger(number) || number < 1 || number > MAX_FILE_BYTES) {
    throw new Error('Artwork files must be between 1 byte and 50 MB.');
  }
  return number;
}

function mimeType(value) {
  const type = String(value || 'application/octet-stream').split(';')[0].trim().toLowerCase();
  if (!ALLOWED_MIME.test(type)) throw new Error(`Unsupported artwork file type: ${type}.`);
  return type;
}

function artworkKey(body) {
  const requestId = safeSegment(body.request_id || 'unassigned', 'unassigned');
  const sourceType = safeSegment(body.source_type || 'file', 'file');
  const sourceId = safeSegment(body.source_id || 'new', 'new');
  const field = safeSegment(body.source_field || 'file', 'file');
  const filename = cleanObjectName(body.filename || 'artwork');
  return `artwork-system/${requestId}/${sourceType}/${sourceId}/${field}/${randomUUID()}-${filename}`;
}

async function createUpload(body) {
  if (!r2Configured()) throw new Error('Cloudflare R2 is not configured in Netlify.');
  const size = fileSize(body.file_size);
  const contentType = mimeType(body.content_type);
  const key = artworkKey(body);
  return {
    configured: true,
    provider: 'r2',
    bucket: r2BucketName(),
    path: key,
    file_size: size,
    content_type: contentType,
    upload_url: await presignedR2Put({ key, contentType, expiresIn: 900 }),
    expires_in: 900,
  };
}

async function verifyObject(body) {
  const bucket = String(body.bucket || '');
  if (bucket !== r2BucketName()) throw new Error('Artwork object references an unexpected R2 bucket.');
  const key = safeObjectKey(body.path);
  const head = await r2Client().send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  const expectedSize = body.expected_size == null ? null : fileSize(body.expected_size);
  const actualSize = Number(head.ContentLength || 0);
  if (expectedSize != null && actualSize !== expectedSize) {
    throw new Error(`R2 verification failed: expected ${expectedSize} bytes but found ${actualSize}.`);
  }
  return {
    verified: true,
    provider: 'r2',
    bucket,
    path: key,
    file_size: actualSize,
    content_type: head.ContentType || null,
    etag: String(head.ETag || '').replace(/^"|"$/g, ''),
    last_modified: head.LastModified ? head.LastModified.toISOString() : null,
  };
}

async function signDownload(body) {
  const bucket = String(body.bucket || '');
  if (bucket !== r2BucketName()) throw new Error('Artwork object references an unexpected R2 bucket.');
  const key = safeObjectKey(body.path);
  const expiresIn = Math.min(Math.max(Number(body.expires_in || 300), 60), 3600);
  // HEAD first so broken database references fail before a customer receives a redirect.
  await r2Client().send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  const url = await getSignedUrl(
    r2Client(),
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentDisposition: 'inline',
    }),
    { expiresIn },
  );
  return { url, expires_in: expiresIn, provider: 'r2', bucket, path: key };
}

async function deleteObject(body) {
  const bucket = String(body.bucket || '');
  if (bucket !== r2BucketName()) throw new Error('Artwork object references an unexpected R2 bucket.');
  const key = safeObjectKey(body.path);
  if (!key.startsWith('artwork-system/')) throw new Error('Refusing to delete a non-Artwork-System R2 object.');
  await r2Client().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  return { deleted: true, provider: 'r2', bucket, path: key };
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return response(204, {});
  if (event.httpMethod !== 'POST') return response(405, { success: false, error: 'Use POST.' });

  try {
    authenticate(event);
    const body = parseBody(event);
    const action = String(body.action || 'status');
    let result;
    if (action === 'status') {
      result = {
        configured: r2Configured(),
        bucket: r2Configured() ? r2BucketName() : null,
        max_file_bytes: MAX_FILE_BYTES,
      };
    } else if (action === 'create_upload') {
      result = await createUpload(body);
    } else if (action === 'verify') {
      result = await verifyObject(body);
    } else if (action === 'sign_download') {
      result = await signDownload(body);
    } else if (action === 'delete') {
      result = await deleteObject(body);
    } else {
      const error = new Error('Unknown artwork R2 storage action.');
      error.statusCode = 400;
      throw error;
    }
    return response(200, { success: true, ...result });
  } catch (error) {
    console.error('Artwork R2 storage request failed:', error);
    return response(error.statusCode || 500, { success: false, error: error.message || 'Artwork R2 storage request failed.' });
  }
}
