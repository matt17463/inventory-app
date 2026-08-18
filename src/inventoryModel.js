export const INVENTORY_MODEL = Object.freeze({
  blankCatalog: 'blank_products',
  blankLedger: 'blank_inventory_movements',
  wooCatalogAndMapping: 'products',
  jobs: 'jobs',
  jobItems: 'job_items',
  reservations: 'inventory_reservations',
  bins: 'bins',
  sampleCatalog: 'sample_products',
  sampleTypes: 'sample_product_types',
  sampleDisplayView: 'sample_products_with_bins',
  preservedLegacy: Object.freeze({
    directBinItems: 'bin_items',
    linkedSamples: 'sample_inventory',
  }),
});

export const INVENTORY_MODEL_PHASE = 'step_1_parallel_preservation';
