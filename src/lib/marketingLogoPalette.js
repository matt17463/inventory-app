/** Suggest colors from an uploaded logo locally. Suggestions are never treated as approved brand colors. */
export async function suggestLogoColors(dataUrl) {
  if (!/^data:image\/(png|jpeg|webp);base64,/i.test(dataUrl || '')) throw Error('Upload a PNG, JPEG or WebP logo.');
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 96 / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw Error('Unable to analyze logo colors.');
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const counts = new Map();
    for (let i=0;i<pixels.length;i+=4) {
      if (pixels[i+3] < 200) continue;
      const rgb=[pixels[i],pixels[i+1],pixels[i+2]];
      const max=Math.max(...rgb), min=Math.min(...rgb);
      if (max > 242 && max-min < 14) continue;
      if (max < 22 && max-min < 14) continue;
      const bins=rgb.map(v=>Math.min(255,Math.round(v/32)*32));
      const hex='#'+bins.map(v=>v.toString(16).padStart(2,'0')).join('').toUpperCase();
      counts.set(hex,(counts.get(hex)||0)+1);
    }
    return [...counts].sort((a,b)=>b[1]-a[1]).slice(0,5).map(([hex])=>hex);
  } finally { bitmap.close(); }
}
