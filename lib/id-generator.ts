import 'server-only';
import { queryOne, transaction } from './db';

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

// Generate unique driver ID with transaction-safe sequential format GTD000001, GTD000002, GTD000003, etc.
export const generateUniqueDriverId = async (): Promise<string> => {
  return await transaction(async (connection) => {
    // Lock the table to prevent race conditions (use query instead of execute for LOCK TABLES)
    await connection.query('LOCK TABLES drivers WRITE');
    
    try {
      // Get the highest existing driver ID number with explicit lock
      const result = await connection.execute(`
        SELECT MAX(CAST(SUBSTRING(id, 4) AS UNSIGNED)) as max_number 
        FROM drivers 
        WHERE id REGEXP '^GTD[0-9]+$'
        FOR UPDATE
      `);
      
      // Calculate next sequential number
      const maxNumber = result[0][0]?.max_number || 0;
      const nextNumber = maxNumber + 1;
      
      // Generate new driver ID with 6-digit zero padding
      const driverId = `GTD${nextNumber.toString().padStart(6, '0')}`;
      
      // Verify the ID doesn't exist (additional safety)
      const existsResult = await connection.execute('SELECT id FROM drivers WHERE id = ? FOR UPDATE', [driverId]);
      
      if (existsResult[0].length > 0) {
        throw new Error('Generated ID already exists');
      }
      
      return driverId;
    } finally {
      // Always unlock tables (use query instead of execute for UNLOCK TABLES)
      await connection.query('UNLOCK TABLES');
    }
  });
};

// Generate unique tour ID with transaction-safe sequential format GT000001, GT000002, GT000003, etc.
export const generateUniqueTourId = async (): Promise<string> => {
  return await transaction(async (connection) => {
    // Lock the table to prevent race conditions (use query instead of execute for LOCK TABLES)
    await connection.query('LOCK TABLES tours WRITE');
    
    try {
      // Get the highest existing tour ID number with explicit lock
      const result = await connection.execute(`
        SELECT MAX(CAST(SUBSTRING(id, 3) AS UNSIGNED)) as max_number 
        FROM tours 
        WHERE id REGEXP '^GT[0-9]+$'
        FOR UPDATE
      `);
      
      // Calculate next sequential number
      const maxNumber = result[0][0]?.max_number || 0;
      const nextNumber = maxNumber + 1;
      
      // Generate new tour ID with 6-digit zero padding
      const tourId = `GT${nextNumber.toString().padStart(6, '0')}`;
      
      // Verify the ID doesn't exist (additional safety)
      const existsResult = await connection.execute('SELECT id FROM tours WHERE id = ? FOR UPDATE', [tourId]);
      
      if (existsResult[0].length > 0) {
        throw new Error('Generated ID already exists');
      }
      
      return tourId;
    } finally {
      // Always unlock tables (use query instead of execute for UNLOCK TABLES)
      await connection.query('UNLOCK TABLES');
    }
  });
};

// Generate unique payment ID with format P123456
export const generateUniquePaymentId = async (): Promise<string> => {
  let paymentId: string;
  let exists: any;
  let attempts = 0;
  const maxAttempts = 10;

  do {
    if (attempts >= maxAttempts) {
      // If we've tried too many times, use a timestamp-based approach
      const timestamp = Date.now().toString();
      paymentId = `P${timestamp.slice(-6)}`;
      break;
    }
    
    const randomNumber = Math.floor(100000 + Math.random() * 900000);
    paymentId = `P${randomNumber}`;
    
    // Check if ID exists in database
    exists = await queryOne('SELECT id FROM payments WHERE id = ?', [paymentId]);
    attempts++;
  } while (exists);

  return paymentId;
};

// Generate unique assignment ID with format A123456
export const generateUniqueAssignmentId = async (): Promise<string> => {
  let assignmentId: string;
  let exists: any;
  let attempts = 0;
  const maxAttempts = 10;

  do {
    if (attempts >= maxAttempts) {
      // If we've tried too many times, use a timestamp-based approach
      const timestamp = Date.now().toString();
      assignmentId = `A${timestamp.slice(-6)}`;
      break;
    }
    
    const randomNumber = Math.floor(100000 + Math.random() * 900000);
    assignmentId = `A${randomNumber}`;
    
    // Check if ID exists in database
    exists = await queryOne('SELECT id FROM assignments WHERE id = ?', [assignmentId]);
    attempts++;
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