import { PDFDocument } from 'pdf-lib';

const maxCoverBytes = 15 * 1024 * 1024;

export async function addMarketingFlyerCover(cover, details, title) {
  if (cover.size > maxCoverBytes) throw Error('Choose a flyer PDF smaller than 15 MB.');
  let original;
  try {
    original = await PDFDocument.load(await cover.arrayBuffer(), { updateMetadata: false });
  } catch {
    throw Error('Choose a readable, unencrypted flyer PDF.');
  }
  if (original.getPageCount() !== 1) throw Error('Choose a flyer PDF with exactly one page.');

  const source = original.getPage(0);
  const { x, y, width, height } = source.getCropBox();
  if (source.getRotation().angle % 360 || Math.abs(width - 612) > 0.5 || Math.abs(height - 792) > 0.5) {
    throw Error('Choose a portrait, US Letter flyer PDF (8.5 × 11 inches).');
  }

  const combined = await PDFDocument.create();
  combined.setTitle(title);
  combined.setAuthor('Skilled Crafting');
  const coverArtwork = await combined.embedPage(source, { left: x, bottom: y, right: x + width, top: y + height });
  combined.addPage([width, height]).drawPage(coverArtwork);

  const program = await PDFDocument.load(await details.arrayBuffer());
  const programPages = await combined.copyPages(program, program.getPageIndices());
  programPages.forEach(page => combined.addPage(page));
  return new Blob([await combined.save()], { type: 'application/pdf' });
}
