import 'server-only';
import { queryOne } from './db';

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

// Generate unique assignment ID with format A123456
export const generateUniqueAssignmentId = async (): Promise<string> => {
  let assignmentId: string;
  let exists: any;

  do {
    const randomNumber = Math.floor(100000 + Math.random() * 900000); // Generate 6-digit number
    assignmentId = `A${randomNumber}`;
    
    // Check if ID exists in database
    exists = await queryOne('SELECT id FROM assignments WHERE id = ?', [assignmentId]);
  } while (exists);

  return assignmentId;
};

// Generate unique audit log ID with format L20241119143025123456789 (L + timestamp + milliseconds + microseconds + random)
export const generateUniqueAuditLogId = async (): Promise<string> => {
  let logId: string;
  let exists: any;

  do {
    // Generate high-precision timestamp
    const now = new Date();
    const hrTime = process.hrtime(); // High-resolution time [seconds, nanoseconds]
    
    // Base timestamp: YYYYMMDDHHMMSSMMMUUU
    const timestamp = now.getFullYear().toString() +
      (now.getMonth() + 1).toString().padStart(2, '0') +
      now.getDate().toString().padStart(2, '0') +
      now.getHours().toString().padStart(2, '0') +
      now.getMinutes().toString().padStart(2, '0') +
      now.getSeconds().toString().padStart(2, '0') +
      now.getMilliseconds().toString().padStart(3, '0') +
      Math.floor((hrTime[1] % 1000000) / 1000).toString().padStart(3, '0');
    
    // Generate 2-digit random number for final uniqueness
    const randomNumber = Math.floor(10 + Math.random() * 90);
    
    logId = `L${timestamp}${randomNumber}`;
    
    // Check if ID exists in database (extremely unlikely with this precision)
    exists = await queryOne('SELECT id FROM activity_logs WHERE id = ?', [logId]);
  } while (exists);

  return logId;
};

// General UUID generator function (for backward compatibility)
export const generateId = generateUniqueAuditLogId;