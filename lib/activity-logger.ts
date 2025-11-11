import { supabase } from './supabase';

export async function logActivity(
  action: 'create' | 'read' | 'update' | 'delete',
  tableName: string,
  recordId: string | null,
  changes: any = null
) {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return;

    await supabase.from('activity_logs').insert({
      user_id: user.id,
      action,
      table_name: tableName,
      record_id: recordId,
      changes: changes || {}
    });
  } catch (error) {
    console.error('Error logging activity:', error);
  }
}
