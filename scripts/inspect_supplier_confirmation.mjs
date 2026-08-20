import fs from 'node:fs/promises';
import { getDocument, GlobalWorkerOptions } from '../netlify/functions/_vendor/pdfjs/pdf.mjs';
import { parseSupplierConfirmationPages } from '../netlify/functions/_shared/supplierConfirmationParser.js';

GlobalWorkerOptions.workerSrc = new URL('../netlify/functions/_vendor/pdfjs/pdf.worker.mjs', import.meta.url).href;

for (const path of process.argv.slice(2)) {
  const data = new Uint8Array(await fs.readFile(path));
  const pdf = await getDocument({ data }).promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push({
      pageNumber,
      cells: content.items.filter((item) => item.str).map((item) => ({
        str: item.str,
        x: item.transform[4],
        y: item.transform[5],
      })),
    });
  }
  if (process.env.SC_SHOW_PDF_CELLS === '1') {
    console.log(JSON.stringify(pages, null, 2));
  } else {
    console.log(JSON.stringify(parseSupplierConfirmationPages(pages), null, 2));
  }
}
