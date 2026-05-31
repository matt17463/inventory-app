import { supabase } from '../supabaseClient';

export async function getBins() {
  const { data, error } = await supabase
    .from('bins')
    .select('*')
    .order('bin_code', { ascending: true });

  if (error) throw error;
  return data || [];
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

export async function getBlankProducts(search = '') {
  let query = supabase
    .from('blank_inventory_by_product')
    .select('*')
    .order('name', { ascending: true });

  if (search.trim()) {
    const term = search.trim();
    query = query.or(
      `sku_base.ilike.%${term}%,name.ilike.%${term}%,brand.ilike.%${term}%,color.ilike.%${term}%,size.ilike.%${term}%`
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getFinishedProducts(search = '') {
  let query = supabase
    .from('finished_inventory_by_product')
    .select('*')
    .order('finished_sku', { ascending: true });

  if (search.trim()) {
    const term = search.trim();
    query = query.or(
      `finished_sku.ilike.%${term}%,name.ilike.%${term}%,customer.ilike.%${term}%,logo.ilike.%${term}%`
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function receiveBlankInventory({ binId, blankProductId, quantity, notes }) {
  const { error } = await supabase.rpc('receive_blank_inventory', {
    p_bin_id: Number(binId),
    p_blank_product_id: blankProductId,
    p_quantity: Number(quantity),
    p_notes: notes || null,
  });

  if (error) throw error;
}

export async function receiveFinishedInventory({ binId, finishedProductId, quantity, notes }) {
  const { error } = await supabase.rpc('receive_finished_inventory', {
    p_bin_id: Number(binId),
    p_finished_product_id: finishedProductId,
    p_quantity: Number(quantity),
    p_notes: notes || null,
  });

  if (error) throw error;
}
