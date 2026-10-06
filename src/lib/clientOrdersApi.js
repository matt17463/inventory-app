import { supabase } from '../supabaseClient';

export async function listClientOrders() {
  const { data, error } = await supabase
    .from('sc_client_order_requests_detail')
    .select('*')
    .order('submitted_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getClientOrderItems(requestId) {
  const { data, error } = await supabase
    .from('sc_client_order_request_items')
    .select('*')
    .eq('request_id', requestId)
    .order('line_number');
  if (error) throw error;
  return data || [];
}

export async function updateClientOrder(requestId, patch) {
  const { data, error } = await supabase
    .from('sc_client_order_requests')
    .update(patch)
    .eq('id', requestId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function listCalendarData() {
  const safe = async (promise) => {
    const result = await promise;
    if (result.error) return [];
    return result.data || [];
  };
  const [jobs, purchaseOrders, artwork, clientOrders, tasks] = await Promise.all([
    safe(supabase.from('jobs').select('id,job_name,customer_name,woocommerce_order_id,due_date,status,updated_at').not('due_date','is',null)),
    safe(supabase.from('phase1_purchase_orders_with_totals').select('*').not('expected_at','is',null)),
    safe(supabase.from('sc_artwork_system_requests').select('*')),
    safe(supabase.from('sc_client_order_requests_detail').select('*').not('desired_completion_date','is',null)),
    safe(supabase.from('phase5_tasks_detail').select('*').not('due_at','is',null)),
  ]);
  return { jobs, purchaseOrders, artwork, clientOrders, tasks };
}
