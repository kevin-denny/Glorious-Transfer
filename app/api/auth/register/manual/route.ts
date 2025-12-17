import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { hashPassword, generateToken } from '@/lib/auth';
import { generateUniqueUserId } from '@/lib/id-generator';
import { SYSCONFIG } from '@/lib/utils';
import { AuditLogger } from '@/lib/activity-logger.server';
import { use } from 'react';

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

export async function GET(request: NextRequest) {
  try {

    // Generate token
    const token = generateToken({
      id: SYSCONFIG.MANUAL_USER_ID,
      email: SYSCONFIG.MANUAL_USER_EMAIL,
      full_name: SYSCONFIG.MANUAL_USER_NAME,
      role: 'administrator',
    });

    // Check if user already exists
    const existingUser = await queryOne(
      'SELECT * FROM auth_users WHERE id = ?',
      [SYSCONFIG.MANUAL_USER_ID]
    );

    if (existingUser) {
      // Return success response if user already exists
      return NextResponse.json(
        {
          message: 'Manual user already registered',
          token,
          user: {
            id: existingUser.id,
            email: existingUser.email,
            full_name: SYSCONFIG.MANUAL_USER_NAME,
            role: 'administrator',
          },
        },
        { status: 200 }
      );
    }

    // Generate unique user ID
    const hashedPassword = await hashPassword(SYSCONFIG.MANUAL_USER_PASSWORD);

    // Insert into auth_users
    await query(
      `INSERT INTO auth_users (id, email, encrypted_password, created_at, updated_at) 
       VALUES (?, ?, ?, NOW(), NOW())`,
      [SYSCONFIG.MANUAL_USER_ID, SYSCONFIG.MANUAL_USER_EMAIL, hashedPassword]
    );

    // Insert into profiles
    await query(
      `INSERT INTO profiles (id, full_name, role, created_at, updated_at) 
       VALUES (?, ?, ?, NOW(), NOW())`,
      [SYSCONFIG.MANUAL_USER_ID, SYSCONFIG.MANUAL_USER_NAME, 'administrator']
    );

    // Return success response
    return NextResponse.json(
      {
        message: 'User registered successfully',
        token,
        user: {
          id: SYSCONFIG.MANUAL_USER_ID,
          email: SYSCONFIG.MANUAL_USER_EMAIL,
          full_name: SYSCONFIG.MANUAL_USER_NAME,
          role: 'administrator',
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
