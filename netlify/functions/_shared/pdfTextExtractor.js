import path from 'node:path';
import { pathToFileURL } from 'node:url';

/*
 * PDF.js attempts to load optional canvas polyfills when it starts in Node.
 * Netlify's esbuild bundle does not preserve the `require` context PDF.js uses
 * for those optional dependencies. Text extraction does not render a PDF, but
 * PDF.js still constructs one DOMMatrix while the module is initialized.
 *
 * Install small, server-safe compatibility classes before dynamically loading
 * PDF.js. The dynamic import is intentional: a static import would execute
 * PDF.js before these globals are available in the Netlify function runtime.
 */

class TextExtractionDOMMatrix {
  constructor(values = [1, 0, 0, 1, 0, 0]) {
    const source = Array.from(values || []);
    const matrix = source.length >= 16
      ? [source[0], source[1], source[4], source[5], source[12], source[13]]
      : source;
    [this.a, this.b, this.c, this.d, this.e, this.f] = [
      Number(matrix[0] ?? 1), Number(matrix[1] ?? 0),
      Number(matrix[2] ?? 0), Number(matrix[3] ?? 1),
      Number(matrix[4] ?? 0), Number(matrix[5] ?? 0),
    ];
  }

  multiplySelf(other = new TextExtractionDOMMatrix()) {
    const right = other instanceof TextExtractionDOMMatrix ? other : new TextExtractionDOMMatrix(other);
    const { a, b, c, d, e, f } = this;
    this.a = a * right.a + c * right.b;
    this.b = b * right.a + d * right.b;
    this.c = a * right.c + c * right.d;
    this.d = b * right.c + d * right.d;
    this.e = a * right.e + c * right.f + e;
    this.f = b * right.e + d * right.f + f;
    return this;
  }

  preMultiplySelf(other = new TextExtractionDOMMatrix()) {
    const left = other instanceof TextExtractionDOMMatrix ? other : new TextExtractionDOMMatrix(other);
    const result = new TextExtractionDOMMatrix(left).multiplySelf(this);
    Object.assign(this, result);
    return this;
  }

  multiply(other) {
    return new TextExtractionDOMMatrix(this).multiplySelf(other);
  }

  translateSelf(x = 0, y = 0) {
    return this.multiplySelf([1, 0, 0, 1, Number(x), Number(y)]);
  }

  translate(x = 0, y = 0) {
    return new TextExtractionDOMMatrix(this).translateSelf(x, y);
  }

  scaleSelf(x = 1, y = x) {
    return this.multiplySelf([Number(x), 0, 0, Number(y), 0, 0]);
  }

  scale(x = 1, y = x) {
    return new TextExtractionDOMMatrix(this).scaleSelf(x, y);
  }

  invertSelf() {
    const determinant = this.a * this.d - this.b * this.c;
    if (!determinant) {
      [this.a, this.b, this.c, this.d, this.e, this.f] = [NaN, NaN, NaN, NaN, NaN, NaN];
      return this;
    }
    const { a, b, c, d, e, f } = this;
    this.a = d / determinant;
    this.b = -b / determinant;
    this.c = -c / determinant;
    this.d = a / determinant;
    this.e = (c * f - d * e) / determinant;
    this.f = (b * e - a * f) / determinant;
    return this;
  }

  inverse() {
    return new TextExtractionDOMMatrix(this).invertSelf();
  }

  get is2D() { return true; }

  get isIdentity() {
    return this.a === 1 && this.b === 0 && this.c === 0
      && this.d === 1 && this.e === 0 && this.f === 0;
  }
}

class TextExtractionImageData {
  constructor(dataOrWidth, widthOrHeight, height) {
    if (typeof dataOrWidth === 'number') {
      this.width = dataOrWidth;
      this.height = widthOrHeight;
      this.data = new Uint8ClampedArray(this.width * this.height * 4);
    } else {
      this.data = dataOrWidth;
      this.width = widthOrHeight;
      this.height = height ?? Math.floor((this.data?.length || 0) / (this.width * 4));
    }
    this.colorSpace = 'srgb';
  }
}

class TextExtractionPath2D {
  addPath() {}
  closePath() {}
  moveTo() {}
  lineTo() {}
  bezierCurveTo() {}
  quadraticCurveTo() {}
  rect() {}
}

export function installPdfTextRuntimeCompatibility() {
  globalThis.DOMMatrix ||= TextExtractionDOMMatrix;
  globalThis.ImageData ||= TextExtractionImageData;
  globalThis.Path2D ||= TextExtractionPath2D;
}

let pdfJsPromise;

async function pdfJs() {
  installPdfTextRuntimeCompatibility();
  pdfJsPromise ||= import('../_vendor/pdfjs/pdf.mjs');
  return pdfJsPromise;
}

export async function extractPdfTextPages(bytes) {
  const { getDocument, GlobalWorkerOptions } = await pdfJs();
  // PDF.js resolves worker strings relative to its own bundled module. Build an
  // absolute file URL so the same path works both in Netlify (/var/task) and in
  // local tests. netlify.toml includes this worker in the deployed function.
  const taskRoot = process.env.LAMBDA_TASK_ROOT || process.cwd();
  GlobalWorkerOptions.workerSrc = pathToFileURL(path.join(
    taskRoot,
    'netlify/functions/_vendor/pdfjs/pdf.worker.mjs',
  )).href;
  const pdf = await getDocument({ data: new Uint8Array(bytes) }).promise;
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
  return pages;
}
