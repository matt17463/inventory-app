async function bitmapFromUrl(url) {
  if (!url) throw new Error('A required mockup image is unavailable.');
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load a mockup image (HTTP ${response.status}).`);
  return createImageBitmap(await response.blob());
}

function captionLines(context, text, maxWidth) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word;
    if (current && context.measureText(candidate).width > maxWidth) {
      lines.push(current);
      current = word;
    } else current = candidate;
  });
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

export async function renderMockupComposite({ blankUrl, artworkUrl, placement, caption = null }) {
  const [blank, artwork] = await Promise.all([bitmapFromUrl(blankUrl), bitmapFromUrl(artworkUrl)]);
  const baseWidth = blank.width;
  const baseHeight = blank.height;
  const captionSize = Math.max(8, Number(caption?.size || 36));
  const captionPadding = Math.max(0, Number(caption?.padding || 32));
  const estimatedCaptionHeight = caption?.text ? captionSize * 2.8 + captionPadding * 2 : 0;

  const canvas = document.createElement('canvas');
  canvas.width = baseWidth;
  canvas.height = baseHeight + Math.round(estimatedCaptionHeight);
  const context = canvas.getContext('2d', { alpha: true });
  if (!context) throw new Error('This browser cannot create the mockup canvas.');

  context.drawImage(blank, 0, 0, baseWidth, baseHeight);

  const overlayWidth = baseWidth * (Number(placement.width_pct || 40) / 100);
  const overlayHeight = overlayWidth * (artwork.height / artwork.width);
  const centerX = baseWidth * (Number(placement.x_pct ?? 50) / 100);
  const centerY = baseHeight * (Number(placement.y_pct ?? 45) / 100);
  const rotation = Number(placement.rotation_degrees || 0) * Math.PI / 180;

  context.save();
  context.translate(centerX, centerY);
  context.rotate(rotation);
  context.globalAlpha = Number(placement.opacity ?? 1);
  const preserveWhiteInk = placement.preserve_white_ink
    ?? placement.perspective_config?.preserve_white_ink
    ?? true;
  // DTF and other opaque decoration methods print white ink. Normal compositing
  // is required to keep those pixels visible; Multiply mathematically removes white.
  context.globalCompositeOperation = preserveWhiteInk ? 'source-over' : (placement.blend_mode || 'source-over');
  const shadow = Number(placement.shadow_strength ?? 0.15);
  context.shadowColor = `rgba(0,0,0,${Math.min(0.6, shadow)})`;
  context.shadowBlur = baseWidth * 0.006 * shadow;
  context.shadowOffsetY = baseHeight * 0.003 * shadow;
  context.drawImage(artwork, -overlayWidth / 2, -overlayHeight / 2, overlayWidth, overlayHeight);
  context.restore();

  if (caption?.text) {
    const top = baseHeight;
    context.fillStyle = caption.background || '#ffffff';
    context.fillRect(0, top, baseWidth, canvas.height - top);
    context.font = `${caption.weight || 600} ${captionSize}px ${caption.font || 'Arial'}`;
    context.fillStyle = caption.color || '#111827';
    context.textBaseline = 'top';
    context.textAlign = caption.alignment || 'center';
    const x = caption.alignment === 'left'
      ? captionPadding
      : caption.alignment === 'right'
        ? baseWidth - captionPadding
        : baseWidth / 2;
    const lines = captionLines(context, caption.text, baseWidth - captionPadding * 2);
    lines.forEach((line, index) => {
      context.fillText(line, x, top + captionPadding + index * captionSize * 1.25);
    });
  }

  blank.close();
  artwork.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve({ blob, width: canvas.width, height: canvas.height });
      else reject(new Error('The mockup could not be exported.'));
    }, 'image/png');
  });
}

export function downloadMockupBlob(blob, fileName = 'mockup.png') {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function imageDimensions(file) {
  if (!file || !String(file.type || '').startsWith('image/')) return { width: null, height: null };
  const bitmap = await createImageBitmap(file);
  const dimensions = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return dimensions;
}

export async function inspectArtworkFile(file) {
  if (!file || !String(file.type || '').startsWith('image/')) {
    return { width: null, height: null, hasTransparency: null, hasOpaqueWhite: null };
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d', { alpha: true, willReadFrequently: true });
  if (!context) {
    const dimensions = { width: bitmap.width, height: bitmap.height, hasTransparency: null, hasOpaqueWhite: null };
    bitmap.close();
    return dimensions;
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let transparentPixels = 0;
  let opaqueWhitePixels = 0;
  for (let index = 0; index < pixels.length; index += 4) {
    const red = pixels[index];
    const green = pixels[index + 1];
    const blue = pixels[index + 2];
    const alpha = pixels[index + 3];
    if (alpha < 250) transparentPixels += 1;
    if (alpha >= 230 && red >= 235 && green >= 235 && blue >= 235) opaqueWhitePixels += 1;
  }
  const result = {
    width: bitmap.width,
    height: bitmap.height,
    hasTransparency: transparentPixels > 0,
    hasOpaqueWhite: opaqueWhitePixels > 0,
    transparencyRatio: pixels.length ? transparentPixels / (pixels.length / 4) : 0,
  };
  bitmap.close();
  return result;
}
