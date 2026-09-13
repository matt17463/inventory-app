import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  findUniqueExactBlankMatch,
} from '../../src/lib/manualInvoicePairing.js';

const line = {
  brand: 'Gildan',
  style: '18500B',
  color: 'Black',
  size: 'YL',
};

const oneExact = [
  {
    id: 'blank-1',
    sku_base: 'GILDAN-18500B-BLACK-YL',
    brand: '  GILDAN ',
    style: '18500B',
    color: 'black',
    size: 'YL',
  },
];

assert.equal(
  findUniqueExactBlankMatch(oneExact, line)?.id,
  'blank-1',
  'one exact Brand/Style/Color/Size match should resolve'
);

assert.equal(
  findUniqueExactBlankMatch(
    [
      ...oneExact,
      {
        ...oneExact[0],
        id: 'blank-2',
      },
    ],
    line
  ),
  null,
  'multiple exact matches must remain unresolved'
);

assert.equal(
  findUniqueExactBlankMatch(
    [
      {
        ...oneExact[0],
        color: 'Sport Grey',
      },
    ],
    line
  ),
  null,
  'a different attribute must not fuzzy-match'
);

assert.equal(
  findUniqueExactBlankMatch(oneExact, {
    ...line,
    size: '',
  }),
  null,
  'incomplete identity must remain unresolved'
);

const apiSource = fs.readFileSync(
  new URL('../../src/lib/manualOrdersApi.js', import.meta.url),
  'utf8'
);

assert.ok(
  apiSource.includes('findUniqueExactBlankMatch'),
  'manualOrdersApi must use the exact-match helper'
);

assert.equal(
  (
    apiSource.match(
      /const resolvedItems = await resolveManualInvoiceBlankItems\(items\);/g
    ) || []
  ).length,
  2,
  'both create and update paths must resolve blank pairing before save'
);

assert.ok(
  apiSource.includes(
    "if (itemType !== 'blank' || clean(item.blank_product_id))"
  ),
  'existing explicit blank selections must be preserved'
);

console.log('manual-invoice-pairing.test.mjs: PASS');
