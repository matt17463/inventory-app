import { downloadMockupStoredFile, restoreMockupStoredFile } from './mockupStudioApi';

const DB_NAME = 'skilled-crafting-local-archives';
const STORE_NAME = 'directory-handles';
const MANIFEST_NAME = 'mockup-archive-manifest.json';

function openHandleDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function handleStore(mode, key, value) {
  const database = await openHandleDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const store = transaction.objectStore(STORE_NAME);
      const request = mode === 'readonly' ? store.get(key) : store.put(value, key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    database.close();
  }
}

function archiveHandleKey(projectId, archiveId) {
  return `${projectId}:${archiveId}`;
}

async function ensurePermission(handle, mode = 'readwrite') {
  if (!handle) return false;
  if ((await handle.queryPermission?.({ mode })) === 'granted') return true;
  return (await handle.requestPermission?.({ mode })) === 'granted';
}

function safeName(value, fallback = 'mockup-project') {
  return String(value || fallback)
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || fallback;
}

function extensionFor(path, mimeType = '') {
  const match = String(path || '').match(/(\.[a-z0-9]{1,8})$/i);
  if (match) return match[1].toLowerCase();
  const known = {
    'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp',
    'image/svg+xml': '.svg', 'application/pdf': '.pdf',
    'application/json': '.json', 'text/csv': '.csv',
  };
  return known[String(mimeType || '').toLowerCase()] || '.bin';
}

async function sha256(blob) {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function writeFile(directory, name, contents) {
  const fileHandle = await directory.getFileHandle(name, { create: true });
  const writer = await fileHandle.createWritable();
  await writer.write(contents);
  await writer.close();
  return fileHandle;
}

async function readManifest(directory) {
  const handle = await directory.getFileHandle(MANIFEST_NAME);
  const file = await handle.getFile();
  return JSON.parse(await file.text());
}

function storageReferences(bundle) {
  const rows = [];
  const add = (recordType, row, field = 'storage_path') => {
    const path = row?.[field];
    const preview = field === 'preview_storage_path';
    const prepared = field === 'prepared_storage_path';
    const bucket = preview
      ? (row.preview_storage_bucket || row.storage_bucket)
      : prepared
        ? (row.prepared_storage_bucket || row.storage_bucket)
        : row.storage_bucket;
    const provider = preview
      ? (row.preview_storage_provider || row.storage_provider || 'supabase')
      : prepared
        ? (row.prepared_storage_provider || row.storage_provider || 'supabase')
        : (row.storage_provider || 'supabase');
    if (!bucket || !path) return;
    rows.push({
      key: `${provider}:${bucket}/${path}`,
      provider,
      bucket,
      path,
      mime_type: preview ? 'image/webp' : (row.mime_type || null),
      references: [{ record_type: recordType, record_id: row.id, field }],
    });
  };
  const addPrimaryAndPreview = (recordType, row) => {
    add(recordType, row);
    add(recordType, row, 'preview_storage_path');
  };
  (bundle.blanks || []).forEach((row) => addPrimaryAndPreview('mockup_blank_assets', row));
  (bundle.artwork || []).forEach((row) => {
    addPrimaryAndPreview('mockup_artwork_assets', row);
    add('mockup_artwork_assets', row, 'prepared_storage_path');
  });
  (bundle.outputs || []).forEach((row) => addPrimaryAndPreview('mockup_outputs', row));
  (bundle.packets || []).forEach((row) => addPrimaryAndPreview('mockup_production_packets', row));

  const unique = new Map();
  rows.forEach((row) => {
    if (!unique.has(row.key)) unique.set(row.key, row);
    else unique.get(row.key).references.push(...row.references);
  });
  return [...unique.values()].sort((a, b) => a.key.localeCompare(b.key));
}

function externalReferences(bundle) {
  return [
    ...(bundle.blanks || []).map((row) => ({ record_type: 'mockup_blank_assets', record_id: row.id, source_url: row.source_url })),
    ...(bundle.artwork || []).map((row) => ({ record_type: 'mockup_artwork_assets', record_id: row.id, source_url: row.source_url })),
  ].filter((row) => row.source_url);
}

function projectSnapshot(bundle) {
  const snapshot = { ...bundle };
  delete snapshot.archives;
  return snapshot;
}

export function localMockupArchiveSupported() {
  return typeof window !== 'undefined'
    && typeof window.showDirectoryPicker === 'function'
    && typeof indexedDB !== 'undefined'
    && Boolean(globalThis.crypto?.subtle);
}


export function localMockupGraphicExportSupported() {
  return typeof window !== 'undefined'
    && typeof window.showDirectoryPicker === 'function'
    && Boolean(globalThis.crypto?.subtle);
}

function mockupGraphicExportReference(recordType, row, {
  field = 'storage_path',
  folder = 'Files',
  fileName = '',
  kind = 'file',
} = {}) {
  const path = row?.[field];
  const preview = field === 'preview_storage_path';
  const prepared = field === 'prepared_storage_path';
  const bucket = preview
    ? (row?.preview_storage_bucket || row?.storage_bucket)
    : prepared
      ? (row?.prepared_storage_bucket || row?.storage_bucket)
      : row?.storage_bucket;
  const provider = preview
    ? (row?.preview_storage_provider || row?.storage_provider || 'supabase')
    : prepared
      ? (row?.prepared_storage_provider || row?.storage_provider || 'supabase')
      : (row?.storage_provider || 'supabase');

  if (!bucket || !path) return null;

  return {
    key: `${provider}:${bucket}/${path}`,
    provider,
    bucket,
    path,
    mime_type: preview ? 'image/webp' : (row?.mime_type || null),
    folder,
    file_name: fileName || path.split('/').pop() || 'asset',
    kind,
    references: [{ record_type: recordType, record_id: row.id, field }],
  };
}

function mockupGraphicExportName(row, fallback) {
  return row?.original_file_name
    || row?.output_name
    || row?.artwork_name
    || row?.asset_name
    || row?.file_name
    || row?.packet_number
    || fallback;
}

export function buildMockupGraphicExportPlan(bundle, selections = {}) {
  const options = {
    blank_photos: selections.blank_photos !== false,
    artwork_originals: selections.artwork_originals !== false,
    artwork_prepared: selections.artwork_prepared !== false,
    generated_mockups: selections.generated_mockups !== false,
    production_files: selections.production_files !== false,
    previews: Boolean(selections.previews),
  };

  const references = [];
  const externalReferences = [];
  const add = (reference) => {
    if (reference) references.push(reference);
  };
  const external = (recordType, row, label) => {
    if (!row?.source_url || row?.storage_path) return;
    externalReferences.push({
      record_type: recordType,
      record_id: row.id,
      label,
      source_url: row.source_url,
      reason: 'This asset is referenced by an external URL and is not stored in Mockup Studio cloud storage.',
    });
  };

  if (options.blank_photos) {
    (bundle?.blanks || []).forEach((row) => {
      add(mockupGraphicExportReference('mockup_blank_assets', row, {
        folder: 'Blank Photos',
        fileName: mockupGraphicExportName(row, 'blank-photo'),
        kind: 'blank_photo',
      }));
      external('mockup_blank_assets', row, mockupGraphicExportName(row, 'blank-photo'));
    });
  }

  if (options.artwork_originals) {
    (bundle?.artwork || []).forEach((row) => {
      add(mockupGraphicExportReference('mockup_artwork_assets', row, {
        folder: 'Artwork/Originals',
        fileName: mockupGraphicExportName(row, 'artwork'),
        kind: 'artwork_original',
      }));
      external('mockup_artwork_assets', row, mockupGraphicExportName(row, 'artwork'));
    });
  }

  if (options.artwork_prepared) {
    (bundle?.artwork || []).forEach((row) => {
      add(mockupGraphicExportReference('mockup_artwork_assets', row, {
        field: 'prepared_storage_path',
        folder: 'Artwork/Prepared',
        fileName: `${row?.artwork_name || row?.original_file_name || 'artwork'}-prepared`,
        kind: 'artwork_prepared',
      }));
    });
  }

  if (options.generated_mockups) {
    (bundle?.outputs || []).forEach((row) => {
      add(mockupGraphicExportReference('mockup_outputs', row, {
        folder: 'Mockups',
        fileName: mockupGraphicExportName(row, 'mockup-output'),
        kind: 'generated_mockup',
      }));
    });
  }

  if (options.production_files) {
    (bundle?.packets || []).forEach((row) => {
      add(mockupGraphicExportReference('mockup_production_packets', row, {
        folder: 'Production',
        fileName: mockupGraphicExportName(row, `production-${row?.id || 'file'}`),
        kind: 'production_file',
      }));
    });
  }

  if (options.previews) {
    [
      ['mockup_blank_assets', bundle?.blanks || [], 'Previews/Blank Photos', 'blank_preview'],
      ['mockup_artwork_assets', bundle?.artwork || [], 'Previews/Artwork', 'artwork_preview'],
      ['mockup_outputs', bundle?.outputs || [], 'Previews/Mockups', 'mockup_preview'],
      ['mockup_production_packets', bundle?.packets || [], 'Previews/Production', 'production_preview'],
    ].forEach(([recordType, rows, folder, kind]) => {
      rows.forEach((row) => {
        add(mockupGraphicExportReference(recordType, row, {
          field: 'preview_storage_path',
          folder,
          fileName: `${mockupGraphicExportName(row, 'preview')}-preview`,
          kind,
        }));
      });
    });
  }

  const unique = new Map();
  references.forEach((row) => {
    if (!unique.has(row.key)) unique.set(row.key, row);
    else unique.get(row.key).references.push(...row.references);
  });

  return {
    options,
    references: [...unique.values()].sort((a, b) => (
      `${a.folder}/${a.file_name}`.localeCompare(`${b.folder}/${b.file_name}`)
    )),
    external_references: externalReferences,
  };
}

async function nestedExportDirectory(root, folder) {
  let current = root;
  for (const part of String(folder || '').split('/').filter(Boolean)) {
    current = await current.getDirectoryHandle(safeName(part, 'Files'), { create: true });
  }
  return current;
}

function reserveExportFileName(usedNames, folder, requestedName, sourcePath, mimeType) {
  const extension = extensionFor(sourcePath, mimeType);
  const requestedBase = String(requestedName || 'asset').replace(/\.[a-z0-9]{1,8}$/i, '');
  const base = safeName(requestedBase, 'asset');
  const folderKey = String(folder || '');
  if (!usedNames.has(folderKey)) usedNames.set(folderKey, new Set());
  const used = usedNames.get(folderKey);

  let candidate = `${base}${extension}`;
  let suffix = 2;
  while (used.has(candidate.toLowerCase())) {
    candidate = `${base}-${suffix}${extension}`;
    suffix += 1;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

export async function createLocalMockupGraphicExport({
  project,
  bundle,
  selections = {},
  onProgress = () => {},
}) {
  if (!localMockupGraphicExportSupported()) {
    throw new Error('Downloading all Mockup Studio graphics requires Google Chrome or Microsoft Edge on this computer.');
  }

  const plan = buildMockupGraphicExportPlan(bundle, selections);
  if (!plan.references.length) {
    throw new Error('No stored Mockup Studio files match the selected download categories.');
  }

  const root = await window.showDirectoryPicker({ id: 'sc-mockup-graphics-downloads', mode: 'readwrite' });
  if (!await ensurePermission(root)) throw new Error('Read and write access to the selected download folder was not granted.');

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const folderName = `${safeName(project?.project_name)}-graphics-${stamp}`;
  const directory = await root.getDirectoryHandle(folderName, { create: true });
  const usedNames = new Map();
  const files = [];
  let totalBytes = 0;

  for (let index = 0; index < plan.references.length; index += 1) {
    const reference = plan.references[index];
    onProgress({
      stage: 'download',
      completed: index,
      total: plan.references.length,
      message: `Downloading project graphic ${index + 1} of ${plan.references.length}…`,
    });

    const blob = await downloadMockupStoredFile(reference);
    if (!blob) throw new Error(`Could not download ${reference.path}: no file was returned.`);

    const targetDirectory = await nestedExportDirectory(directory, reference.folder);
    const localName = reserveExportFileName(
      usedNames,
      reference.folder,
      reference.file_name,
      reference.path,
      reference.mime_type || blob.type,
    );
    const checksum = await sha256(blob);
    const fileHandle = await writeFile(targetDirectory, localName, blob);
    const savedFile = await fileHandle.getFile();

    if (savedFile.size !== blob.size || await sha256(savedFile) !== checksum) {
      throw new Error(`Local download verification failed for ${reference.path}. Cloud storage was not changed.`);
    }

    totalBytes += blob.size;
    files.push({
      kind: reference.kind,
      local_file: `${reference.folder}/${localName}`,
      source_key: reference.key,
      size: blob.size,
      sha256: checksum,
      mime_type: reference.mime_type || blob.type || null,
      references: reference.references,
    });
  }

  const manifest = {
    format: 'skilled-crafting-mockup-graphics-download',
    export_version: 1,
    project_id: project?.id || null,
    project_name: project?.project_name || null,
    created_at: new Date().toISOString(),
    folder_hint: `${root.name}/${directory.name}`,
    cloud_files_changed: false,
    selections: plan.options,
    file_count: files.length,
    total_bytes: totalBytes,
    files,
    external_references_not_downloaded: plan.external_references,
  };

  await writeFile(directory, 'mockup-graphics-download-manifest.json', JSON.stringify(manifest, null, 2));
  if (plan.external_references.length) {
    await writeFile(
      directory,
      'external-references-not-downloaded.json',
      JSON.stringify(plan.external_references, null, 2),
    );
  }

  onProgress({
    stage: 'complete',
    completed: files.length,
    total: files.length,
    message: `${files.length} project file${files.length === 1 ? '' : 's'} downloaded and verified. Cloud storage was not changed.`,
  });

  return {
    directory,
    folder_name: directory.name,
    folder_hint: manifest.folder_hint,
    file_count: files.length,
    total_bytes: totalBytes,
    external_references_not_downloaded: plan.external_references.length,
    manifest,
  };
}


export async function createLocalMockupArchive({ project, bundle, onProgress = () => {} }) {
  if (!localMockupArchiveSupported()) {
    throw new Error('Local folder archives require Google Chrome or Microsoft Edge on this computer.');
  }
  const root = await window.showDirectoryPicker({ id: 'sc-mockup-archives', mode: 'readwrite' });
  if (!await ensurePermission(root)) throw new Error('Read and write access to the selected folder was not granted.');

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const folderName = `${safeName(project.project_name)}-${String(project.id).slice(0, 8)}-${stamp}`;
  const directory = await root.getDirectoryHandle(folderName, { create: true });
  const filesDirectory = await directory.getDirectoryHandle('files', { create: true });
  const references = storageReferences(bundle);
  if (!references.length) throw new Error('This project does not currently have any cloud files to archive.');

  const files = [];
  let totalBytes = 0;
  for (let index = 0; index < references.length; index += 1) {
    const reference = references[index];
    onProgress({ stage: 'download', completed: index, total: references.length, message: `Archiving file ${index + 1} of ${references.length}…` });
    const blob = await downloadMockupStoredFile(reference);
    if (!blob) throw new Error(`Could not download ${reference.path}: no file was returned.`);
    const checksum = await sha256(blob);
    const originalName = reference.path.split('/').pop() || 'asset';
    const extension = extensionFor(reference.path, reference.mime_type);
    const baseName = originalName.replace(/\.[a-z0-9]{1,8}$/i, '');
    const finalLocalName = `${String(index + 1).padStart(5, '0')}-${safeName(baseName, 'asset')}${extension}`;
    const fileHandle = await writeFile(filesDirectory, finalLocalName, blob);
    const savedFile = await fileHandle.getFile();
    const savedChecksum = await sha256(savedFile);
    if (savedFile.size !== blob.size || savedChecksum !== checksum) {
      throw new Error(`Local verification failed for ${reference.path}. Nothing has been removed from cloud storage.`);
    }
    totalBytes += blob.size;
    files.push({
      ...reference,
      local_file: `files/${finalLocalName}`,
      size: blob.size,
      sha256: checksum,
      mime_type: reference.mime_type || blob.type || null,
    });
  }

  const manifest = {
    format: 'skilled-crafting-mockup-archive',
    archive_version: 2,
    archive_id: null,
    project_id: project.id,
    project_name: project.project_name,
    created_at: new Date().toISOString(),
    folder_hint: `${root.name}/${directory.name}`,
    file_count: files.length,
    total_bytes: totalBytes,
    files,
    external_references: externalReferences(bundle),
    project_snapshot: projectSnapshot(bundle),
  };
  await writeFile(directory, MANIFEST_NAME, JSON.stringify(manifest, null, 2));
  const verifiedManifest = await readManifest(directory);
  if (verifiedManifest.project_id !== project.id || verifiedManifest.files?.length !== files.length) {
    throw new Error('The local archive manifest could not be verified. Nothing has been removed from cloud storage.');
  }
  onProgress({ stage: 'verified', completed: files.length, total: files.length, message: `${files.length} local files verified. Cloud cleanup can now begin.` });
  return { directory, manifest };
}

export async function finalizeLocalArchiveManifest(directory, manifest, archiveId) {
  const finalManifest = { ...manifest, archive_id: archiveId, finalized_at: new Date().toISOString() };
  await writeFile(directory, MANIFEST_NAME, JSON.stringify(finalManifest, null, 2));
  const saved = await readManifest(directory);
  if (saved.archive_id !== archiveId) throw new Error('The archive ID was not saved to the local manifest.');
  await rememberLocalArchiveHandle(saved.project_id, archiveId, directory);
  return finalManifest;
}

export async function rememberLocalArchiveHandle(projectId, archiveId, directory) {
  await handleStore('readwrite', archiveHandleKey(projectId, archiveId), directory);
}

export async function linkedLocalArchiveHandle(projectId, archiveId, mode = 'readwrite') {
  const handle = await handleStore('readonly', archiveHandleKey(projectId, archiveId));
  if (!handle || !await ensurePermission(handle, mode)) return null;
  return handle;
}

export async function reconnectLocalArchiveFolder(projectId, archiveId) {
  if (!localMockupArchiveSupported()) throw new Error('Folder reconnection requires Google Chrome or Microsoft Edge.');
  const directory = await window.showDirectoryPicker({ id: `sc-mockup-${String(projectId).slice(0, 8)}`, mode: 'readwrite' });
  if (!await ensurePermission(directory)) throw new Error('Read and write access to this folder was not granted.');
  const manifest = await readManifest(directory).catch(() => null);
  if (!manifest || manifest.format !== 'skilled-crafting-mockup-archive') throw new Error(`The selected folder does not contain ${MANIFEST_NAME}.`);
  if (manifest.project_id !== projectId) throw new Error('The selected archive belongs to a different Mockup Studio project.');
  if (manifest.archive_id && manifest.archive_id !== archiveId) throw new Error('The selected folder belongs to a different archive of this project.');
  await rememberLocalArchiveHandle(projectId, archiveId, directory);
  return { directory, manifest };
}

async function localFile(directory, relativePath) {
  const parts = String(relativePath || '').split('/').filter(Boolean);
  let current = directory;
  for (const part of parts.slice(0, -1)) current = await current.getDirectoryHandle(part);
  return (await current.getFileHandle(parts.at(-1))).getFile();
}

export async function verifyLinkedLocalMockupArchive({ projectId, archive, onProgress = () => {} }) {
  let directory = await linkedLocalArchiveHandle(projectId, archive.id);
  let manifest;
  if (directory) manifest = await readManifest(directory).catch(() => null);
  if (!directory || !manifest) ({ directory, manifest } = await reconnectLocalArchiveFolder(projectId, archive.id));
  if (manifest.project_id !== projectId || (manifest.archive_id && manifest.archive_id !== archive.id)) {
    throw new Error('The linked local archive does not match this project.');
  }
  const files = Array.isArray(manifest.files) ? manifest.files : [];
  if (files.length !== Number(archive.file_count || files.length)) throw new Error('The local archive file count does not match the Supabase archive record.');
  for (let index = 0; index < files.length; index += 1) {
    const entry = files[index];
    onProgress({ stage: 'verify', completed: index, total: files.length, message: `Verifying local file ${index + 1} of ${files.length}…` });
    const file = await localFile(directory, entry.local_file);
    if (file.size !== Number(entry.size) || await sha256(file) !== entry.sha256) {
      throw new Error(`Local archive verification failed for ${entry.local_file}. Nothing else will be removed from cloud storage.`);
    }
  }
  onProgress({ stage: 'verified', completed: files.length, total: files.length, message: `${files.length} local archive files verified.` });
  return { directory, manifest };
}

export async function restoreLocalMockupArchiveFiles({ projectId, archive, onProgress = () => {} }) {
  let directory = await linkedLocalArchiveHandle(projectId, archive.id);
  let manifest;
  if (directory) manifest = await readManifest(directory).catch(() => null);
  if (!directory || !manifest) ({ directory, manifest } = await reconnectLocalArchiveFolder(projectId, archive.id));
  if (manifest.project_id !== projectId || (manifest.archive_id && manifest.archive_id !== archive.id)) {
    throw new Error('The linked local archive does not match this project.');
  }
  const files = Array.isArray(manifest.files) ? manifest.files : [];
  if (!files.length) throw new Error('The local archive manifest contains no files.');

  const restoredKeys = [];
  for (let index = 0; index < files.length; index += 1) {
    const entry = files[index];
    onProgress({ stage: 'restore', completed: index, total: files.length, message: `Restoring file ${index + 1} of ${files.length}…` });
    const file = await localFile(directory, entry.local_file);
    if (file.size !== Number(entry.size) || await sha256(file) !== entry.sha256) {
      throw new Error(`Local archive verification failed for ${entry.local_file}. Restore stopped before marking the project active.`);
    }
    await restoreMockupStoredFile(entry, file, archive.id);
    restoredKeys.push(entry.key);
  }
  onProgress({ stage: 'restored', completed: files.length, total: files.length, message: `${files.length} files restored to cloud storage.` });
  return { restoredKeys, manifest, directory };
}
