import { supabase } from './supabase.js';

export async function getAllReports(store) {
  const { data, error } = await supabase
    .from('sales_reports')
    .select('*')
    .eq('store_id', store)
    .order('date');
  if (error) throw error;
  return data || [];
}
