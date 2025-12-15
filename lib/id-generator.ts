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

// // Generate unique driver ID with format D123456
// export const generateUniqueDriverId = async (): Promise<string> => {
//   let driverId: string;
//   let exists: any;

//   do {
//     const randomNumber = Math.floor(100000 + Math.random() * 900000); // Generate 6-digit number
//     driverId = `D${randomNumber}`;
    
//     // Check if ID exists in database
//     exists = await queryOne('SELECT id FROM drivers WHERE id = ?', [driverId]);
//   } while (exists);

//   return driverId;
// };

// Generate unique driver ID with sequential format D1, D2, D3, etc.
export const generateUniqueDriverId = async (): Promise<string> => {
  try {
    // Get the highest existing driver ID number
    const result = await queryOne(`
      SELECT MAX(CAST(SUBSTRING(id, 2) AS UNSIGNED)) as max_number 
      FROM drivers 
      WHERE id REGEXP '^GTD[0-9]+$'
    `);
    
    // Calculate next sequential number
    const maxNumber = result?.max_number || 0;
    const nextNumber = maxNumber + 1;
    
    // Generate new driver ID
    const driverId = `GTD${nextNumber}`;
    
    // Double-check that this ID doesn't exist (safety check)
    const exists = await queryOne('SELECT id FROM drivers WHERE id = ?', [driverId]);
    
    if (exists) {
      // If somehow it exists, try the next number
      return `GTD${nextNumber + 1}`;
    }
    
    return driverId;
  } catch (error) {
    console.error('Error generating sequential driver ID:', error);
    
    // Fallback to timestamp-based ID if there's an error
    const timestamp = Date.now().toString().slice(-6);
    return `GTD${timestamp}`;
  }
};

// // Generate unique tour ID with format T123456
// export const generateUniqueTourId = async (): Promise<string> => {
//   let tourId: string;
//   let exists: any;

//   do {
//     const randomNumber = Math.floor(100000 + Math.random() * 900000); // Generate 6-digit number
//     tourId = `T${randomNumber}`;
    
//     // Check if ID exists in database
//     exists = await queryOne('SELECT id FROM tours WHERE id = ?', [tourId]);
//   } while (exists);

//   return tourId;
// };

// Generate unique tour ID with sequential format T1, T2, T3, etc.
export const generateUniqueTourId = async (): Promise<string> => {
  try {
    // Get the highest existing tour ID number
    const result = await queryOne(`
      SELECT MAX(CAST(SUBSTRING(id, 2) AS UNSIGNED)) as max_number 
      FROM tours 
      WHERE id REGEXP '^GT[0-9]+$'
    `);
    
    // Calculate next sequential number
    const maxNumber = result?.max_number || 0;
    const nextNumber = maxNumber + 1;
    
    // Generate new tour ID
    const tourId = `GT${nextNumber}`;
    
    // Double-check that this ID doesn't exist (safety check)
    const exists = await queryOne('SELECT id FROM tours WHERE id = ?', [tourId]);
    
    if (exists) {
      // If somehow it exists, try the next number
      return `GT${nextNumber + 1}`;
    }
    
    return tourId;
  } catch (error) {
    console.error('Error generating sequential tour ID:', error);
    
    // Fallback to timestamp-based ID if there's an error
    const timestamp = Date.now().toString().slice(-6);
    return `GT${timestamp}`;
  }
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
    
    // Base timestamp: YYYYMMDDHHMMSS
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