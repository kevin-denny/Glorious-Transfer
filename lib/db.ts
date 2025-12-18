import mysql from 'mysql2/promise';

// Validate environment variables
if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_NAME) {
  console.error('Missing required database environment variables');
  console.error('DB_HOST:', process.env.DB_HOST ? 'set' : 'missing');
  console.error('DB_USER:', process.env.DB_USER ? 'set' : 'missing');
  console.error('DB_NAME:', process.env.DB_NAME ? 'set' : 'missing');
}

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  timezone: '+05:30', // Set timezone to IST
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  multipleStatements: false,
});

// Pool connection error handling is done per connection

// Graceful shutdown - only in Node.js environment
if (typeof process !== 'undefined') {
  process.on('SIGINT', async () => {
    console.log('Closing database pool...');
    try {
      await pool.end();
      console.log('Database pool closed.');
    } catch (error) {
      console.error('Error closing pool:', error);
    }
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('Closing database pool...');
    try {
      await pool.end();
      console.log('Database pool closed.');
    } catch (error) {
      console.error('Error closing pool:', error);
    }
    process.exit(0);
  });
}

export async function query(sql: string, params?: any[]) {
  let connection;
  try {
    // Get a connection from the pool
    connection = await pool.getConnection();
    
    // Execute query with or without params
    let result;
    if (params && params.length > 0) {
      result = await connection.execute(sql, params);
    } else {
      result = await connection.execute(sql);
    }
    
    if (!result || !Array.isArray(result)) {
      console.error('Invalid query result:', result);
      return [];
    }
    const [results] = result;
    return results || [];
  } catch (error: any) {
    console.error('Database query error:', error);
    console.error('SQL:', sql);
    console.error('Params:', params);
    
    // Log connection pool status on error
    if (error.code === 'ER_CON_COUNT_ERROR') {
      console.error('Connection pool exhausted. Consider increasing connectionLimit or checking for connection leaks.');
    }
    throw error;
  } finally {
    // Always release the connection back to the pool
    if (connection) {
      connection.release();
    }
  }
}

export async function queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
  try {
    const results = await query(sql, params) as T[];
    return (results && results.length > 0) ? results[0] : null;
  } catch (error) {
    console.error('Database queryOne error:', error);
    throw error;
  }
}

// Get a connection for transaction
export async function getConnection() {
  return await pool.getConnection();
}

// Transaction helper function
export async function transaction<T>(
  callback: (connection: any) => Promise<T>
): Promise<T> {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export default pool;
