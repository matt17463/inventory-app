import { authorizeEmployee, jsonResponse } from './_shared/security.js';
import { parseJsonBody } from './_shared/mockupUtils.js';
import {
  createPreviewBuffer,
  deleteStoredReference,
  loadStoredAsset,
  r2BucketName,
  r2Configured,
  verifiedR2Upload,
} from './_shared/mockupStorage.js';

function isSupabaseReference(provider, bucket, path) {
  return Boolean(bucket && path && (!provider || provider === 'supabase'));
}

async function migrationItems(supabase, projectId) {
  const specifications = [
    ['mockup_blank_assets', false],
    ['mockup_artwork_assets', true],
    ['mockup_outputs', false],
    ['mockup_production_packets', false],
  ];
  const items = [];
  for (const [table, includePrepared] of specifications) {
    const { data, error } = await supabase.from(table).select('*').eq('project_id', projectId);
    if (error) throw error;
    for (const row of data || []) {
      if (isSupabaseReference(row.storage_provider, row.storage_bucket, row.storage_path)) {
        items.push({ table, row, kind: 'primary' });
      }
      if (includePrepared && isSupabaseReference(row.prepared_storage_provider, row.prepared_storage_bucket || row.storage_bucket, row.prepared_storage_path)) {
        items.push({ table, row, kind: 'prepared' });
      }
    }
  }
  return items;
}

async function migratePrimary(supabase, item, projectId) {
  const { row, table } = item;
  const source = {
    ...row,
    storage_provider: 'supabase',
  };
  const loaded = await loadStoredAsset(supabase, source);
  const key = `legacy/${row.storage_bucket}/${row.storage_path}`;
  const uploaded = await verifiedR2Upload({ key, bytes: loaded.bytes, contentType: loaded.mimeType });
  const preview = await createPreviewBuffer(loaded.bytes, loaded.mimeType);
  let previewLocation = {};
  if (preview) {
    const previewKey = `previews/${key.replace(/\.[a-z0-9]{1,8}$/i, '')}.webp`;
    const previewUploaded = await verifiedR2Upload({ key: previewKey, bytes: preview, contentType: 'image/webp' });
    previewLocation = {
      preview_storage_provider: 'r2',
      preview_storage_bucket: previewUploaded.bucket,
      preview_storage_path: previewUploaded.key,
      preview_size_bytes: previewUploaded.size,
    };
  }
  const changes = {
    storage_provider: 'r2',
    storage_bucket: uploaded.bucket,
    storage_path: uploaded.key,
    file_size_bytes: uploaded.size,
    ...previewLocation,
  };
  const { error } = await supabase.from(table).update(changes).eq('id', row.id).eq('project_id', projectId);
  if (error) throw error;
  const warnings = [];
  try {
    await deleteStoredReference(supabase, { provider: 'supabase', bucket: row.storage_bucket, path: row.storage_path });
    if (row.preview_storage_path) {
      await deleteStoredReference(supabase, {
        provider: row.preview_storage_provider || 'supabase',
        bucket: row.preview_storage_bucket || row.storage_bucket,
        path: row.preview_storage_path,
      });
    }
  } catch (deleteError) {
    warnings.push(`R2 copy verified, but the old Supabase copy could not be deleted: ${deleteError.message}`);
  }
  return warnings;
}

async function migratePrepared(supabase, item, projectId) {
  const { row, table } = item;
  const sourceBucket = row.prepared_storage_bucket || row.storage_bucket;
  const loaded = await loadStoredAsset(supabase, {
    storage_provider: 'supabase',
    storage_bucket: sourceBucket,
    storage_path: row.prepared_storage_path,
    mime_type: row.mime_type,
    original_file_name: row.original_file_name,
  });
  const key = `legacy/${sourceBucket}/${row.prepared_storage_path}`;
  const uploaded = await verifiedR2Upload({ key, bytes: loaded.bytes, contentType: loaded.mimeType });
  const { error } = await supabase.from(table).update({
    prepared_storage_provider: 'r2',
    prepared_storage_bucket: uploaded.bucket,
    prepared_storage_path: uploaded.key,
    prepared_file_size_bytes: uploaded.size,
  }).eq('id', row.id).eq('project_id', projectId);
  if (error) throw error;
  const warnings = [];
  try {
    await deleteStoredReference(supabase, { provider: 'supabase', bucket: sourceBucket, path: row.prepared_storage_path });
  } catch (deleteError) {
    warnings.push(`Prepared R2 copy verified, but the old Supabase copy could not be deleted: ${deleteError.message}`);
  }
  return warnings;
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return jsonResponse(204, {}, event);
  if (event.httpMethod !== 'POST') return jsonResponse(405, { success: false, error: 'Method not allowed.' }, event);
  const auth = await authorizeEmployee(event, { functionName: 'mockup-migrate-storage', allowedRoles: ['admin', 'manager'] });
  if (!auth.ok) return jsonResponse(auth.statusCode, { success: false, error: auth.message }, event);
  try {
    if (!r2Configured()) throw new Error('R2 is not completely configured in Netlify.');
    const body = parseJsonBody(event);
    const projectId = String(body.project_id || '');
    const batchSize = Math.min(Math.max(Number(body.batch_size || 6), 1), 10);
    if (!projectId) throw new Error('Missing Mockup Studio project ID.');
    const { data: project, error: projectError } = await auth.supabase.from('mockup_projects').select('id,status').eq('id', projectId).single();
    if (projectError || !project) throw projectError || new Error('Mockup Studio project was not found.');
    if (project.status === 'archived') throw new Error('Restore this project from its local archive before migrating its cloud storage.');

    const before = await migrationItems(auth.supabase, projectId);
    const warnings = [];
    let migrated = 0;
    for (const item of before.slice(0, batchSize)) {
      const itemWarnings = item.kind === 'prepared'
        ? await migratePrepared(auth.supabase, item, projectId)
        : await migratePrimary(auth.supabase, item, projectId);
      warnings.push(...itemWarnings);
      migrated += 1;
    }
    const remaining = (await migrationItems(auth.supabase, projectId)).length;
    if (!remaining) {
      await auth.supabase.from('mockup_projects').update({ storage_provider: 'r2', storage_migrated_at: new Date().toISOString() }).eq('id', projectId);
    }
    return jsonResponse(200, {
      success: true,
      migrated,
      remaining,
      r2_bucket: r2BucketName(),
      warnings,
      completed: remaining === 0,
    }, event);
  } catch (error) {
    console.error('Mockup R2 migration failed:', error);
    return jsonResponse(500, { success: false, error: error.message || 'Mockup R2 migration failed.' }, event);
  }
}
