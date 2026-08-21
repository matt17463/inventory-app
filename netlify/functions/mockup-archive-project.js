import { authorizeEmployee, jsonResponse } from './_shared/security.js';
import { parseJsonBody } from './_shared/mockupUtils.js';

const DELETE_BATCH_SIZE = 40;
const ALLOWED_BUCKETS = new Set(['sc-mockup-source', 'sc-mockup-output', 'sc-mockup-production']);

function fileKey(bucket, path) {
  return `${bucket}/${path}`;
}

async function expectedProjectFiles(supabase, projectId) {
  const queries = await Promise.all([
    supabase.from('mockup_blank_assets').select('id,storage_bucket,storage_path').eq('project_id', projectId),
    supabase.from('mockup_artwork_assets').select('id,storage_bucket,storage_path,prepared_storage_path').eq('project_id', projectId),
    supabase.from('mockup_outputs').select('id,storage_bucket,storage_path').eq('project_id', projectId),
    supabase.from('mockup_production_packets').select('id,storage_bucket,storage_path').eq('project_id', projectId),
  ]);
  const firstError = queries.find((query) => query.error)?.error;
  if (firstError) throw firstError;
  const files = new Map();
  const add = (row, path) => {
    if (!row.storage_bucket || !path) return;
    if (!ALLOWED_BUCKETS.has(row.storage_bucket)) throw new Error(`Archive blocked: unsupported Storage bucket ${row.storage_bucket}.`);
    files.set(fileKey(row.storage_bucket, path), { bucket: row.storage_bucket, path });
  };
  (queries[0].data || []).forEach((row) => add(row, row.storage_path));
  (queries[1].data || []).forEach((row) => {
    add(row, row.storage_path);
    add(row, row.prepared_storage_path);
  });
  (queries[2].data || []).forEach((row) => add(row, row.storage_path));
  (queries[3].data || []).forEach((row) => add(row, row.storage_path));
  return files;
}

function validatedManifestFiles(manifest, expected) {
  const rows = Array.isArray(manifest?.files) ? manifest.files : [];
  if (!rows.length) throw new Error('The verified local manifest contains no files.');
  if (rows.length > 5000) throw new Error('An archive cannot contain more than 5,000 files.');
  const supplied = new Map();
  rows.forEach((row) => {
    const bucket = String(row?.bucket || '');
    const path = String(row?.path || '');
    const key = fileKey(bucket, path);
    if (!ALLOWED_BUCKETS.has(bucket) || !path || row?.key !== key) throw new Error('The local archive manifest contains an invalid Storage path.');
    if (!/^[a-f0-9]{64}$/.test(String(row?.sha256 || ''))) throw new Error(`The local archive checksum is invalid for ${path}.`);
    if (!Number.isSafeInteger(Number(row?.size)) || Number(row.size) < 0) throw new Error(`The local archive size is invalid for ${path}.`);
    if (supplied.has(key)) throw new Error(`The local archive contains a duplicate file: ${path}.`);
    supplied.set(key, row);
  });
  const missing = [...expected.keys()].filter((key) => !supplied.has(key));
  const extra = [...supplied.keys()].filter((key) => !expected.has(key));
  if (missing.length || extra.length) {
    throw new Error(`Archive verification failed: ${missing.length} Supabase file(s) are missing locally and ${extra.length} unexpected file(s) were supplied. Nothing was removed.`);
  }
  return rows;
}

async function beginArchive(supabase, user, body) {
  const projectId = String(body.project_id || '');
  if (!projectId) throw new Error('Missing Mockup Studio project ID.');
  const { data: project, error: projectError } = await supabase.from('mockup_projects').select('id,project_name,status').eq('id', projectId).single();
  if (projectError || !project) throw projectError || new Error('Mockup Studio project was not found.');
  const { data: unfinished, error: unfinishedError } = await supabase
    .from('mockup_project_archives')
    .select('*')
    .eq('project_id', projectId)
    .in('status', ['preparing', 'deleting', 'active'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (unfinishedError) throw unfinishedError;
  if (unfinished) {
    return { archive: unfinished, existing: true, remaining: Math.max(0, Number(unfinished.file_count || 0) - (unfinished.deleted_file_keys || []).length) };
  }
  const expected = await expectedProjectFiles(supabase, projectId);
  const files = validatedManifestFiles(body.manifest, expected);
  const totalBytes = files.reduce((total, row) => total + Number(row.size || 0), 0);
  const archiveName = String(body.manifest?.project_name || project.project_name || 'Mockup project').slice(0, 200);
  const manifest = {
    format: 'skilled-crafting-mockup-archive',
    archive_version: 1,
    project_id: projectId,
    project_name: archiveName,
    created_at: body.manifest?.created_at || new Date().toISOString(),
    folder_hint: String(body.manifest?.folder_hint || '').slice(0, 500) || null,
    file_count: files.length,
    total_bytes: totalBytes,
    files: files.map((row) => ({
      key: row.key, bucket: row.bucket, path: row.path, local_file: row.local_file,
      size: Number(row.size), sha256: row.sha256, mime_type: row.mime_type || null,
    })),
    external_references: Array.isArray(body.manifest?.external_references) ? body.manifest.external_references.slice(0, 1000) : [],
  };
  const { data: archive, error: archiveError } = await supabase.from('mockup_project_archives').insert({
    project_id: projectId,
    archive_name: archiveName,
    folder_hint: manifest.folder_hint,
    status: 'deleting',
    previous_project_status: project.status,
    manifest,
    file_count: files.length,
    total_bytes: totalBytes,
    archived_by: user.id,
    last_verified_at: new Date().toISOString(),
  }).select('*').single();
  if (archiveError) throw archiveError;
  return { archive, existing: false, remaining: files.length };
}

async function continueArchive(supabase, body) {
  const archiveId = String(body.archive_id || '');
  if (!archiveId) throw new Error('Missing local archive ID.');
  const { data: archive, error } = await supabase.from('mockup_project_archives').select('*').eq('id', archiveId).single();
  if (error || !archive) throw error || new Error('Local archive record was not found.');
  if (archive.status === 'active') return { archive, completed: true, remaining: 0 };
  if (archive.status !== 'deleting') throw new Error(`Archive cleanup cannot continue while its status is ${archive.status}.`);
  const files = Array.isArray(archive.manifest?.files) ? archive.manifest.files : [];
  const deleted = new Set(Array.isArray(archive.deleted_file_keys) ? archive.deleted_file_keys : []);
  const batch = files.filter((row) => !deleted.has(row.key)).slice(0, DELETE_BATCH_SIZE);
  const grouped = new Map();
  batch.forEach((row) => {
    if (!grouped.has(row.bucket)) grouped.set(row.bucket, []);
    grouped.get(row.bucket).push(row);
  });
  for (const [bucket, rows] of grouped) {
    const { error: removeError } = await supabase.storage.from(bucket).remove(rows.map((row) => row.path));
    if (removeError) throw new Error(`Could not remove archived files from ${bucket}: ${removeError.message}`);
    rows.forEach((row) => deleted.add(row.key));
  }
  const remaining = files.filter((row) => !deleted.has(row.key)).length;
  const completed = remaining === 0;
  const changes = {
    deleted_file_keys: [...deleted],
    status: completed ? 'active' : 'deleting',
    archived_at: completed ? new Date().toISOString() : null,
    error_message: null,
  };
  const { data: updated, error: updateError } = await supabase.from('mockup_project_archives').update(changes).eq('id', archive.id).select('*').single();
  if (updateError) throw updateError;
  if (completed) {
    const { error: projectError } = await supabase.from('mockup_projects').update({ status: 'archived' }).eq('id', archive.project_id);
    if (projectError) throw projectError;
  }
  return { archive: updated, completed, remaining };
}

async function completeRestore(supabase, body) {
  const archiveId = String(body.archive_id || '');
  const restoredKeys = [...new Set(Array.isArray(body.restored_file_keys) ? body.restored_file_keys.map(String) : [])];
  const { data: archive, error } = await supabase.from('mockup_project_archives').select('*').eq('id', archiveId).single();
  if (error || !archive) throw error || new Error('Local archive record was not found.');
  if (archive.status !== 'active') throw new Error(`Only an active local archive can be restored. Current status: ${archive.status}.`);
  const expectedKeys = (archive.manifest?.files || []).map((row) => row.key).sort();
  if (restoredKeys.sort().join('\n') !== expectedKeys.join('\n')) {
    throw new Error('Restore verification failed because not every archived file was uploaded. The project remains archived.');
  }
  const restoreStatus = archive.previous_project_status && archive.previous_project_status !== 'archived'
    ? archive.previous_project_status
    : 'draft';
  const { error: projectError } = await supabase.from('mockup_projects').update({ status: restoreStatus }).eq('id', archive.project_id);
  if (projectError) throw projectError;
  const { data: updated, error: updateError } = await supabase.from('mockup_project_archives').update({
    status: 'restored',
    restored_at: new Date().toISOString(),
    last_verified_at: new Date().toISOString(),
    error_message: null,
  }).eq('id', archive.id).select('*').single();
  if (updateError) throw updateError;
  return { archive: updated, restored_project_status: restoreStatus };
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return jsonResponse(204, {}, event);
  if (event.httpMethod !== 'POST') return jsonResponse(405, { success: false, error: 'Method not allowed.' }, event);
  const auth = await authorizeEmployee(event, { functionName: 'mockup-archive-project', allowedRoles: ['admin', 'manager'] });
  if (!auth.ok) return jsonResponse(auth.statusCode, { success: false, error: auth.message }, event);
  let archiveId = '';
  try {
    const body = parseJsonBody(event);
    archiveId = String(body.archive_id || '');
    const action = String(body.action || '');
    const result = action === 'begin'
      ? await beginArchive(auth.supabase, auth.user, body)
      : action === 'continue'
        ? await continueArchive(auth.supabase, body)
        : action === 'restore_complete'
          ? await completeRestore(auth.supabase, body)
          : null;
    if (!result) throw new Error('Unknown archive action.');
    return jsonResponse(200, { success: true, ...result }, event);
  } catch (error) {
    console.error('Mockup local archive action failed:', error);
    if (archiveId) {
      await auth.supabase.from('mockup_project_archives').update({ error_message: error.message || 'Archive operation failed.' }).eq('id', archiveId);
    }
    return jsonResponse(500, { success: false, error: error.message || 'Mockup local archive operation failed.' }, event);
  }
}
