
/**
 * Browser-side ZIP supplier file extractor.
 *
 * Purpose:
 * - Let you manually download a supplier ZIP file and upload it into the app.
 * - Avoids server-side 403 blocking from supplier/CDN downloads.
 * - Extracts CSV/TXT/XLS/XLSX/XLSM files from common ZIP archives.
 *
 * Supports:
 * - ZIP compression method 0: stored
 * - ZIP compression method 8: deflate, using browser DecompressionStream
 *
 * Limitations:
 * - Does not support password-protected ZIPs.
 * - Does not support ZIP entries using data descriptors.
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

export async function extractSupplierFilesFromZip(file) {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    throw new Error('The selected file does not appear to be a ZIP file.');
  }

  const entries = [];
  let offset = 0;

  while (offset + 30 <= bytes.length) {
    const signature = readUInt32LE(bytes, offset);

    if (signature !== 0x04034b50) break;

    const flags = readUInt16LE(bytes, offset + 6);
    const compressionMethod = readUInt16LE(bytes, offset + 8);
    const compressedSize = readUInt32LE(bytes, offset + 18);
    const fileNameLength = readUInt16LE(bytes, offset + 26);
    const extraFieldLength = readUInt16LE(bytes, offset + 28);

    const fileNameStart = offset + 30;
    const fileNameEnd = fileNameStart + fileNameLength;
    const fileName = decodeText(bytes.slice(fileNameStart, fileNameEnd));

    const dataStart = fileNameEnd + extraFieldLength;

    if (flags & 0x08) {
      throw new Error(
        `ZIP entry "${fileName}" uses a ZIP format that cannot be parsed safely in the browser importer. Unzip the file manually and import the Excel/CSV files separately.`
      );
    }

    const dataEnd = dataStart + compressedSize;

    if (dataEnd > bytes.length) {
      throw new Error(`ZIP entry "${fileName}" appears truncated or invalid.`);
    }

    const isDirectory = fileName.endsWith('/');
    const kind = getFileKind(fileName);

    if (!isDirectory && kind) {
      const compressedData = bytes.slice(dataStart, dataEnd);
      let extracted;

      if (compressionMethod === 0) {
        extracted = compressedData;
      } else if (compressionMethod === 8) {
        extracted = await inflateRaw(compressedData);
      } else {
        throw new Error(`ZIP entry "${fileName}" uses unsupported compression method ${compressionMethod}.`);
      }

      if (extracted?.length) {
        const arrayBufferCopy = extracted.buffer.slice(
          extracted.byteOffset,
          extracted.byteOffset + extracted.byteLength
        );

        entries.push({
          fileName,
          kind,
          size: extracted.length,
          text: kind === 'csv' || kind === 'txt' ? decodeText(extracted) : '',
          arrayBuffer: arrayBufferCopy,
        });
      }
    }

    offset = dataEnd;
  }

  if (!entries.length) {
    throw new Error('No CSV, TXT, XLS, XLSX, or XLSM files were found inside the ZIP.');
  }

  return entries;
}

// Backward-compatible alias used by earlier builds.
export async function extractCsvFilesFromZip(file) {
  return extractSupplierFilesFromZip(file);
}
