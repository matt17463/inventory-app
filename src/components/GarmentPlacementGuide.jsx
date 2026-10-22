import React from 'react';

const REF_HINTS = {
  left_chest: 'Reference: align using collar/shoulder seam and garment centerline. Verify on the actual blank.',
  right_chest: 'Reference: mirror the left-chest approach. Verify wearer-right placement.',
  center_chest: 'Adult sweatshirt reference: top of graphic roughly 3–3.5 in below neck trim; adjust by style/size.',
  full_front: 'Center on garment fold. Confirm top offset, usable print area, pouch/pocket and zipper clearance.',
  full_back: 'Center between side seams. For hoodies, account for the hood covering the upper back.',
  sleeve: 'Align on sleeve centerline; check cuff and seam clearance before pressing.',
};

export function classifyGarment(blank = {}) {
  const value = [blank.asset_name, blank.product_name, blank.product_type, blank.blank_type].join(' ').toLowerCase();
  if (/hoodie|hooded|18500|sweatshirt.*hood|pullover/.test(value)) return 'hoodie';
  if (/polo|golf shirt/.test(value)) return 'polo';
  if (/crewneck|sweatshirt|fleece/.test(value)) return 'sweatshirt';
  return 'tee';
}

export function classifyPlacement(value = '', view = '') {
  const txt = String(value).toLowerCase().replace(/[\s-]+/g, '_');
  const where = String(view).toLowerCase();
  if (/sleeve|arm/.test(txt)) return 'sleeve';
  if (/left.*chest|left.*breast/.test(txt)) return 'left_chest';
  if (/right.*chest|right.*breast/.test(txt)) return 'right_chest';
  if (/back/.test(txt) || (/back/.test(where) && !/front/.test(txt))) return 'full_back';
  if (/center.*chest|mid.*chest/.test(txt)) return 'center_chest';
  return 'full_front';
}

function placementBox(zone) {
  switch (zone) {
    case 'left_chest': return { x: 146, y: 104, width: 45, height: 34 };
    case 'right_chest': return { x: 79, y: 104, width: 45, height: 34 };
    case 'center_chest': return { x: 100, y: 112, width: 80, height: 50 };
    case 'full_back': return { x: 76, y: 118, width: 128, height: 114 };
    case 'sleeve': return { x: 204, y: 106, width: 33, height: 81 };
    default: return { x: 80, y: 121, width: 120, height: 104 };
  }
}

export default function GarmentPlacementGuide({ blank, placement }) {
  const garment = classifyGarment(blank);
  const zone = classifyPlacement(placement?.placement_name, blank?.product_view);
  const b = placementBox(zone);
  const printedWidth = Number(placement?.print_width_inches);
  const printedHeight = Number(placement?.print_height_inches);
  const validWidth = Number.isFinite(printedWidth) && printedWidth > 0;
  const validHeight = Number.isFinite(printedHeight) && printedHeight > 0;
  const sizeText = validWidth ? String(printedWidth) + ' in wide' + (validHeight ? ' × ' + printedHeight + ' in high' : '') : 'Dimensions require confirmation';

  return (
    <figure className="sc-garment-guide">
      <svg viewBox="0 0 310 315" xmlns="http://www.w3.org/2000/svg"
        role="img" aria-label={garment + ' schematic; approximate ' + zone.replace(/_/g, ' ') + ' graphic zone'}>
        <rect x="1" y="1" width="308" height="313" rx="12" fill="#f8fafc" stroke="#cbd5e1" />
        <path d="M101 66 L64 82 L18 142 L54 177 L80 143 L80 280 L200 280 L200 143 L226 177 L262 142 L216 82 L178 66 L163 78 L117 78 Z"
          fill="#e2e8f0" stroke="#475569" strokeWidth="3" strokeLinejoin="round" />
        {garment === 'hoodie' ? (
          <>
            <path d="M105 67 Q103 33 139 30 Q177 33 175 67 L159 89 Q140 102 120 89 Z" fill="#cbd5e1" stroke="#475569" strokeWidth="3"/>
            <path d="M112 71 Q140 98 169 71" fill="none" stroke="#64748b" strokeWidth="2"/>
            <path d="M105 221 Q140 207 175 221 L183 260 L96 260 Z" fill="none" stroke="#94a3b8" strokeWidth="2"/>
          </>
        ) : (
          <path d="M117 78 Q140 105 163 78" fill="none" stroke="#475569" strokeWidth="3"/>
        )}
        {garment === 'polo' ? (
          <>
            <path d="M117 78 L140 105 L163 78 M140 100 L140 139" stroke="#475569" fill="none" strokeWidth="2"/>
            <circle cx="140" cy="114" r="2.5" fill="#475569"/><circle cx="140" cy="129" r="2.5" fill="#475569"/>
          </>
        ) : null}
        <path d="M140 104 V279" stroke="#94a3b8" strokeDasharray="4 4" strokeWidth="1.5"/>
        <rect x={b.x} y={b.y} width={b.width} height={b.height} rx="3"
          fill="#0d948824" stroke="#0f766e" strokeWidth="2.5" strokeDasharray="6 3"/>
        <path d={'M' + (b.x + b.width / 2) + ',' + (b.y - 6) + 'v' + (b.height + 12) +
          ' M' + (b.x - 6) + ',' + (b.y + b.height / 2) + 'h' + (b.width + 12)}
          stroke="#0f766e" strokeWidth="1" strokeDasharray="3 3" />
        <text x="140" y="300" fill="#334155" fontSize="12" textAnchor="middle">
          {zone.replace(/_/g, ' ').toUpperCase()} · ILLUSTRATION ONLY
        </text>
      </svg>
      <figcaption>
        <strong>{String(placement?.placement_name || 'Artwork placement').replace(/_/g, ' ')} — {sizeText}</strong>
        <span>{REF_HINTS[zone]}</span>
        <small>Diagram is not to scale. Confirm artwork dimensions, top edge, centerline, neckline, seams, pockets and heat-safe areas on the physical garment. Record the approved measurement in the production instructions.</small>
      </figcaption>
    </figure>
  );
}
