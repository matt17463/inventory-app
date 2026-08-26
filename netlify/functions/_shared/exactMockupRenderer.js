import sharp from 'sharp';

function number(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, minimum), maximum) : fallback;
}

function xml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}

function color(value, fallback) {
  const cleaned = String(value || '').trim();
  return /^#[0-9a-f]{6}$/i.test(cleaned) ? cleaned : fallback;
}

function font(value) {
  const allowed = new Map([
    ['arial', 'Arial, sans-serif'], ['arial black', 'Arial Black, Arial, sans-serif'],
    ['georgia', 'Georgia, serif'], ['impact', 'Impact, sans-serif'],
    ['montserrat', 'Montserrat, Arial, sans-serif'], ['open sans', 'Open Sans, Arial, sans-serif'],
    ['roboto', 'Roboto, Arial, sans-serif'], ['times new roman', 'Times New Roman, serif'],
  ]);
  return allowed.get(String(value || '').trim().toLowerCase()) || 'Arial, sans-serif';
}

function captionLines(text, fontSize, maxWidth) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  const estimated = (value) => value.length * fontSize * 0.58;
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && estimated(candidate) > maxWidth) {
      lines.push(current);
      current = word;
    } else current = candidate;
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

function captionSvg(width, height, caption) {
  const size = number(caption?.size, 36, 8, 240);
  const padding = number(caption?.padding, 32, 0, 300);
  const alignment = ['left', 'center', 'right'].includes(caption?.alignment) ? caption.alignment : 'center';
  const anchor = alignment === 'left' ? 'start' : alignment === 'right' ? 'end' : 'middle';
  const x = alignment === 'left' ? padding : alignment === 'right' ? width - padding : width / 2;
  const lines = captionLines(caption?.text, size, Math.max(1, width - padding * 2));
  const lineHeight = size * 1.25;
  const text = lines.map((line, index) => `<text x="${x}" y="${padding + size + index * lineHeight}" text-anchor="${anchor}" font-family="${xml(font(caption?.font))}" font-size="${size}" font-weight="${number(caption?.weight, 600, 100, 900)}" fill="${color(caption?.color, '#111827')}">${xml(line)}</text>`).join('');
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="${color(caption?.background, '#ffffff')}"/>${text}</svg>`);
}

export async function renderExactMockup({ blankBytes, artworkBytes, placement, caption = null }) {
  const blank = await sharp(blankBytes, { limitInputPixels: 120_000_000 }).rotate().png().toBuffer({ resolveWithObject: true });
  const artwork = await sharp(artworkBytes, { limitInputPixels: 120_000_000 }).rotate().png().toBuffer({ resolveWithObject: true });
  const baseWidth = blank.info.width;
  const baseHeight = blank.info.height;
  if (!baseWidth || !baseHeight || !artwork.info.width || !artwork.info.height) throw new Error('The blank or artwork image has invalid dimensions.');

  const captionSize = number(caption?.size, 36, 8, 240);
  const captionPadding = number(caption?.padding, 32, 0, 300);
  const captionHeight = caption?.text ? Math.round(captionSize * 2.8 + captionPadding * 2) : 0;
  const overlayWidth = Math.max(1, Math.round(baseWidth * number(placement?.width_pct, 40, 1, 200) / 100));
  const overlayHeight = Math.max(1, Math.round(overlayWidth * artwork.info.height / artwork.info.width));
  const centerX = baseWidth * number(placement?.x_pct, 50, -100, 200) / 100;
  const centerY = baseHeight * number(placement?.y_pct, 45, -100, 200) / 100;
  const opacity = number(placement?.opacity, 1, 0, 1);
  const rotation = number(placement?.rotation_degrees, 0, -360, 360);
  const preserveWhite = placement?.perspective_config?.preserve_white_ink ?? true;
  const requestedBlend = String(placement?.blend_mode || 'source-over');
  const blend = preserveWhite ? 'over' : ({ multiply: 'multiply', screen: 'screen', overlay: 'overlay' }[requestedBlend] || 'over');
  const shadow = number(placement?.shadow_strength, 0.15, 0, 1);
  const shadowDx = Math.round(baseWidth * 0.003 * shadow);
  const shadowBlur = Math.max(0.1, baseWidth * 0.006 * shadow);
  const artworkData = artwork.data.toString('base64');
  const overlay = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${baseWidth}" height="${baseHeight}"><defs><filter id="s" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="${shadowDx}" dy="${shadowDx}" stdDeviation="${shadowBlur}" flood-color="#000000" flood-opacity="${Math.min(0.6, shadow)}"/></filter></defs><image href="data:image/png;base64,${artworkData}" x="${centerX - overlayWidth / 2}" y="${centerY - overlayHeight / 2}" width="${overlayWidth}" height="${overlayHeight}" opacity="${opacity}" transform="rotate(${rotation} ${centerX} ${centerY})" filter="url(#s)"/></svg>`);

  const composites = [
    { input: blank.data, top: 0, left: 0, blend: 'over' },
    { input: overlay, top: 0, left: 0, blend },
  ];
  if (captionHeight) composites.push({ input: captionSvg(baseWidth, captionHeight, caption), top: baseHeight, left: 0, blend: 'over' });
  const data = await sharp({ create: { width: baseWidth, height: baseHeight + captionHeight, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(composites).png({ compressionLevel: 9 }).toBuffer();
  return { data, width: baseWidth, height: baseHeight + captionHeight };
}
