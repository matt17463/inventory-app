import { supabase } from '../supabaseClient';

export async function getArtworkSystemRequests(status = 'open') {
  let query = supabase
    .from('sc_artwork_system_requests')
    .select('*')
    .order('received_at', { ascending: false });

  if (status === 'open') {
    query = query.not('app_status', 'in', '(completed,cancelled)');
  } else if (status !== 'all') {
    query = query.eq('app_status', status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getArtworkSystemReorders(status = 'open') {
  let query = supabase
    .from('sc_artwork_system_reorders')
    .select('*')
    .order('received_at', { ascending: false });

  if (status === 'open') {
    query = query.not('app_status', 'in', '(completed,cancelled)');
  } else if (status !== 'all') {
    query = query.eq('app_status', status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getArtworkSystemHandoffs() {
  const { data, error } = await supabase
    .from('sc_artwork_system_handoffs')
    .select('*')
    .order('received_at', { ascending: false })
    .limit(100);

  if (error) throw error;
  return data || [];
}

export async function updateArtworkSystemRequestStatus(id, appStatus, appNotes = '') {
  const { data, error } = await supabase.rpc('mark_sc_artwork_system_request', {
    p_id: id,
    p_app_status: appStatus,
    p_app_notes: appNotes,
  });
  if (error) throw error;
  return data;
}

export async function updateArtworkSystemReorderStatus(id, appStatus, appNotes = '') {
  const { data, error } = await supabase.rpc('mark_sc_artwork_system_reorder', {
    p_id: id,
    p_app_status: appStatus,
    p_app_notes: appNotes,
  });
  if (error) throw error;
  return data;
}
