import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const assetsDir = path.join(projectRoot, 'dist', 'assets');

const requiredMarkers = [
  '/deployment-health',
  'Deployment Health',
  '/.netlify/functions/deployment-health',
  'Include WooCommerce connection test',
  'Out of stock — automatically assigned to Pending Stock',
  'Awaiting Stock',
  'Pending Stock:',
  'Report Need',
  'On Open PO',
  'Still To Order',
  'Covered by Open PO',
  'Source bin saved. Purchasing now uses this physical-bin assignment.',
  'Unreserved Pending Stock:',
  'Visual Themes & Interface Styles',
  'Technical Blueprint',
  'Futuristic Interface',
  'Cyberpunk Neon',
  'Formal Executive',
  'Professional Enterprise',
  'Industrial Command',
  'sc_display_preferences_v2',
  'Include on Purchasing Report',
  'Save Non-Inventory Settings',
  'Excluded from the Purchasing Report.',
  'Non-Inventory Purchasing:',
  'This pull sheet exists, but it currently has no saved job-item lines.',
  'cancel|void|deleted',
  'Completion is already recorded. No additional inventory was deducted.',
  'Search every blank SKU, linked Woo SKU, product name, description',
  '/google-calendar',
  'Google Calendar Integration',
  '/.netlify/functions/google-calendar-admin',
  '/.netlify/functions/google-calendar-oauth',
  'Rebuild Calendar Sync',
  'Skilled Crafting remains the source of truth',
  '/product-integrity',
  'Product Integrity Center',
  'Run Diagnostics',
];

function walkFiles(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

if (!fs.existsSync(assetsDir)) {
  console.error(`ERROR: Build assets directory does not exist: ${assetsDir}`);
  console.error('Run the Vite production build before running this verifier.');
  process.exit(1);
}

const javascriptFiles = walkFiles(assetsDir)
  .filter((filePath) => filePath.endsWith('.js'));

if (javascriptFiles.length === 0) {
  console.error(`ERROR: No JavaScript bundles were found under ${assetsDir}`);
  process.exit(1);
}

const combinedBundle = javascriptFiles
  .map((filePath) => fs.readFileSync(filePath, 'utf8'))
  .join('\n');

const missingMarkers = requiredMarkers.filter(
  (marker) => !combinedBundle.includes(marker),
);

console.log(`Checked ${javascriptFiles.length} production JavaScript bundle(s).`);

if (missingMarkers.length > 0) {
  console.error('ERROR: Required application features are missing from the production bundle:');

  for (const marker of missingMarkers) {
    console.error(`  - ${marker}`);
  }

  console.error('');
  console.error('The build must not be deployed.');
  console.error('Confirm that vite.config.js keeps build.rolldownOptions.treeshake set to false.');
  process.exit(1);
}

console.log('PASS: Required production bundle features are present.');
