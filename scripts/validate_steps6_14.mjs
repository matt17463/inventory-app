import fs from 'node:fs';
import path from 'node:path';

const required = [
  'netlify/functions/deployment-health.js',
  'netlify/functions/update-woocommerce-order-status.js',
  'netlify/functions/supplier-catalog-feed-sync.js',
  'netlify/functions/_shared/pullsheetReservations.js',
  'src/DeploymentHealth.jsx',
  'src/NotFound.jsx',
  'supabase/migrations/202607250501_step6_woocommerce_status_audit.sql',
  'supabase/migrations/202607250601_step7_supplier_sync_runs_and_cache.sql',
  'supabase/migrations/202607250701_step8_pullsheet_idempotency_support.sql',
  'supabase/migrations/202607251301_step14_deployment_health.sql',
  'supabase/verification/000_steps6_14_preflight_read_only_v3.sql',
  'supabase/verification/900_steps6_14_post_install_verification.sql',
  'supabase/tests/002_steps6_14_contract_smoke.sql',
  'docs/STEPS_6_14_SAFE_DEPLOYMENT.md',
  'README_STEPS_6_14.md',
];
const missing = required.filter((file) => !fs.existsSync(path.resolve(file)));
if (missing.length) {
  console.error(`Missing required Steps 6-14 files:\n${missing.join('\n')}`);
  process.exit(1);
}

const requiredMigrations = required.filter((file) => file.includes('/migrations/'));
const forbidden = [/\bdrop\s+table\b/i, /\btruncate\b/i, /\bdelete\s+from\s+(?:public\.)?(?:jobs|job_items|inventory_reservations|blank_products|blank_inventory_movements|products)\b/i];
for (const file of requiredMigrations) {
  const sql = fs.readFileSync(file, 'utf8');
  for (const pattern of forbidden) {
    if (pattern.test(sql)) {
      console.error(`${file} contains forbidden operational SQL: ${pattern}`);
      process.exit(1);
    }
  }
}


const removedDeployableFiles = fs.readFileSync('STEP_11_DELETE_FILES.txt', 'utf8')
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean);
const unexpectedlyPresent = removedDeployableFiles.filter((file) => fs.existsSync(path.resolve(file)));
if (unexpectedlyPresent.length) {
  console.error(`Stale deployable files are still present:\n${unexpectedlyPresent.join('\n')}`);
  process.exit(1);
}

const contract = JSON.parse(fs.readFileSync('supabase/contract/application_database_contract.json', 'utf8'));
const contractRelations = new Set((contract.relations || []).map((row) => row.relation_name));
for (const relation of ['sc_pullsheet_sync_runs', 'sc_supplier_catalog_sync_runs', 'sc_woocommerce_status_change_audit']) {
  if (!contractRelations.has(relation)) {
    console.error(`Current database contract is missing ${relation}.`);
    process.exit(1);
  }
}

console.log('Steps 6-14 required files, current contract, cleanup, and non-destructive SQL checks passed.');
