import { query } from './db';
import { generateUniqueAuditLogId } from './id-generator';

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

/**
 * Log audit activity to activity_logs table
 * @param logData - Basic audit log information
 * @param options - Optional old/new data and additional details
 */
export async function logAuditActivity(
  logData: AuditLogData,
  options: AuditLogOptions = {}
) {
  try {
    const { user_id, user_name, user_role, action, entity_type, entity_id } = logData;
    const { oldData, newData, additionalDetails } = options;

    // Prepare details JSON
    const details: any = {
      ...(additionalDetails || {})
    };

    // Add old and new data if provided
    if (oldData) {
      details.old_data = oldData;
    }
    if (newData) {
      details.new_data = newData;
    }

    // Generate log ID
    const logId = await generateUniqueAuditLogId();

    // Insert audit log
    await query(
      `INSERT INTO activity_logs 
       (id, user_id, user_name, user_role, action, entity_type, entity_id, details) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        logId,
        user_id,
        user_name,
        user_role,
        action,
        entity_type,
        entity_id || null,
        JSON.stringify(details)
      ]
    );

    console.log(`Audit log created: ${action} on ${entity_type} by ${user_name}`);
  } catch (error) {
    console.error('Error creating audit log:', error);
    // Don't throw error to avoid breaking main operations
  }
}

/**
 * Helper function to create standardized audit log entries for CRUD operations
 */
export class AuditLogger {
  private user: {
    id: string;
    name: string;
    role: 'administrator' | 'finance' | 'operations';
  };

  constructor(user: { id: string; name: string; role: 'administrator' | 'finance' | 'operations' }) {
    this.user = user;
  }

  /**
   * Log CREATE operation
   */
  async logCreate(entity_type: string, entity_id: string, newData: any, additionalDetails?: any) {
    await logAuditActivity(
      {
        user_id: this.user.id,
        user_name: this.user.name,
        user_role: this.user.role,
        action: `CREATE_${entity_type.toUpperCase()}`,
        entity_type,
        entity_id
      },
      {
        newData,
        additionalDetails
      }
    );
  }

  /**
   * Log READ operation
   */
  async logRead(entity_type: string, entity_id?: string, additionalDetails?: any) {
    await logAuditActivity(
      {
        user_id: this.user.id,
        user_name: this.user.name,
        user_role: this.user.role,
        action: `READ_${entity_type.toUpperCase()}`,
        entity_type,
        entity_id
      },
      {
        additionalDetails
      }
    );
  }

  /**
   * Log UPDATE operation
   */
  async logUpdate(entity_type: string, entity_id: string, oldData: any, newData: any, additionalDetails?: any) {
    await logAuditActivity(
      {
        user_id: this.user.id,
        user_name: this.user.name,
        user_role: this.user.role,
        action: `UPDATE_${entity_type.toUpperCase()}`,
        entity_type,
        entity_id
      },
      {
        oldData,
        newData,
        additionalDetails
      }
    );
  }

  /**
   * Log DELETE operation
   */
  async logDelete(entity_type: string, entity_id: string, oldData: any, additionalDetails?: any) {
    await logAuditActivity(
      {
        user_id: this.user.id,
        user_name: this.user.name,
        user_role: this.user.role,
        action: `DELETE_${entity_type.toUpperCase()}`,
        entity_type,
        entity_id
      },
      {
        oldData,
        additionalDetails
      }
    );
  }

  /**
   * Log ASSIGN operation (specific to assignments)
   */
  async logAssign(tour_id: string, driver_id: string, additionalDetails?: any) {
    await logAuditActivity(
      {
        user_id: this.user.id,
        user_name: this.user.name,
        user_role: this.user.role,
        action: 'ASSIGN_TOUR',
        entity_type: 'assignment',
        entity_id: tour_id
      },
      {
        additionalDetails: {
          tour_id,
          driver_id,
          ...additionalDetails
        }
      }
    );
  }

  /**
   * Log UNASSIGN operation (specific to assignments)
   */
  async logUnassign(tour_id: string, driver_id: string, additionalDetails?: any) {
    await logAuditActivity(
      {
        user_id: this.user.id,
        user_name: this.user.name,
        user_role: this.user.role,
        action: 'UNASSIGN_TOUR',
        entity_type: 'assignment',
        entity_id: tour_id
      },
      {
        additionalDetails: {
          tour_id,
          driver_id,
          ...additionalDetails
        }
      }
    );
  }
}

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
