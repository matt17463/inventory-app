import { supabase } from '../supabaseClient';

function throwIf(error) {
  if (error) throw error;
}

export async function listProductionEmployees({ activeOnly = false } = {}) {
  let q = supabase.from('production_employees').select('*').order('display_name');
  if (activeOnly) q = q.eq('active', true);
  const { data, error } = await q;
  throwIf(error);
  return data || [];
}

export async function saveProductionEmployee(input) {
  const payload = {
    display_name: input.display_name || input.name || 'Production Employee',
    role: input.role || 'Production',
    email: input.email || null,
    phone: input.phone || null,
    active: input.active !== false,
    notes: input.notes || null,
    updated_at: new Date().toISOString(),
  };
  if (input.id) {
    const { data, error } = await supabase.from('production_employees').update(payload).eq('id', input.id).select().single();
    throwIf(error);
    return data;
  }
  const { data, error } = await supabase.from('production_employees').insert(payload).select().single();
  throwIf(error);
  return data;
}

export async function listProductionTimeRules({ activeOnly = false } = {}) {
  let q = supabase.from('production_time_rules').select('*').order('rule_name');
  if (activeOnly) q = q.eq('active', true);
  const { data, error } = await q;
  throwIf(error);
  return data || [];
}

export async function saveProductionTimeRule(input) {
  const payload = {
    rule_name: input.rule_name || 'Production Rule',
    production_type: input.production_type || 'DTF',
    setup_minutes: Number(input.setup_minutes || 0),
    minutes_per_item: Number(input.minutes_per_item || 0),
    cleanup_minutes: Number(input.cleanup_minutes || 0),
    default_quantity: Number(input.default_quantity || 1),
    active: input.active !== false,
    notes: input.notes || null,
    updated_at: new Date().toISOString(),
  };
  if (input.id) {
    const { data, error } = await supabase.from('production_time_rules').update(payload).eq('id', input.id).select().single();
    throwIf(error);
    return data;
  }
  const { data, error } = await supabase.from('production_time_rules').insert(payload).select().single();
  throwIf(error);
  return data;
}

export async function deleteProductionTimeRule(id) {
  const { data, error } = await supabase.rpc('delete_production_time_rule', { p_rule_id: id });
  throwIf(error);
  return data;
}

export async function estimateProductionTime(ruleId, quantity) {
  const { data, error } = await supabase.rpc('production_time_estimate', {
    p_rule_id: ruleId,
    p_quantity: Number(quantity || 1),
  });
  throwIf(error);
  return (data || [])[0] || null;
}

export async function listCapacityWindows({ startDate, endDate } = {}) {
  let q = supabase.from('production_capacity_windows_with_usage').select('*').order('window_date').order('start_time');
  if (startDate) q = q.gte('window_date', startDate);
  if (endDate) q = q.lte('window_date', endDate);
  const { data, error } = await q;
  throwIf(error);
  return data || [];
}

export async function saveCapacityWindow(input) {
  const payload = {
    employee_id: input.employee_id || null,
    window_date: input.window_date,
    start_time: input.start_time,
    end_time: input.end_time,
    title: input.title || 'Production Block',
    work_area: input.work_area || 'General Production',
    notes: input.notes || null,
    is_available: input.is_available !== false,
    updated_at: new Date().toISOString(),
  };
  if (input.id) {
    const { data, error } = await supabase.from('production_capacity_windows').update(payload).eq('id', input.id).select().single();
    throwIf(error);
    return data;
  }
  const { data, error } = await supabase.from('production_capacity_windows').insert(payload).select().single();
  throwIf(error);
  return data;
}

export async function deleteCapacityWindow(id) {
  const { error } = await supabase.from('production_capacity_windows').delete().eq('id', id);
  throwIf(error);
  return true;
}

export async function listWindowAssignments({ startDate, endDate } = {}) {
  let q = supabase.from('production_window_assignment_details').select('*').order('window_date').order('start_time');
  if (startDate) q = q.gte('window_date', startDate);
  if (endDate) q = q.lte('window_date', endDate);
  const { data, error } = await q;
  throwIf(error);
  return data || [];
}

export async function listSchedulableJobs({ includeScheduled = false } = {}) {
  let q = supabase.from('production_schedulable_jobs').select('*').order('due_date_text', { ascending: true });
  if (!includeScheduled) q = q.eq('is_scheduled', false);
  const { data, error } = await q;
  throwIf(error);
  return data || [];
}

export async function assignJobToWindow(input) {
  const { data, error } = await supabase.rpc('assign_job_to_production_window', {
    p_window_id: input.window_id,
    p_job_id: Number(input.job_id),
    p_job_item_id: input.job_item_id ? Number(input.job_item_id) : null,
    p_assignment_title: input.assignment_title || null,
    p_assigned_minutes: Number(input.assigned_minutes || 0),
    p_notes: input.notes || null,
  });
  throwIf(error);
  return data;
}

export async function updateWindowAssignment(id, patch) {
  const payload = { ...patch, updated_at: new Date().toISOString() };
  const { data, error } = await supabase.from('production_window_assignments').update(payload).eq('id', id).select().single();
  throwIf(error);
  return data;
}

export async function deleteWindowAssignment(id) {
  const { error } = await supabase.from('production_window_assignments').delete().eq('id', id);
  throwIf(error);
  return true;
}
