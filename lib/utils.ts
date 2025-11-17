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
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
};
