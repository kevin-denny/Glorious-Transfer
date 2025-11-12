import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format dates to GMT+5:30 (IST)
export const formatToIST = (date: any) => {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() + 330); // Add 5 hours 30 minutes (330 minutes)
  return d.toISOString().replace('Z', ' GMT+05:30').replace('T', ' ');
};
