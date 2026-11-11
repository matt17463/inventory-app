import { Document, ExternalHyperlink, Footer, HeadingLevel, ImageRun, Packer, PageNumber, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx';
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_EXPORT_IMAGE_BYTES = 40 * 1024 * 1024;

async function prepareImages(model, resolveImage) {
  const images = new Map();
  let totalBytes = 0;
  for (const block of model.blocks) {
    if (block.type !== 'image' || images.has(block.source)) continue;
    const source = await resolveImage(block.source);
    if (!(source instanceof Blob) || !/^image\/(png|jpeg|webp)$/.test(source.type) ||
        source.size > MAX_IMAGE_BYTES || totalBytes + source.size > MAX_EXPORT_IMAGE_BYTES) {
      throw Error('Document images must be PNG, JPEG or WebP and fit within the export size limit.');
    }
    totalBytes += source.size;
    const bitmap = await createImageBitmap(source);
    try {
      const canvas = globalThis.document.createElement('canvas');
      const scale = Math.min(1, 1000 / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d');
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw Error('Could not render a document image.');
      images.set(block.source, { bytes: new Uint8Array(await blob.arrayBuffer()), width: canvas.width, height: canvas.height });
    } finally {
      bitmap.close();
    }
  }
  return images;
}

function imageSize(image, thumbnail) {
  const scale = Math.min((thumbnail ? 120 : 390) / image.width, (thumbnail ? 85 : 225) / image.height);
  return { width: Math.max(1, Math.round(image.width * scale)), height: Math.max(1, Math.round(image.height * scale)) };
}

const footer = 'Skilled Crafting  |  skilledcrafting.com';
const rgbHex = hex => /^#[0-9a-f]{6}$/i.test(hex || '') ? [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)) : [36,54,74];
const status = model => model.approved ? '' : 'DRAFT — FOR INTERNAL REVIEW';
const value = block => block.type === 'field' ? block.label + ': ' + block.value : block.value || block.label;

function word(model, images) {
  const brochure = model.schoolBrochure;
  const children = [
    new Paragraph({ children:[new TextRun({text:'SKILLED CRAFTING  /  CLIENT MARKETING',bold:true,color:(model.headingColor || model.accent).slice(1),size:18})],spacing:{after:180} }),
    new Paragraph({ text: model.title, heading: HeadingLevel.TITLE }),
    new Paragraph({ text: model.organization, heading: HeadingLevel.SUBTITLE, spacing: brochure ? { after: 230 } : undefined }),
  ];
  if (status(model)) children.push(new Paragraph({ spacing: brochure ? { after: 260 } : undefined, children: [new TextRun({ text: status(model), bold: true, color: 'A82135' })] }));
  for (const block of model.blocks) {
    if (block.type === 'image') {
      const image = images.get(block.source);
      children.push(new Paragraph({ keepNext: true, children: [new ImageRun({
        type: 'png', data: image.bytes, transformation: imageSize(image, block.thumbnail),
        altText: { title: block.label, description: block.label, name: block.label },
      })] }));
      children.push(new Paragraph({ children: [new TextRun({ text: block.label, italics: true, size: 18 })], spacing: { after: 130 } }));
    } else if (block.type === 'table') {
      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [block.columns, ...block.rows].map((row, index) => new TableRow({
          tableHeader: !index, cantSplit: true,
          children: row.map(text => new TableCell({
            ...(index ? {} : { shading: { fill: 'E7EDF4' } }),
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
            children: [new Paragraph({ children: [new TextRun({ text, bold: !index })] })],
          })),
        })),
      }));
    } else if (block.type === 'link') {
      children.push(new Paragraph({ children: [new ExternalHyperlink({
        link: block.url, children: [new TextRun({ text: block.label, style: 'Hyperlink' })],
      })] }));
    } else {
      const heading = block.type === 'heading' ? HeadingLevel.HEADING_1 :
        block.type === 'subheading' ? HeadingLevel.HEADING_2 : undefined;
      const lines = value(block).split(/\r?\n/);
      lines.forEach(line => children.push(new Paragraph({
        heading, pageBreakBefore: block.pageBreakBefore, keepNext: Boolean(heading), spacing: brochure ? { after: heading ? 110 : 235, before: heading ? 185 : 0, line: 320 } : { after: 120 },
        children: [
          ...(block.type === 'swatch' ? [new TextRun({ text: '    ', shading: { fill: block.color.slice(1) } }), new TextRun('  ')] : []),
          new TextRun({ text: line, ...(brochure ? { size: heading ? 33 : 25, bold: Boolean(heading) } : {}), ...(heading ? { color: (model.headingColor || '#24364A').slice(1) } : {}) }),
        ],
      })));
    }
  }
  return Packer.toBlob(new Document({
    title: model.title, creator: 'Skilled Crafting', subject: model.organization,
    styles: { default: {
      document: { run: { font: 'Arial', size: 22, color: '24364A' } },
      title: { run: { font: 'Arial', size: brochure ? 61 : 48, bold: true, color: (model.headingColor || model.accent).slice(1) }, paragraph: { spacing: { after: 160 } } },
      subtitle: { run: { font: 'Arial', size: 26, color: '44546A' }, paragraph: { spacing: { after: 160 } } },
    } },
    sections: [{
      properties: { page: { size: { width: 12240, height: 15840 }, margin: brochure ? { top: 960, right: 1220, bottom: 900, left: 1220 } : { top: 650, right: 780, bottom: 750, left: 780 } } },
      footers: { default: new Footer({ children: [new Paragraph({ children: [new TextRun(footer + '  |  '), new TextRun({ children: [PageNumber.CURRENT] })] })] }) },
      children,
    }],
  }));
}

function pdf(model, images) {
  const brochure = model.schoolBrochure;
  const document = new jsPDF({ unit: 'pt', format: 'letter', compress: true });
  document.setProperties({ title: model.title, subject: model.organization, author: 'Skilled Crafting' });
  let y = 54;
  function reserve(height) {
    if (y + height > 735) { document.addPage(); y = 54; }
  }
  function write(text, size, { bold = false, keepNext = false, inset = 0, color = '#24364A' } = {}) {
    document.setFont('helvetica', bold ? 'bold' : 'normal');
    document.setFontSize(size);
    document.setTextColor(color);
    const leading = size + (brochure ? 7 : 5);
    const lines = document.splitTextToSize(text, 504 - inset);
    reserve(Math.min(140, lines.length * leading) + (keepNext ? 32 : 0));
    for (const line of lines) {
      reserve(leading);
      document.text(line, 54 + inset, y + size);
      y += leading;
    }
    y += brochure ? 15 : 8;
  }
  const [red,green,blue]=rgbHex(model.headingColor || model.accent);
  document.setFillColor(red,green,blue);
  document.rect(0, 0, 612, 16, 'F');
  document.setFont('helvetica','bold');
  document.setFontSize(9);
  document.setTextColor(red,green,blue);
  document.text('SKILLED CRAFTING  /  CLIENT MARKETING',54,35);
  write(model.title, brochure ? 30 : 24, { bold: true, keepNext: true, color: model.headingColor || model.accent });
  write(model.organization, 13);
  if (status(model)) write(status(model), 10, { bold: true, color: '#A82135' });
  for (const [index, block] of model.blocks.entries()) {
    if (block.pageBreakBefore && y > 54) {
      document.addPage();
      y = 54;
      write(model.organization, 13, { bold: true, color: model.headingColor });
    }
    if (block.type === 'image') {
      const image = images.get(block.source);
      const size = imageSize(image, block.thumbnail);
      reserve(size.height + 12);
      document.addImage(image.bytes, 'PNG', 54, y, size.width, size.height);
      y += size.height + 4;
      write(block.label, 9);
    } else if (block.type === 'table') {
      reserve(60);
      autoTable(document, {
        startY: y, margin: { left: 54, right: 54, top: 54, bottom: 57 },
        head: [block.columns], body: block.rows, rowPageBreak: 'avoid',
        styles: { fontSize: 10, cellPadding: 7 },
        headStyles: { fillColor: rgbHex(model.headingColor || model.accent) },
      });
      y = document.lastAutoTable.finalY + 15;
    } else if (block.type === 'link') {
      reserve(30);
      document.setFont('helvetica', 'normal');
      document.setFontSize(10);
      document.setTextColor('#234B70');
      document.textWithLink(block.label, 54, y + 10, { url: block.url, maxWidth: 504 });
      y += 30;
    } else if (block.type === 'swatch') {
      reserve(44);
      document.setFillColor(block.color);
      document.rect(54, y + 2, 15, 12, 'F');
      write(block.label, 10, { inset: 23 });
    } else {
      const heading = ['heading', 'subheading'].includes(block.type);
      if (heading) {
        let next = index + 1;
        while (['heading', 'subheading'].includes(model.blocks[next]?.type)) next++;
        const following = model.blocks[next];
        if (following?.type === 'image') {
          const dimensions = imageSize(images.get(following.source), following.thumbnail);
          reserve((next - index) * 32 + dimensions.height + 30);
        }
      }
      const size = heading ? (brochure ? 17 : block.type === 'heading' ? 15 : 12) : (brochure ? 12.5 : 10.5);
      write(value(block), size,
        { bold: heading, keepNext: heading, ...(heading ? { color: model.headingColor } : {}) });
    }
  }
  for (let page = 1; page <= document.getNumberOfPages(); page++) {
    document.setPage(page);
    if (brochure && page > 1) {
      document.setFillColor(red, green, blue);
      document.rect(0, 0, 612, 16, 'F');
    }
    document.setFont('helvetica', 'normal');
    document.setFontSize(9);
    document.setTextColor('#44546A');
    document.text(footer + '  |  ' + page, 54, 763);
  }
  return document.output('blob');
}

export async function exportMarketingDocument(model, format, resolveImage = async source => {
  if (!/^data:image\/(png|jpeg|webp);base64,[a-z\d+/=]+$/i.test(source)) throw Error('Choose a verified document image.');
  return (await fetch(source)).blob();
}) {
  if (!['docx', 'pdf'].includes(format)) throw Error('Choose Word or PDF.');
  const images = await prepareImages(model, resolveImage);
  return format === 'docx' ? word(model, images) : pdf(model, images);
}
