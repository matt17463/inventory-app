
/**
 * Browser-side ZIP supplier file extractor.
 *
 * This version reads the ZIP Central Directory instead of relying only on
 * sequential Local File Headers. That matters because many supplier ZIP files
 * use ZIP features that make sequential parsing stop after the first entry.
 *
 * Purpose:
 * - Let you manually download a supplier ZIP file and upload it into the app.
 * - Avoids server-side 403 blocking from supplier/CDN downloads.
 * - Extracts ALL CSV/TXT/XLS/XLSX/XLSM files from common ZIP archives.
 *
 * Supports:
 * - ZIP compression method 0: stored
 * - ZIP compression method 8: deflate, using browser DecompressionStream
 *
 * Limitations:
 * - Does not support password-protected/encrypted ZIPs.
 * - Does not support ZIP64 archives larger than classic ZIP size fields.
 */

function clean(value) {
  return String(value ?? '').trim();
}

function decodeText(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(bytes.slice(3));
  }
  return new TextDecoder('utf-8').decode(bytes);
}

function readUInt16LE(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readUInt32LE(bytes, offset) {
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)
  ) >>> 0;
}

function getFileKind(fileName) {
  const lowerName = String(fileName || '').toLowerCase();

  if (lowerName.endsWith('.csv')) return 'csv';
  if (lowerName.endsWith('.txt')) return 'txt';
  if (lowerName.endsWith('.xlsx')) return 'xlsx';
  if (lowerName.endsWith('.xlsm')) return 'xlsm';
  if (lowerName.endsWith('.xls')) return 'xls';

  return '';
}

function decodeFileName(bytes, utf8Flag) {
  // Bit 11 means UTF-8 file name. Most supplier ZIPs use ASCII/UTF-8.
  // TextDecoder handles ASCII correctly either way.
  if (utf8Flag) return new TextDecoder('utf-8').decode(bytes);
  try {
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return Array.from(bytes).map((byte) => String.fromCharCode(byte)).join('');
  }
}

function findEndOfCentralDirectory(bytes) {
  // EOCD record can have a variable comment up to 65,535 bytes.
  const minOffset = Math.max(0, bytes.length - 22 - 65535);

  for (let offset = bytes.length - 22; offset >= minOffset; offset -= 1) {
    if (readUInt32LE(bytes, offset) === 0x06054b50) {
      return offset;
    }
  }

  throw new Error('Could not find the ZIP central directory. The file may be corrupted, ZIP64-only, or not a standard ZIP.');
}

function listCentralDirectoryEntries(bytes) {
  const eocdOffset = findEndOfCentralDirectory(bytes);

  const totalEntries = readUInt16LE(bytes, eocdOffset + 10);
  const centralDirectorySize = readUInt32LE(bytes, eocdOffset + 12);
  const centralDirectoryOffset = readUInt32LE(bytes, eocdOffset + 16);

  if (centralDirectoryOffset <= 0 || centralDirectoryOffset >= bytes.length) {
    throw new Error('ZIP central directory offset is invalid.');
  }

  if (centralDirectoryOffset + centralDirectorySize > bytes.length) {
    throw new Error('ZIP central directory appears truncated.');
  }

  const entries = [];
  let offset = centralDirectoryOffset;

  for (let i = 0; i < totalEntries; i += 1) {
    const signature = readUInt32LE(bytes, offset);

    if (signature !== 0x02014b50) {
      throw new Error(`ZIP central directory entry ${i + 1} is invalid.`);
    }

    const flags = readUInt16LE(bytes, offset + 8);
    const compressionMethod = readUInt16LE(bytes, offset + 10);
    const compressedSize = readUInt32LE(bytes, offset + 20);
    const uncompressedSize = readUInt32LE(bytes, offset + 24);
    const fileNameLength = readUInt16LE(bytes, offset + 28);
    const extraFieldLength = readUInt16LE(bytes, offset + 30);
    const fileCommentLength = readUInt16LE(bytes, offset + 32);
    const localHeaderOffset = readUInt32LE(bytes, offset + 42);

    const fileNameStart = offset + 46;
    const fileNameEnd = fileNameStart + fileNameLength;
    const fileNameBytes = bytes.slice(fileNameStart, fileNameEnd);
    const fileName = decodeFileName(fileNameBytes, Boolean(flags & 0x0800));

    entries.push({
      fileName,
      flags,
      compressionMethod,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
      isDirectory: fileName.endsWith('/'),
      kind: getFileKind(fileName),
    });

    offset = fileNameEnd + extraFieldLength + fileCommentLength;
  }

  return entries;
}

async function inflateRaw(bytes) {
  if (typeof DecompressionStream !== 'function') {
    throw new Error(
      'This browser cannot decompress ZIP files in the app. Try Chrome/Edge, or unzip the supplier file and import the Excel/CSV files separately.'
    );
  }

  const attempts = ['deflate-raw', 'deflate'];
  let lastError = null;

  for (const format of attempts) {
    try {
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format));
      const arrayBuffer = await new Response(stream).arrayBuffer();
      return new Uint8Array(arrayBuffer);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('Could not decompress ZIP entry.');
}

function getCompressedDataFromLocalHeader(bytes, entry) {
  const offset = entry.localHeaderOffset;

  if (offset + 30 > bytes.length || readUInt32LE(bytes, offset) !== 0x04034b50) {
    throw new Error(`Local ZIP header for "${entry.fileName}" is invalid.`);
  }

  const localFileNameLength = readUInt16LE(bytes, offset + 26);
  const localExtraFieldLength = readUInt16LE(bytes, offset + 28);
  const dataStart = offset + 30 + localFileNameLength + localExtraFieldLength;
  const dataEnd = dataStart + entry.compressedSize;

  if (dataEnd > bytes.length) {
    throw new Error(`ZIP entry "${entry.fileName}" appears truncated or invalid.`);
  }

  return bytes.slice(dataStart, dataEnd);
}

export async function extractSupplierFilesFromZip(file) {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    throw new Error('The selected file does not appear to be a ZIP file.');
  }

  const centralEntries = listCentralDirectoryEntries(bytes);
  const supportedEntries = centralEntries.filter((entry) => !entry.isDirectory && entry.kind);

  if (!supportedEntries.length) {
    const fileList = centralEntries
      .filter((entry) => !entry.isDirectory)
      .slice(0, 20)
      .map((entry) => entry.fileName)
      .join(', ');

    throw new Error(
      `No CSV, TXT, XLS, XLSX, or XLSM files were found inside the ZIP. Files seen: ${fileList || 'none'}`
    );
  }

  const extractedEntries = [];

  for (const entry of supportedEntries) {
    const compressedData = getCompressedDataFromLocalHeader(bytes, entry);
    let extracted;

    if (entry.compressionMethod === 0) {
      extracted = compressedData;
    } else if (entry.compressionMethod === 8) {
      extracted = await inflateRaw(compressedData);
    } else {
      throw new Error(`ZIP entry "${entry.fileName}" uses unsupported compression method ${entry.compressionMethod}.`);
    }

    if (extracted?.length) {
      const arrayBufferCopy = extracted.buffer.slice(
        extracted.byteOffset,
        extracted.byteOffset + extracted.byteLength
      );

      extractedEntries.push({
        fileName: entry.fileName,
        kind: entry.kind,
        size: extracted.length || entry.uncompressedSize,
        text: entry.kind === 'csv' || entry.kind === 'txt' ? decodeText(extracted) : '',
        arrayBuffer: arrayBufferCopy,
      });
    }
  }

  if (!extractedEntries.length) {
    throw new Error('Supported files were found in the ZIP, but none could be extracted.');
  }

  return extractedEntries;
}

// Backward-compatible alias used by earlier builds.
export async function extractCsvFilesFromZip(file) {
  return extractSupplierFilesFromZip(file);
}
