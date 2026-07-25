import fs from 'node:fs';
import path from 'node:path';

const required = [
  'netlify/functions/deployment-health.js',
  'netlify/functions/update-woocommerce-order-status.js',
  'netlify/functions/supplier-catalog-feed-sync.js',
  'netlify/functions/_shared/pullsheetReservations.js',
  'src/DeploymentHealth.jsx',
  'src/NotFound.jsx',
  'src/CustomerPortal.jsx',
  'src/CustomerPortalPreview.jsx',
  'src/components/AppShell.jsx',
];

const missing = required.filter((file) => !fs.existsSync(path.resolve(file)));
if (missing.length) {
  console.error(`Missing required Steps 6-14 source files:\n${missing.join('\n')}`);
  process.exit(1);
}

const stale = [
  'ManualInvoicedOrders(10).jsx',
  'ManualInvoicedOrders.jsx',
  'manualOrdersApi.js',
  'download',
  'download (1)',
  'public/Home.jsx',
  'public/pullsheet.js',
  'src/AddItemToBin-with-create.jsx',
  'src/AssignBin.jsx',
  'src/BinPage.jsx',
  'src/CreateProduct.jsx',
  'src/PullSheetView-completed-edit.jsx',
  'src/SampleInventoryPage.jsx',
  'src/Samples.jsx',
  'src/SamplesPage.jsx',
  'src/SelectProduct.jsx',
  'supabase_feature_updates_incremental_samples_bins.sql',
];

const presentStale = stale.filter((file) => fs.existsSync(path.resolve(file)));
if (presentStale.length) {
  console.error(`Delete these stale deployable files:\n${presentStale.join('\n')}`);
  process.exit(1);
}

const app = fs.readFileSync(path.resolve('src/App.jsx'), 'utf8');
const shell = fs.readFileSync(path.resolve('src/components/AppShell.jsx'), 'utf8');
const preview = fs.readFileSync(path.resolve('src/CustomerPortalPreview.jsx'), 'utf8');

const publicPortal = app.indexOf('<Route path="/customer-portal"');
const authGate = app.indexOf('<AuthGate>');
if (publicPortal < 0 || authGate < 0 || publicPortal > authGate) {
  console.error('The public customer portal is not outside AuthGate.');
  process.exit(1);
}

if (!/<Route path="\*" element=\{<NotFound \/>\}/.test(app)) {
  console.error('The wildcard Not Found route is missing.');
  process.exit(1);
}

if (!/path="\/create-product"[^\n]+Navigate replace to="\/inventory\/edit-blanks"/.test(app)) {
  console.error('The legacy create-product route is not safely redirected.');
  process.exit(1);
}

if (/\/bin-contents/.test(shell)) {
  console.error('The obsolete /bin-contents fallback link is still present.');
  process.exit(1);
}

if (!/sc_customer_portal_data_v2/.test(preview)) {
  console.error('Customer portal preview is not using the token-scoped RPC.');
  process.exit(1);
}

console.log('Steps 6-14 runtime source and cleanup validation passed.');
