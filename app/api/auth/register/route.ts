import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { hashPassword, generateToken } from '@/lib/auth';
import { randomUUID } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const { email, password, full_name, role } = await request.json();

    // Validate input
    if (!email || !password || !full_name || !role) {
      return NextResponse.json(
        { message: 'Missing required fields: email, password, full_name, role' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { message: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Validate password length
    if (password.length < 6) {
      return NextResponse.json(
        { message: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    // Validate role
    const validRoles = ['administrator', 'finance', 'operations'];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { message: 'Invalid role. Must be: administrator, finance, or operations' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await queryOne(
      'SELECT id FROM auth_users WHERE email = ?',
      [email]
    );

    if (existingUser) {
      return NextResponse.json(
        { message: 'User with this email already exists' },
        { status: 409 }
      );
    }

    // Generate user ID and hash password
    const userId = randomUUID();
    const hashedPassword = await hashPassword(password);

    // Insert into auth_users
    await query(
      `INSERT INTO auth_users (id, email, encrypted_password, created_at, updated_at) 
       VALUES (?, ?, ?, NOW(), NOW())`,
      [userId, email, hashedPassword]
    );

    // Insert into profiles
    await query(
      `INSERT INTO profiles (id, full_name, role, created_at, updated_at) 
       VALUES (?, ?, ?, NOW(), NOW())`,
      [userId, full_name, role]
    );

    // Generate token
    const token = generateToken({
      id: userId,
      email,
      full_name,
      role,
    });

    // Return success response
    return NextResponse.json(
      {
        message: 'User registered successfully',
        token,
        user: {
          id: userId,
          email,
          full_name,
          role,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
