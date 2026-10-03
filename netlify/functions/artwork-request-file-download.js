import { GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  cleanObjectName,
  r2BucketName,
  r2Client,
  r2Configured,
  safeObjectKey,
} from './_shared/mockupStorage.js';
import { authorizeEmployee, jsonResponse } from './_shared/security.js';

const FUNCTION_NAME = 'artwork-request-file-download';
const ALLOWED_ROLES = ['admin', 'manager', 'operator'];

function parseBody(event) {
  try {
    return JSON.parse(event.body || '{}');
  } catch {
    const error = new Error('Invalid JSON body.');
    error.statusCode = 400;
    throw error;
  }
}

function safeFilename(value, fallback = 'artwork-mockup') {
  const cleaned = cleanObjectName(String(value || fallback));
  return cleaned || fallback;
}

function mockupFilename(mockup, index) {
  const direct = mockup?.original_file_name
    || mockup?.file_name
    || mockup?.filename
    || mockup?.title;
  if (direct) return safeFilename(direct, `artwork-mockup-${index + 1}`);

  const path = String(mockup?.storage_path || '');
  const leaf = path.split('/').pop() || '';
  const withoutUuid = leaf.replace(/^[0-9a-f-]{20,}-/i, '');
  return safeFilename(withoutUuid || `artwork-mockup-${index + 1}`, `artwork-mockup-${index + 1}`);
}

function validateIndex(value, length) {
  const index = Number(value);
  if (!Number.isInteger(index) || index < 0 || index >= length) {
    const error = new Error('The selected mockup is no longer attached to this Artwork Request. Refresh the page and retry.');
    error.statusCode = 404;
    throw error;
  }
  return index;
}

async function signR2Mockup(mockup, index) {
  if (!r2Configured()) throw new Error('Cloudflare R2 is not configured in Netlify.');

  const provider = String(mockup?.storage_provider || '').toLowerCase();
  const bucket = String(mockup?.storage_bucket || '');
  const rawPath = String(mockup?.storage_path || '');
  if (provider !== 'r2' || !bucket || !rawPath) return null;
  if (bucket !== r2BucketName()) throw new Error('Artwork mockup references an unexpected R2 bucket.');

  const path = safeObjectKey(rawPath);
  if (!path.startsWith('artwork-system/')) {
    throw new Error('Refusing to download a file outside Artwork System storage.');
  }

  await r2Client().send(new HeadObjectCommand({ Bucket: bucket, Key: path }));
  const filename = mockupFilename(mockup, index);
  const url = await getSignedUrl(
    r2Client(),
    new GetObjectCommand({
      Bucket: bucket,
      Key: path,
      ResponseContentDisposition: `attachment; filename="${filename.replace(/["\\]/g, '_')}"`,
    }),
    { expiresIn: 300 },
  );

  return {
    url,
    filename,
    provider: 'r2',
    expires_in: 300,
  };
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return jsonResponse(204, {}, event);
  if (event.httpMethod !== 'POST') return jsonResponse(405, { success: false, error: 'Use POST.' }, event);

  const authorization = await authorizeEmployee(event, {
    functionName: FUNCTION_NAME,
    allowedRoles: ALLOWED_ROLES,
  });
  if (!authorization.ok) {
    return jsonResponse(authorization.statusCode, { success: false, error: authorization.message }, event);
  }

  try {
    const body = parseBody(event);
    const requestId = String(body.request_id || '').trim();
    if (!requestId) {
      const error = new Error('Artwork Request ID is required.');
      error.statusCode = 400;
      throw error;
    }

    const { data: request, error: requestError } = await authorization.supabase
      .from('sc_artwork_system_requests')
      .select('id, wp_source_id, mockups')
      .eq('id', requestId)
      .maybeSingle();

    if (requestError) throw requestError;
    if (!request) {
      const error = new Error('Artwork Request was not found.');
      error.statusCode = 404;
      throw error;
    }

    const mockups = Array.isArray(request.mockups) ? request.mockups : [];
    const index = validateIndex(body.mockup_index, mockups.length);
    const mockup = mockups[index] || {};

    const signed = await signR2Mockup(mockup, index);
    if (signed) {
      return jsonResponse(200, {
        success: true,
        request_id: request.id,
        wp_source_id: request.wp_source_id,
        mockup_index: index,
        ...signed,
      }, event);
    }

    const fallbackUrl = String(mockup.file_url || '').trim();
    if (!fallbackUrl) {
      const error = new Error('This older mockup has no R2 storage metadata or usable legacy file URL.');
      error.statusCode = 404;
      throw error;
    }

    return jsonResponse(200, {
      success: true,
      request_id: request.id,
      wp_source_id: request.wp_source_id,
      mockup_index: index,
      url: fallbackUrl,
      filename: mockupFilename(mockup, index),
      provider: 'legacy',
      expires_in: null,
    }, event);
  } catch (error) {
    console.error('Artwork Request mockup download failed:', error);
    return jsonResponse(error.statusCode || 500, {
      success: false,
      error: error.message || 'Artwork Request mockup download failed.',
    }, event);
  }
}
