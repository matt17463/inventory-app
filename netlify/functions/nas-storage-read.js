import { createServiceClient, getHeader } from './_shared/security.js';
import { STORAGE_BACKUP_BUCKETS, storageBackupAuthorized, storageBackupPage, storageBackupRequest } from './_shared/storageBackupRead.js';

const reply = (statusCode, body) => ({ statusCode, headers: {
  'Content-Type': 'application/json', 'Cache-Control': 'no-store, private',
  'X-Content-Type-Options': 'nosniff',
}, body: JSON.stringify(body) });

export const handler = async event => {
  if (event.httpMethod !== 'POST') return reply(405, { error: 'Method not supported.' });
  const supplied = getHeader(event, 'authorization').replace(/^Bearer\s+/i, '');
  if (!storageBackupAuthorized(supplied, process.env.SC_STORAGE_BACKUP_READ_TOKEN)) return reply(403, { error: 'Unauthorized.' });
  if (typeof event.body === 'string' && event.body.length > 8192) return reply(413, { error: 'Request too large.' });
  let input;
  try { input = JSON.parse(event.body || '{}'); } catch { return reply(400, { error: 'Invalid JSON.' }); }
  if (!input || typeof input !== 'object' || Array.isArray(input)) return reply(400, { error: 'Invalid request.' });
  if (input.action === 'buckets') return reply(200, { buckets: STORAGE_BACKUP_BUCKETS });
  if (input.action !== undefined && input.action !== 'list') return reply(400, { error: 'Invalid backup action.' });
  let request;
  try { request = storageBackupRequest(input); } catch { return reply(400, { error: 'Invalid backup request.' }); }
  try { return reply(200, await storageBackupPage(createServiceClient(), request)); }
  catch { return reply(502, { error: 'Storage backup read failed.' }); }
};
