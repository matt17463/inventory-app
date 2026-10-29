/** Transform locally generated RGBA segmentation into alpha pixels. Mutates a copy of image data only. */
export function applyLocalSegmentationAlpha(data) {
  if (!(data instanceof Uint8ClampedArray) || data.length % 4 !== 0) throw new Error('Malformed segmentation pixels.');
  let hasAlpha = false;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] !== 255) { hasAlpha = true; break; }
  }
  const result = new Uint8ClampedArray(data.length);
  let foreground = 0, partial = 0, max = 0;
  for (let i = 0; i < data.length; i += 4) {
    const a = hasAlpha ? data[i+3] : Math.round((data[i] + data[i+1] + data[i+2]) / 3);
    if (a > 127) foreground++;
    if (a > 0 && a < 255) partial++;
    if (a > max) max = a;
    result[i+3] = a;
  }
  if (!max) throw new Error('Local model returned an empty segmentation.');
  return {data:result,foreground,partial,source:hasAlpha?'alpha':'grayscale'};
}
