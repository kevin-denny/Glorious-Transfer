import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { getUserFromToken } from '@/lib/auth';
import { AuditLogger } from '@/lib/activity-logger.server';
import { SYSCONFIG } from '@/lib/utils';
import { stat } from 'node:fs';

export async function PUT(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.substring(7);
    const user = await getUserFromToken(token!);

    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has administrator role
    if (user.role !== 'administrator') {
      return NextResponse.json({ 
        message: 'Access denied. Administrator role required.' 
      }, { status: 403 });
    }

    // only access to manual user
    if (user.id !== SYSCONFIG.MANUAL_USER_ID) {
      return NextResponse.json({ 
        message: 'Access denied. Only manual user can change status.' 
      }, { status: 403 });
    }

    const { userid, status } = await request.json();

    // Validate required fields
    if (!userid || !status) {
      return NextResponse.json({ 
        message: 'Missing required fields: userid and status are required' 
      }, { status: 400 });
    }

    // Validate status value
    const validStatuses = ['inactive', 'active', 'deactive'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ 
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
      }, { status: 400 });
    }

    // Check if user exists
    const existingUser = await queryOne(
      'SELECT id, status FROM auth_users WHERE id = ?',
      [userid]
    );

    if (!existingUser) {
      return NextResponse.json({ 
        message: 'User not found' 
      }, { status: 404 });
    }

    // Get user details before update for audit logging
    const userDetails = await queryOne(
      `SELECT au.id, au.email, au.status, p.full_name, p.role 
       FROM auth_users au 
       LEFT JOIN profiles p ON au.id = p.id 
       WHERE au.id = ?`,
      [userid]
    );

    // Update user status
    await query(
      'UPDATE auth_users SET status = ?, updated_at = NOW() WHERE id = ?',
      [status, userid]
    );

    // Initialize audit logger
    const auditLogger = new AuditLogger({
      id: user.id,
      name: user.full_name || user.email,
      role: user.role,
    });
     

    // Log the status update
    try {
    //   await auditLogger.logUpdate(SYSCONFIG.ENTITY_TYPE_USER, user.id, existingUser.status, status, SYSCONFIG.SUCCESS, {
    //     target_user: {
    //       id: userid,
    //       email: userDetails?.email,
    //       full_name: userDetails?.full_name,
    //       role: userDetails?.role
    //     }
    //   });
    } catch (auditError) {
      // Don't break the response if audit logging fails
      console.warn('Audit log failed for user status update:', auditError);
    }

    return NextResponse.json({
      message: 'User status updated successfully',
      data: {
        userid,
        status,
        updated_at: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error('User status update error:', error);
    return NextResponse.json(
      { message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
