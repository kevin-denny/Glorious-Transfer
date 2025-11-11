import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { query, queryOne } from './db';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'administrator' | 'finance' | 'operations';
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(user: User): string {
  return jwt.sign({ userId: user.id, email: user.email, role: user.role }, JWT_SECRET, {
    expiresIn: '7d',
  });
}

export function verifyToken(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export async function getUserFromToken(token: string): Promise<User | null> {
  const decoded = verifyToken(token);
  if (!decoded) return null;

  const user = await queryOne<User>(
    `SELECT u.id, u.email, p.full_name, p.role 
     FROM auth_users u 
     JOIN profiles p ON u.id = p.id 
     WHERE u.id = ?`,
    [decoded.userId]
  );

  return user;
}
