export const SUPPLIER_RECEIVING_CONTRACT_SQL = 'deployment/sql/42_SUPPLIER_RECEIVING_SCHEMA_CONTRACT.sql';

const CONTRACT_PROBES = [
  {
    table: 'sc_supplier_item_mappings',
    columns: 'id,supplier_key,supplier_sku,blank_product_id_text,last_brand,last_style,last_color,last_size,created_by,created_at,updated_at',
  },
  {
    table: 'sc_supplier_receiving_imports',
    columns: 'id,supplier_key,supplier_name,order_number,po_number,order_date,original_file_name,document_storage_provider,document_storage_bucket,document_path,document_size_bytes,document_mime_type,document_sha256,ordered_lines,ordered_units,received_units,order_total,status,created_by,created_at,updated_at',
  },
  {
    table: 'sc_supplier_receiving_lines',
    columns: 'id,import_id,supplier_line_key,supplier_sku,description,brand,style,color,size,source_page,ordered_quantity,received_quantity,unit_cost,line_total,blank_product_id_text,updated_at',
  },
  {
    table: 'sc_supplier_receiving_receipts',
    columns: 'id,import_id,idempotency_key,status,received_units,notes,created_by,created_at,completed_at,rolled_back_at,rolled_back_by,rollback_reason',
  },
  {
    table: 'sc_supplier_receiving_receipt_lines',
    columns: 'id,receipt_id,import_line_id,blank_product_id_text,bin_id_text,quantity,unit_cost,status,error_message,created_at,rolled_back_at',
  },
];

export function supplierReceivingContractMessage(table, error) {
  const detail = String(error?.message || 'required table or column is unavailable').replace(/\s+/g, ' ').trim();
  return `Supplier receiving database schema is incomplete (${table}: ${detail}). Run ${SUPPLIER_RECEIVING_CONTRACT_SQL} in Supabase SQL Editor, wait 30 seconds for the schema cache to reload, and retry.`;
}

export async function requireSupplierReceivingContract(supabase) {
  for (const probe of CONTRACT_PROBES) {
    const result = await supabase.from(probe.table).select(probe.columns).limit(1);
    if (result.error) throw new Error(supplierReceivingContractMessage(probe.table, result.error));
  }
  return true;
}

