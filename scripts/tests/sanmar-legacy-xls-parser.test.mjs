import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extractWorkbookStream,
  parseBiffWorkbookRows,
  parseSanMarLegacyXlsRows,
} from '../../netlify/functions/_shared/sanmarLegacyXlsParser.js';

const END = 0xfffffffe;
const FREE = 0xffffffff;
const FAT = 0xfffffffd;

function record(id, payload = Buffer.alloc(0)) {
  const header = Buffer.alloc(4);
  header.writeUInt16LE(id, 0);
  header.writeUInt16LE(payload.length, 2);
  return Buffer.concat([header, payload]);
}

function bof(type) {
  const payload = Buffer.alloc(16);
  payload.writeUInt16LE(0x0600, 0);
  payload.writeUInt16LE(type, 2);
  return record(0x0809, payload);
}

function unicodeString(value) {
  const text = Buffer.from(value, 'latin1');
  const out = Buffer.alloc(3 + text.length);
  out.writeUInt16LE(text.length, 0);
  out[2] = 0;
  text.copy(out, 3);
  return out;
}

function sst(strings) {
  const head = Buffer.alloc(8);
  head.writeUInt32LE(strings.length, 0);
  head.writeUInt32LE(strings.length, 4);
  return record(0x00fc, Buffer.concat([head, ...strings.map(unicodeString)]));
}

function labelSst(row, col, index) {
  const payload = Buffer.alloc(10);
  payload.writeUInt16LE(row, 0);
  payload.writeUInt16LE(col, 2);
  payload.writeUInt16LE(0, 4);
  payload.writeUInt32LE(index, 6);
  return record(0x00fd, payload);
}

function numberCell(row, col, value) {
  const payload = Buffer.alloc(14);
  payload.writeUInt16LE(row, 0);
  payload.writeUInt16LE(col, 2);
  payload.writeUInt16LE(0, 4);
  payload.writeDoubleLE(value, 6);
  return record(0x0203, payload);
}

function syntheticWorkbookStream() {
  const strings = ['STYLE:', 'COLOR:', 'SIZE:', 'PIECES:', 'PRICE:', 'AMOUNT:', '18500', 'Black', 'M'];
  const globals = [bof(0x0005), sst(strings), record(0x000a)];
  const cells = [
    labelSst(0, 0, 0), labelSst(0, 1, 1), labelSst(0, 2, 2),
    labelSst(0, 3, 3), labelSst(0, 4, 4), labelSst(0, 5, 5),
    labelSst(1, 0, 6), labelSst(1, 1, 7), labelSst(1, 2, 8),
    numberCell(1, 3, 2), numberCell(1, 4, 9.8), numberCell(1, 5, 19.6),
  ];
  return Buffer.concat([...globals, bof(0x0010), ...cells, record(0x000a)]);
}

function directoryEntry(name, type, startSector, size) {
  const out = Buffer.alloc(128);
  const nameBytes = Buffer.from(`${name}\0`, 'utf16le');
  nameBytes.copy(out, 0, 0, Math.min(nameBytes.length, 64));
  out.writeUInt16LE(Math.min(nameBytes.length, 64), 64);
  out[66] = type;
  out[67] = 1;
  out.writeUInt32LE(FREE, 68);
  out.writeUInt32LE(FREE, 72);
  out.writeUInt32LE(FREE, 76);
  out.writeUInt32LE(startSector >>> 0, 116);
  out.writeUInt32LE(size >>> 0, 120);
  out.writeUInt32LE(0, 124);
  return out;
}

function syntheticOleXls() {
  const biff = syntheticWorkbookStream();
  const workbookSize = 4097;
  const workbook = Buffer.alloc(workbookSize);
  biff.copy(workbook);
  const sectorSize = 512;
  const workbookSectors = Math.ceil(workbookSize / sectorSize);
  const totalSectors = 2 + workbookSectors;
  const file = Buffer.alloc(512 + (totalSectors * sectorSize));

  Buffer.from([0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1]).copy(file, 0);
  file.writeUInt16LE(0x003e, 24);
  file.writeUInt16LE(0x0003, 26);
  file.writeUInt16LE(0xfffe, 28);
  file.writeUInt16LE(9, 30);
  file.writeUInt16LE(6, 32);
  file.writeUInt32LE(0, 40);
  file.writeUInt32LE(1, 44);
  file.writeUInt32LE(0, 48);
  file.writeUInt32LE(0, 52);
  file.writeUInt32LE(4096, 56);
  file.writeUInt32LE(END, 60);
  file.writeUInt32LE(0, 64);
  file.writeUInt32LE(END, 68);
  file.writeUInt32LE(0, 72);
  for (let i = 0; i < 109; i += 1) file.writeUInt32LE(FREE, 76 + (i * 4));
  file.writeUInt32LE(1, 76);

  const directory = Buffer.alloc(sectorSize);
  directoryEntry('Root Entry', 5, END, 0).copy(directory, 0);
  directoryEntry('Workbook', 2, 2, workbookSize).copy(directory, 128);
  directory.copy(file, 512);

  const fat = Buffer.alloc(sectorSize, 0xff);
  fat.writeUInt32LE(END, 0 * 4);
  fat.writeUInt32LE(FAT, 1 * 4);
  for (let i = 0; i < workbookSectors; i += 1) {
    const sid = 2 + i;
    fat.writeUInt32LE(i === workbookSectors - 1 ? END : sid + 1, sid * 4);
  }
  fat.copy(file, 512 + sectorSize);

  for (let i = 0; i < workbookSectors; i += 1) {
    const sourceStart = i * sectorSize;
    workbook.subarray(sourceStart, sourceStart + sectorSize)
      .copy(file, 512 + ((2 + i) * sectorSize));
  }
  return file;
}

test('bounded BIFF parser reads SanMar-style cells', () => {
  const rows = parseBiffWorkbookRows(syntheticWorkbookStream());
  assert.deepEqual(rows[0].slice(0, 6), ['STYLE:', 'COLOR:', 'SIZE:', 'PIECES:', 'PRICE:', 'AMOUNT:']);
  assert.deepEqual(rows[1].slice(0, 6), ['18500', 'Black', 'M', 2, 9.8, 19.6]);
});

test('legacy XLS parser reads a bounded compound-file Workbook stream', () => {
  const file = syntheticOleXls();
  const stream = extractWorkbookStream(file);
  assert.ok(stream.length >= 4097);
  const rows = parseSanMarLegacyXlsRows(file);
  assert.equal(rows[1][0], '18500');
  assert.equal(rows[1][3], 2);
});

test('legacy XLS parser rejects non-OLE input', () => {
  assert.throws(() => parseSanMarLegacyXlsRows(Buffer.from('not an xls')), /not an Excel 97-2003 compound file/);
});
