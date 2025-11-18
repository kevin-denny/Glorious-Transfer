// Type definitions for audit logging (safe for client-side imports)
export interface AuditLogData {
  user_id: string;
  user_name: string;
  user_role: 'administrator' | 'finance' | 'operations';
  action: string;
  entity_type: string;
  entity_id?: string | null;
  details?: any;
}

export interface AuditLogOptions {
  oldData?: any;
  newData?: any;
  additionalDetails?: any;
}

// This is a client-safe version that only contains type definitions
// The actual implementation is in activity-logger.server.ts

/**
 * Legacy function for backward compatibility
 */
export async function logActivity(
  action: 'create' | 'read' | 'update' | 'delete',
  tableName: string,
  recordId: string | null,
  changes: any = null
) {
  // This is kept for backward compatibility but should use the new AuditLogger class
  console.warn('logActivity is deprecated. Use AuditLogger class instead.');
}
