import 'server-only';
import { query } from './db';
import { generateUniqueAuditLogId } from './id-generator';
import type { AuditLogData, AuditLogOptions } from './activity-logger';
import { SYSCONFIG } from './utils';

/**
 * Log audit activity to activity_logs table (SERVER-ONLY)
 * @param logData - Basic audit log information
 * @param options - Optional old/new data and additional details
 */
export async function logAuditActivity(
  logData: AuditLogData,
  options: AuditLogOptions = {}
) {
  try {

    if (!SYSCONFIG.IS_AUDIT_ENABLED) {
      return; // Skip logging if audit is disabled
    }

    const { user_id, user_name, user_role, action, entity_type, entity_id, status } = logData;
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
       (id, user_id, user_name, user_role, action, entity_type, entity_id, details, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        logId,
        user_id,
        user_name,
        user_role,
        action,
        entity_type,
        entity_id || null,
        JSON.stringify(details),
        status || null
      ]
    );

    console.log(`Audit log created: ${action} on ${entity_type} by ${user_name}`);
  } catch (error) {
    console.error('Error creating audit log:', error);
    // Don't throw error to avoid breaking main operations
  }
}

/**
 * Helper function to create standardized audit log entries for CRUD operations (SERVER-ONLY)
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
   * Log Login operation
   */
  async logLogin(status?: string, additionalDetails?: any) {
    // await logAuditActivity(
    //   {
    //     user_id: this.user.id,
    //     user_name: this.user.name,
    //     user_role: this.user.role,
    //     action: 'USER_LOGIN',
    //     entity_type: SYSCONFIG.ENTITY_TYPE_USER,
    //     entity_id: this.user.id,
    //     status
    //   },
    //   {
    //     additionalDetails
    //   }
    // );
  }

  /**
   * Log CREATE operation
   */
  async logCreate(entity_type: string, entity_id: string, newData: any, status: string, additionalDetails?: any) {
    await logAuditActivity(
      {
        user_id: this.user.id,
        user_name: this.user.name,
        user_role: this.user.role,
        action: `CREATE_${entity_type.toUpperCase()}`,
        entity_type,
        entity_id,
        status
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
  async logRead(entity_type: string, entity_id?: string, status?: string, additionalDetails?: any) {
    // await logAuditActivity(
    //   {
    //     user_id: this.user.id,
    //     user_name: this.user.name,
    //     user_role: this.user.role,
    //     action: `READ_${entity_type.toUpperCase()}`,
    //     entity_type,
    //     entity_id,
    //     status
    //   },
    //   {
    //     additionalDetails
    //   }
    // );
  }

  /**
   * Log Read Multiple operation
   */
  async logReadMultiple(entity_type: string, entity_ids: string[], status?: string, additionalDetails?: any) {
    // await logAuditActivity(
    //   {
    //     user_id: this.user.id,
    //     user_name: this.user.name,
    //     user_role: this.user.role,
    //     action: `READ_MULTIPLE_${entity_type.toUpperCase()}`,
    //     entity_type,
    //     entity_id: null,
    //     status
    //   },
    //   {
    //     additionalDetails: {
    //       entity_ids,
    //       ...additionalDetails
    //     }
    //   }
    // );
  }

  /**
   * Log UPDATE operation
   */
  async logUpdate(entity_type: string, entity_id: string, oldData: any, newData: any, status: string, additionalDetails?: any) {
    await logAuditActivity(
      {
        user_id: this.user.id,
        user_name: this.user.name,
        user_role: this.user.role,
        action: `UPDATE_${entity_type.toUpperCase()}`,
        entity_type,
        entity_id,
        status
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
  async logDelete(entity_type: string, entity_id: string, oldData: any, status?: string, additionalDetails?: any) {
    await logAuditActivity(
      {
        user_id: this.user.id,
        user_name: this.user.name,
        user_role: this.user.role,
        action: `DELETE_${entity_type.toUpperCase()}`,
        entity_type,
        entity_id,
        status
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
  async logAssign(tour_id: string, driver_id: string, status?: string, additionalDetails?: any) {
    await logAuditActivity(
      {
        user_id: this.user.id,
        user_name: this.user.name,
        user_role: this.user.role,
        action: 'ASSIGN_TOUR',
        entity_type: 'assignment',
        entity_id: tour_id,
        status
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
  async logUnassign(tour_id: string, driver_id: string, status?: string, additionalDetails?: any) {
    await logAuditActivity(
      {
        user_id: this.user.id,
        user_name: this.user.name,
        user_role: this.user.role,
        action: 'UNASSIGN_TOUR',
        entity_type: 'assignment',
        entity_id: tour_id,
        status
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