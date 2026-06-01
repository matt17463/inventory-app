import { supabase } from '../supabaseClient';

function normalizeSearchValue(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function textSearchValue(value) {
  return String(value || '').toLowerCase();
}

function escapeOrTerm(term) {
  return String(term || '').replace(/[%_,]/g, '\\$&');
}

function blankProductSearchText(product) {
  return [
    product.sku_base,
    product.name,
    product.brands?.name,
    product.brands?.code,
    product.product_types?.name,
    product.product_types?.code,
    product.colors?.name,
    product.colors?.code,
    product.sizes?.name,
    product.sizes?.code,
  ];
}

export function formatBinLabel(bin) {
  return [bin?.bin_code, bin?.label, bin?.location].filter(Boolean).join(' - ');
}

export function formatBlankProductLabel(product) {
  const brand = product?.brands?.code || product?.brands?.name || product?.brand;
  const type = product?.product_types?.code || product?.product_types?.name || product?.product_type;
  const color = product?.colors?.code || product?.colors?.name || product?.color;
  const size = product?.sizes?.code || product?.sizes?.name || product?.size;

  return [product?.sku_base, product?.name, brand, type, color, size]
    .filter(Boolean)
    .join(' - ');
}

export async function getBins() {
  const { data, error } = await supabase
    .from('bins')
    .select('id, bin_code, label, location, nfc_url, created_at')
    .order('bin_code', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createBin({ binCode, label, location }) {
  const payload = {
    bin_code: binCode?.trim() || null,
    label: label?.trim() || null,
    location: location?.trim() || null,
  };

  if (!payload.bin_code && !payload.label) {
    throw new Error('Enter a bin code or label.');
  }

  const { data, error } = await supabase
    .from('bins')
    .insert(payload)
    .select('id, bin_code, label, location, nfc_url')
    .single();

  if (error) throw error;
  return data;
}

export async function getBin(binId) {
  const { data, error } = await supabase
    .from('bins')
    .select('id, bin_code, label, location, nfc_url, created_at')
    .eq('id', Number(binId))
    .single();

  if (error) throw error;
  return data;
}

export async function getBlankProducts(search = '') {
  const { data, error } = await supabase
    .from('blank_products')
    .select(`
      id,
      sku_base,
      name,
      image_url,
      brands:brand_id(name, code),
      colors:color_id(name, code),
      sizes:size_id(name, code),
      product_types:product_type_id(name, code)
    `)
    .order('name', { ascending: true });

  if (error) throw error;

  const rows = data || [];
  const term = search.trim();

  if (!term) return rows;

  const lowerTerm = textSearchValue(term);
  const normalizedTerm = normalizeSearchValue(term);

  return rows.filter((product) =>
    blankProductSearchText(product).some((part) => {
      const value = String(part || '');
      return (
        textSearchValue(value).includes(lowerTerm) ||
        normalizeSearchValue(value).includes(normalizedTerm)
      );
    })
  );
}

export async function getBlankInventory(search = '') {
  let query = supabase
    .from('blank_inventory_by_product')
    .select('*')
    .order('name', { ascending: true });

  const term = search.trim();

  if (term) {
    const escaped = escapeOrTerm(term);
    query = query.or(
      `sku_base.ilike.%${escaped}%,name.ilike.%${escaped}%,brand.ilike.%${escaped}%,color.ilike.%${escaped}%,size.ilike.%${escaped}%`
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getBinContents(binId, search = '') {
  let query = supabase
    .from('bin_blank_inventory_contents')
    .select('*')
    .eq('bin_id', Number(binId))
    .order('sku_base', { ascending: true });

  const term = search.trim();

  if (term) {
    const escaped = escapeOrTerm(term);
    query = query.or(
      `sku_base.ilike.%${escaped}%,name.ilike.%${escaped}%,brand.ilike.%${escaped}%,product_type.ilike.%${escaped}%,color.ilike.%${escaped}%,size.ilike.%${escaped}%`
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function receiveBlankInventory({ binId, blankProductId, quantity, notes }) {
  const { error } = await supabase.rpc('receive_blank_inventory', {
    p_bin_id: Number(binId),
    p_blank_product_id: Number(blankProductId),
    p_quantity: Number(quantity),
    p_notes: notes || null,
  });

  if (error) throw error;
}

export async function setBinBlankInventoryQuantity({ binId, blankProductId, quantity, notes }) {
  const { error } = await supabase.rpc('set_bin_blank_inventory_quantity', {
    p_bin_id: Number(binId),
    p_blank_product_id: Number(blankProductId),
    p_quantity: Number(quantity),
    p_notes: notes || null,
  });

  if (error) throw error;
}

export async function getFinishedProducts(search = '') {
  let query = supabase
    .from('finished_inventory_by_product')
    .select('*')
    .order('finished_sku', { ascending: true });

  const term = search.trim();

  if (term) {
    const escaped = escapeOrTerm(term);
    query = query.or(
      `finished_sku.ilike.%${escaped}%,name.ilike.%${escaped}%,customer.ilike.%${escaped}%,logo.ilike.%${escaped}%`
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function receiveFinishedInventory({ binId, finishedProductId, quantity, notes }) {
  const { error } = await supabase.rpc('receive_finished_inventory', {
    p_bin_id: Number(binId),
    p_finished_product_id: Number(finishedProductId),
    p_quantity: Number(quantity),
    p_notes: notes || null,
  });

  if (error) throw error;
}

export async function getPullSheets() {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getPullSheetItems(jobId) {
  const { data, error } = await supabase
    .from('pull_sheet_view')
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function completeJobItem({ jobItemId, binId, notes }) {
  const { error } = await supabase.rpc('complete_job_item', {
    p_job_item_id: Number(jobItemId),
    p_bin_id: Number(binId),
    p_notes: notes || null,
  });

  if (error) throw error;
}
