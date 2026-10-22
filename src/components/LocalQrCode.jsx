import { useMemo } from 'react';
import { qrcodegen } from '../vendor/qrcodegen';

export default function LocalQrCode({ value, size = 150, label = 'Scan to open production packet' }) {
  const matrix = useMemo(() => {
    if (!value) return null;
    try {
      return qrcodegen.QrCode.encodeText(String(value), qrcodegen.QrCode.Ecc.MEDIUM);
    } catch {
      return null;
    }
  }, [value]);

  if (!matrix) return <span role="status">QR unavailable; use the printed link.</span>;
  const modules = [];
  for (let y = 0; y < matrix.size; y++) {
    for (let x = 0; x < matrix.size; x++) {
      if (matrix.getModule(x, y)) modules.push('M' + x + ',' + y + 'h1v1h-1z');
    }
  }
  return (
    <svg width={size} height={size} viewBox={'-4 -4 ' + (matrix.size + 8) + ' ' + (matrix.size + 8)}
      role="img" aria-label={label} shapeRendering="crispEdges" xmlns="http://www.w3.org/2000/svg">
      <rect x="-4" y="-4" width={matrix.size + 8} height={matrix.size + 8} fill="#fff" />
      <path d={modules.join('')} fill="#000" />
    </svg>
  );
}
