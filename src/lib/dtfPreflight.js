// Browser-only DTF preparation helpers. These do not upload customer artwork.
export const DTF_DPI = 300;

export function validatePrintDimensions(width, height, dpi = DTF_DPI) {
  const w = Number(width), h = Number(height);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w < 0.25 || h < 0.25 || w > 20 || h > 20) {
    throw new Error('Choose print dimensions between 0.25 and 20 inches.');
  }
  const pxW = Math.round(w * dpi), pxH = Math.round(h * dpi);
  if (pxW * pxH > 24000000) throw new Error('Output exceeds the 24-megapixel browser processing limit. Reduce the output size.');
  return { width: pxW, height: pxH };
}

export function sourcePreflight(sourceWidth, sourceHeight, targetWidth, targetHeight) {
  const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
  return {
    scale,
    needsUpscale: scale > 1.01,
    effectiveDpi: Math.round(DTF_DPI / scale),
    sourceWidth,
    sourceHeight,
  };
}

// Only edge-connected white pixels are removed, preserving enclosed white graphics.
// RGB brightness threshold must be selected explicitly by the operator.
export function removeEdgeConnectedWhite(data, width, height, cutoff = 245) {
  if (data.length !== width * height * 4) throw new Error('Invalid pixel data');
  if (!(cutoff >= 200 && cutoff <= 255)) throw new Error('Invalid removal threshold');
  const count = width * height;
  const seen = new Uint8Array(count);
  const queue = new Int32Array(count);
  let head = 0, tail = 0, removed = 0;
  function visit(x, y) {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const id = y * width + x;
    if (seen[id]) return;
    seen[id] = 1;
    const i = id * 4;
    const min = Math.min(data[i], data[i + 1], data[i + 2]);
    const max = Math.max(data[i], data[i + 1], data[i + 2]);
    if (data[i + 3] === 0 || (min >= cutoff && max - min <= 25)) queue[tail++] = id;
  }
  for (let x = 0; x < width; x++) { visit(x, 0); visit(x, height - 1); }
  for (let y = 0; y < height; y++) { visit(0, y); visit(width - 1, y); }
  while (head < tail) {
    const id = queue[head++], i = id * 4;
    if (data[i + 3] !== 0) { data[i + 3] = 0; removed++; }
    const x = id % width, y = Math.floor(id / width);
    visit(x - 1, y); visit(x + 1, y); visit(x, y - 1); visit(x, y + 1);
  }
  return removed;
}

export function alphaBounds(data, width, height) {
  let left = width, right = -1, top = height, bottom = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (data[(y * width + x) * 4 + 3] > 3) {
      left = Math.min(x,left); right = Math.max(x,right);
      top = Math.min(y,top); bottom = Math.max(y,bottom);
    }
  }
  if (right < left) return null;
  return { x:left, y:top, width:right - left + 1, height:bottom - top + 1 };
}
function crc32(bytes, start, end) {
  let crc = -1;
  for (let i = start; i < end; i++) {
    crc ^= bytes[i];
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ -1) >>> 0;
}
export function setPngDpi(bytes, dpi = DTF_DPI) {
  const sig = [137,80,78,71,13,10,26,10];
  if (sig.some((v, i) => bytes[i] !== v)) throw new Error('Expected a PNG output');
  if (bytes[12] !== 73 || bytes[13] !== 72 || bytes[14] !== 68 || bytes[15] !== 82) throw new Error('Invalid PNG header');
  const headerLength = new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(8);
  const afterIhdr = 8 + 12 + headerLength;
  const chunk = new Uint8Array(21);
  const view = new DataView(chunk.buffer);
  view.setUint32(0,9);
  chunk.set([112,72,89,115],4); // pHYs
  const ppm = Math.round(dpi / 0.0254);
  view.setUint32(8,ppm); view.setUint32(12,ppm);
  chunk[16] = 1;
  view.setUint32(17,crc32(chunk,4,17));
  const merged = new Uint8Array(bytes.length + chunk.length);
  merged.set(bytes.slice(0,afterIhdr)); merged.set(chunk,afterIhdr); merged.set(bytes.slice(afterIhdr),afterIhdr+chunk.length);
  return merged;
}
