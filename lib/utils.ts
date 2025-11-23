import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format dates to GMT+5:30 (IST) - Format: YYYY-MM-DD HH:mm:ss
export const formatToIST = (date: any) => {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() + 330); // Add 5 hours 30 minutes (330 minutes)
  return d.toISOString().slice(0, 19).replace('T', ' ');
};

// SYSCONFIG constants
export const SYSCONFIG = {
  APP_NAME: 'Glorious Transfer',
  APP_VERSION: '1.0.0',
  SUPPORT_EMAIL: 'support@glorioustransfer.com',

  ADMINISTRATOR: 'administrator',
  OPERATIONS: 'operations',
  FINANCE: 'finance',

  ACTIVE: 'active',
  INACTIVE: 'inactive',
  DEACTIVE: 'deactive',

  PENDING: 'Pending',
  ASSIIGNED: 'Assigned',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',

  SUCCESS: 'Success',
  FAILED: 'Failed',

  DRIVER: 'driver',
  TOUR: 'tour',
  PAYMENT: 'payment',
  ACTIVITY_LOG: 'activity_log',
  ALL: 'all',

  ENTITY_TYPE_ASSIGNMENT: 'assignment',
  ENTITY_TYPE_TOUR: 'tour',
  ENTITY_TYPE_DRIVER: 'driver',
  ENTITY_TYPE_PAYMENT: 'payment',
  ENTITY_TYPE_ACTIVITY_LOG: 'activity_log',
  ENTITY_TYPE_LOGIN: 'login',
  ENTITY_TYPE_USER: 'user',

  IS_AUDIT_ENABLED: true,

  MANUAL_USER_NAME: 'manualuser',
  MANUAL_USER_ID: 'UMANUAL',
  MANUAL_USER_ROLE: 'administrator',
  MANUAL_USER_EMAIL: 'manualuser@glorioustransfer.com',
  MANUAL_USER_PASSWORD: 'ChangeMe@123',
};
