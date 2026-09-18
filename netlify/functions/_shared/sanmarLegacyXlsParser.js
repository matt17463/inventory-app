const CFB_SIGNATURE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const FREESECT = 0xffffffff;
const ENDOFCHAIN = 0xfffffffe;
const FATSECT = 0xfffffffd;
const DIFSECT = 0xfffffffc;
const MAX_ROWS = 50000;
const MAX_COLS = 128;
const MAX_STREAM_BYTES = 12 * 1024 * 1024;

function fail(message) {
  throw new Error(`Unsupported SanMar XLS file: ${message}`);
}

function u16(buffer, offset) {
  if (offset < 0 || offset + 2 > buffer.length) fail('truncated 16-bit value.');
  return buffer.readUInt16LE(offset);
}

function u32(buffer, offset) {
  if (offset < 0 || offset + 4 > buffer.length) fail('truncated 32-bit value.');
  return buffer.readUInt32LE(offset);
}

function i32(buffer, offset) {
  if (offset < 0 || offset + 4 > buffer.length) fail('truncated 32-bit value.');
  return buffer.readInt32LE(offset);
}

function sectorOffset(sectorId, sectorSize, fileLength) {
  if (!Number.isInteger(sectorId) || sectorId < 0) fail('invalid compound-file sector id.');
  const offset = (sectorId + 1) * sectorSize;
  if (!Number.isSafeInteger(offset) || offset + sectorSize > fileLength) fail('compound-file sector points outside the file.');
  return offset;
}

function readSector(file, sectorId, sectorSize) {
  const offset = sectorOffset(sectorId, sectorSize, file.length);
  return file.subarray(offset, offset + sectorSize);
}

function collectDifat(file, sectorSize, firstDifatSector, difatSectorCount) {
  const ids = [];
  for (let i = 0; i < 109; i += 1) {
    const id = u32(file, 76 + (i * 4));
    if (id !== FREESECT) ids.push(id);
  }

  let next = firstDifatSector;
  const seen = new Set();
  const entriesPerDifat = (sectorSize / 4) - 1;
  for (let n = 0; n < difatSectorCount; n += 1) {
    if (next === ENDOFCHAIN || next === FREESECT) break;
    if (seen.has(next)) fail('compound-file DIFAT contains a cycle.');
    seen.add(next);
    const sector = readSector(file, next, sectorSize);
    for (let i = 0; i < entriesPerDifat; i += 1) {
      const id = u32(sector, i * 4);
      if (id !== FREESECT) ids.push(id);
    }
    next = u32(sector, sectorSize - 4);
  }
  return ids;
}

function buildFat(file, sectorSize, fatSectorIds, expectedFatSectors) {
  if (fatSectorIds.length < expectedFatSectors) fail('compound-file FAT is incomplete.');
  const fat = [];
  const entriesPerSector = sectorSize / 4;
  for (let n = 0; n < expectedFatSectors; n += 1) {
    const id = fatSectorIds[n];
    if ([FREESECT, ENDOFCHAIN, FATSECT, DIFSECT].includes(id)) fail('invalid FAT sector reference.');
    const sector = readSector(file, id, sectorSize);
    for (let i = 0; i < entriesPerSector; i += 1) fat.push(u32(sector, i * 4));
  }
  return fat;
}

function readRegularChain(file, startSector, fat, sectorSize, byteLimit = MAX_STREAM_BYTES) {
  if (startSector === ENDOFCHAIN || startSector === FREESECT) return Buffer.alloc(0);
  const chunks = [];
  const seen = new Set();
  let current = startSector;
  let total = 0;
  const maxSectors = Math.ceil(byteLimit / sectorSize) + 2;

  while (current !== ENDOFCHAIN) {
    if (!Number.isInteger(current) || current < 0 || current >= fat.length) fail('stream FAT chain points outside the FAT.');
    if (seen.has(current)) fail('stream FAT chain contains a cycle.');
    if (seen.size >= maxSectors) fail('stream exceeds the permitted size.');
    seen.add(current);
    const sector = readSector(file, current, sectorSize);
    chunks.push(sector);
    total += sector.length;
    if (total > byteLimit + sectorSize) fail('stream exceeds the permitted size.');
    current = fat[current];
    if ([FREESECT, FATSECT, DIFSECT].includes(current)) fail('stream FAT chain ended on an invalid marker.');
  }
  return Buffer.concat(chunks);
}

function parseDirectory(directoryBuffer) {
  const entries = [];
  for (let offset = 0; offset + 128 <= directoryBuffer.length; offset += 128) {
    const entry = directoryBuffer.subarray(offset, offset + 128);
    const nameBytes = u16(entry, 64);
    const objectType = entry[66];
    if (!objectType || nameBytes < 2 || nameBytes > 64) continue;
    const name = entry.subarray(0, nameBytes - 2).toString('utf16le');
    const startSector = u32(entry, 116);
    const sizeLow = u32(entry, 120);
    const sizeHigh = u32(entry, 124);
    const size = sizeLow + (sizeHigh * 0x100000000);
    if (!Number.isSafeInteger(size) || size < 0 || size > MAX_STREAM_BYTES) {
      if (objectType === 2) fail('workbook stream is too large.');
    }
    entries.push({ name, objectType, startSector, size });
  }
  return entries;
}

function readMiniFat(file, firstMiniFatSector, miniFatSectorCount, fat, sectorSize) {
  if (!miniFatSectorCount || firstMiniFatSector === ENDOFCHAIN || firstMiniFatSector === FREESECT) return [];
  const bytes = readRegularChain(file, firstMiniFatSector, fat, sectorSize, Math.min(MAX_STREAM_BYTES, miniFatSectorCount * sectorSize));
  const maxBytes = miniFatSectorCount * sectorSize;
  const usable = bytes.subarray(0, Math.min(bytes.length, maxBytes));
  const miniFat = [];
  for (let offset = 0; offset + 4 <= usable.length; offset += 4) miniFat.push(u32(usable, offset));
  return miniFat;
}

function readMiniChain(rootMiniStream, startSector, miniFat, miniSectorSize, size) {
  const chunks = [];
  const seen = new Set();
  let current = startSector;
  let total = 0;
  while (current !== ENDOFCHAIN && total < size) {
    if (!Number.isInteger(current) || current < 0 || current >= miniFat.length) fail('mini-stream chain points outside the MiniFAT.');
    if (seen.has(current)) fail('mini-stream chain contains a cycle.');
    seen.add(current);
    const offset = current * miniSectorSize;
    if (offset + miniSectorSize > rootMiniStream.length) fail('mini-stream sector points outside the root mini stream.');
    chunks.push(rootMiniStream.subarray(offset, offset + miniSectorSize));
    total += miniSectorSize;
    if (total > MAX_STREAM_BYTES) fail('mini stream exceeds the permitted size.');
    current = miniFat[current];
    if ([FREESECT, FATSECT, DIFSECT].includes(current)) fail('mini-stream chain ended on an invalid marker.');
  }
  return Buffer.concat(chunks).subarray(0, size);
}

export function extractWorkbookStream(fileBytes) {
  const file = Buffer.isBuffer(fileBytes) ? fileBytes : Buffer.from(fileBytes || []);
  if (file.length < 512 || !file.subarray(0, 8).equals(CFB_SIGNATURE)) fail('not an Excel 97-2003 compound file.');
  const byteOrder = u16(file, 28);
  const sectorShift = u16(file, 30);
  const miniSectorShift = u16(file, 32);
  if (byteOrder !== 0xfffe) fail('unexpected compound-file byte order.');
  if (![9, 12].includes(sectorShift)) fail('unexpected compound-file sector size.');
  if (miniSectorShift !== 6) fail('unexpected compound-file mini-sector size.');

  const sectorSize = 2 ** sectorShift;
  const miniSectorSize = 2 ** miniSectorShift;
  const fatSectorCount = u32(file, 44);
  const firstDirectorySector = u32(file, 48);
  const miniStreamCutoff = u32(file, 56);
  const firstMiniFatSector = u32(file, 60);
  const miniFatSectorCount = u32(file, 64);
  const firstDifatSector = u32(file, 68);
  const difatSectorCount = u32(file, 72);

  if (sectorSize > file.length) fail('invalid compound-file sector size.');
  const maxPhysicalSectors = Math.floor(file.length / sectorSize);
  if (fatSectorCount > maxPhysicalSectors || difatSectorCount > maxPhysicalSectors || miniFatSectorCount > maxPhysicalSectors) {
    fail('compound-file allocation counts exceed the file size.');
  }

  const difat = collectDifat(file, sectorSize, firstDifatSector, difatSectorCount);
  const fat = buildFat(file, sectorSize, difat, fatSectorCount);
  const directoryBytes = readRegularChain(file, firstDirectorySector, fat, sectorSize);
  const directory = parseDirectory(directoryBytes);
  const workbook = directory.find((entry) => entry.objectType === 2 && /^(Workbook|Book)$/i.test(entry.name));
  if (!workbook) fail('Workbook stream was not found.');
  if (workbook.size <= 0 || workbook.size > MAX_STREAM_BYTES) fail('Workbook stream has an invalid size.');

  if (workbook.size >= miniStreamCutoff) {
    return readRegularChain(file, workbook.startSector, fat, sectorSize).subarray(0, workbook.size);
  }

  const root = directory.find((entry) => entry.objectType === 5);
  if (!root) fail('root mini stream was not found.');
  const rootMiniStream = readRegularChain(file, root.startSector, fat, sectorSize).subarray(0, root.size);
  const miniFat = readMiniFat(file, firstMiniFatSector, miniFatSectorCount, fat, sectorSize);
  if (!miniFat.length) fail('MiniFAT was not found for the Workbook stream.');
  return readMiniChain(rootMiniStream, workbook.startSector, miniFat, miniSectorSize, workbook.size);
}

function parseRecords(stream) {
  const records = [];
  let offset = 0;
  while (offset + 4 <= stream.length) {
    const id = u16(stream, offset);
    const length = u16(stream, offset + 2);
    const start = offset + 4;
    const end = start + length;
    if (end > stream.length) fail('BIFF record extends past the Workbook stream.');
    records.push({ id, data: stream.subarray(start, end) });
    offset = end;
  }
  return records;
}

function decodeSimpleUnicodeString(buffer, offset = 0, charCountBytes = 2) {
  let cursor = offset;
  const charCount = charCountBytes === 1 ? buffer[cursor++] : u16(buffer, cursor);
  if (charCountBytes === 2) cursor += 2;
  if (cursor >= buffer.length) fail('truncated BIFF string options.');
  const options = buffer[cursor++];
  const is16 = Boolean(options & 0x01);
  const hasExt = Boolean(options & 0x04);
  const hasRich = Boolean(options & 0x08);
  let richRuns = 0;
  let extBytes = 0;
  if (hasRich) {
    richRuns = u16(buffer, cursor);
    cursor += 2;
  }
  if (hasExt) {
    extBytes = u32(buffer, cursor);
    cursor += 4;
  }
  const charBytes = charCount * (is16 ? 2 : 1);
  if (cursor + charBytes > buffer.length) fail('continued BIFF shared strings are not supported for this SanMar format.');
  const text = is16
    ? buffer.subarray(cursor, cursor + charBytes).toString('utf16le')
    : buffer.subarray(cursor, cursor + charBytes).toString('latin1');
  cursor += charBytes;
  const extras = (richRuns * 4) + extBytes;
  if (cursor + extras > buffer.length) fail('truncated BIFF rich-text metadata.');
  cursor += extras;
  return { text, nextOffset: cursor };
}

function parseSst(recordData) {
  if (recordData.length < 8) fail('shared-string table is truncated.');
  const uniqueCount = u32(recordData, 4);
  if (uniqueCount > 200000) fail('shared-string table is unreasonably large.');
  const strings = [];
  let offset = 8;
  for (let i = 0; i < uniqueCount; i += 1) {
    const parsed = decodeSimpleUnicodeString(recordData, offset, 2);
    strings.push(parsed.text);
    offset = parsed.nextOffset;
  }
  return strings;
}

function decodeRk(raw) {
  const isInteger = Boolean(raw & 0x02);
  const divide100 = Boolean(raw & 0x01);
  let value;
  if (isInteger) {
    value = (raw | 0) >> 2;
  } else {
    const bytes = Buffer.alloc(8);
    bytes.writeUInt32LE(0, 0);
    bytes.writeUInt32LE(raw & 0xfffffffc, 4);
    value = bytes.readDoubleLE(0);
  }
  return divide100 ? value / 100 : value;
}

function setCell(cells, row, col, value) {
  if (row < 0 || row >= MAX_ROWS || col < 0 || col >= MAX_COLS) fail('worksheet dimensions exceed the permitted SanMar import bounds.');
  if (!cells.has(row)) cells.set(row, new Map());
  cells.get(row).set(col, value);
}

export function parseBiffWorkbookRows(workbookStream) {
  const stream = Buffer.isBuffer(workbookStream) ? workbookStream : Buffer.from(workbookStream || []);
  const records = parseRecords(stream);
  let sharedStrings = [];
  for (const record of records) {
    if (record.id === 0x00fc) {
      sharedStrings = parseSst(record.data);
      break;
    }
  }

  const cells = new Map();
  let inWorksheet = false;
  let foundWorksheet = false;
  for (const record of records) {
    if (record.id === 0x0809 && record.data.length >= 4) {
      const version = u16(record.data, 0);
      const type = u16(record.data, 2);
      inWorksheet = version === 0x0600 && type === 0x0010;
      if (inWorksheet) foundWorksheet = true;
      continue;
    }
    if (record.id === 0x000a) {
      if (inWorksheet) break;
      continue;
    }
    if (!inWorksheet) continue;

    if (record.id === 0x00fd && record.data.length >= 10) {
      const row = u16(record.data, 0);
      const col = u16(record.data, 2);
      const sstIndex = u32(record.data, 6);
      if (sstIndex >= sharedStrings.length) fail('worksheet references a missing shared string.');
      setCell(cells, row, col, sharedStrings[sstIndex]);
    } else if (record.id === 0x0203 && record.data.length >= 14) {
      const row = u16(record.data, 0);
      const col = u16(record.data, 2);
      setCell(cells, row, col, record.data.readDoubleLE(6));
    } else if (record.id === 0x027e && record.data.length >= 10) {
      const row = u16(record.data, 0);
      const col = u16(record.data, 2);
      setCell(cells, row, col, decodeRk(u32(record.data, 6)));
    } else if (record.id === 0x00bd && record.data.length >= 6) {
      const row = u16(record.data, 0);
      const firstCol = u16(record.data, 2);
      const lastCol = u16(record.data, record.data.length - 2);
      const count = lastCol - firstCol + 1;
      if (count < 0 || 4 + (count * 6) + 2 !== record.data.length) fail('invalid MULRK record.');
      for (let i = 0; i < count; i += 1) {
        const rkOffset = 4 + (i * 6) + 2;
        setCell(cells, row, firstCol + i, decodeRk(u32(record.data, rkOffset)));
      }
    } else if (record.id === 0x0204 && record.data.length >= 8) {
      const row = u16(record.data, 0);
      const col = u16(record.data, 2);
      const parsed = decodeSimpleUnicodeString(record.data, 6, 2);
      setCell(cells, row, col, parsed.text);
    }
  }

  if (!foundWorksheet) fail('BIFF8 worksheet was not found.');
  if (!cells.size) fail('worksheet did not contain readable cells.');
  const maxRow = Math.max(...cells.keys());
  let maxCol = 0;
  for (const rowCells of cells.values()) {
    for (const col of rowCells.keys()) maxCol = Math.max(maxCol, col);
  }
  const rows = [];
  for (let row = 0; row <= maxRow; row += 1) {
    const values = Array(maxCol + 1).fill('');
    const rowCells = cells.get(row);
    if (rowCells) {
      for (const [col, value] of rowCells.entries()) values[col] = value;
    }
    rows.push(values);
  }
  return rows;
}

export function parseSanMarLegacyXlsRows(fileBytes) {
  return parseBiffWorkbookRows(extractWorkbookStream(fileBytes));
}
