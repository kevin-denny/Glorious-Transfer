import 'server-only';
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  timezone: '+05:30', // Set timezone to IST
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export async function query(sql: string, params?: any[]) {
  const [results] = await pool.execute(sql, params);
  return results;
}

export async function queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
  const results = await query(sql, params) as T[];
  return results[0] || null;
}

export default pool;
