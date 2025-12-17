import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { hashPassword, generateToken } from '@/lib/auth';
import { generateUniqueUserId } from '@/lib/id-generator';
import { SYSCONFIG } from '@/lib/utils';
import { AuditLogger } from '@/lib/activity-logger.server';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

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
    const validRoles = [SYSCONFIG.ADMINISTRATOR, SYSCONFIG.FINANCE, SYSCONFIG.OPERATIONS];
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

    // Generate unique user ID
    const userId = await generateUniqueUserId();
    const hashedPassword = await hashPassword(password);

    // Initialize audit logger
    const auditLogger = new AuditLogger({
      id: userId,
      name: full_name || email,
      role,
    });

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

    // 🔥 LOG AUDIT ACTIVITY - USER REGISTRATION
    await auditLogger.logCreate(SYSCONFIG.ENTITY_TYPE_USER, userId, { email }, SYSCONFIG.SUCCESS);

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
