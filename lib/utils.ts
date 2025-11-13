import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { queryOne } from './db';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format dates to GMT+5:30 (IST) - Format: YYYY-MM-DD HH:mm:ss
export const formatToIST = (date: any) => {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() + 330); // Add 5 hours 30 minutes (330 minutes)
  return d.toISOString().slice(0, 19).replace('T', ' ');
};

// Generate unique user ID with format U123456
export const generateUniqueUserId = async (): Promise<string> => {
  let userId: string;
  let exists: any;

  do {
    const randomNumber = Math.floor(100000 + Math.random() * 900000); // Generate 6-digit number
    userId = `U${randomNumber}`;
    
    // Check if ID exists in database
    exists = await queryOne('SELECT id FROM auth_users WHERE id = ?', [userId]);
  } while (exists);

  return userId;
};

// Generate unique driver ID with format D123456
export const generateUniqueDriverId = async (): Promise<string> => {
  let driverId: string;
  let exists: any;

  do {
    const randomNumber = Math.floor(100000 + Math.random() * 900000); // Generate 6-digit number
    driverId = `D${randomNumber}`;
    
    // Check if ID exists in database
    exists = await queryOne('SELECT id FROM drivers WHERE id = ?', [driverId]);
  } while (exists);

  return driverId;
};

// Generate unique tour ID with format T123456
export const generateUniqueTourId = async (): Promise<string> => {
  let tourId: string;
  let exists: any;

  do {
    const randomNumber = Math.floor(100000 + Math.random() * 900000); // Generate 6-digit number
    tourId = `T${randomNumber}`;
    
    // Check if ID exists in database
    exists = await queryOne('SELECT id FROM tours WHERE id = ?', [tourId]);
  } while (exists);

  return tourId;
};

// Generate unique payment ID with format P123456
export const generateUniquePaymentId = async (): Promise<string> => {
  let paymentId: string;
  let exists: any;

  do {
    const randomNumber = Math.floor(100000 + Math.random() * 900000); // Generate 6-digit number
    paymentId = `P${randomNumber}`;
    
    // Check if ID exists in database
    exists = await queryOne('SELECT id FROM payments WHERE id = ?', [paymentId]);
  } while (exists);

  return paymentId;
};
