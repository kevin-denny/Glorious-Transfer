import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import { verifyPassword, generateToken } from '@/lib/auth';
import { AuditLogger } from '@/lib/activity-logger.server';
import { SYSCONFIG } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    const user = await queryOne<any>(
      `SELECT u.id, u.email, u.encrypted_password, p.full_name, p.role, u.status
       FROM auth_users u 
       JOIN profiles p ON u.id = p.id 
       WHERE u.email = ?`,
      [email]
    );

    if (!user || !(await verifyPassword(password, user.encrypted_password))) {
      return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }

    // Initialize audit logger
    const auditLogger = new AuditLogger({
      id: user.id,
      name: user.full_name || user.email,
      role: user.role,
    });

    // check user status
    if (user.status !== SYSCONFIG.ACTIVE) {
      // 🔥 LOG AUDIT ACTIVITY - USER LOGIN FAILED DUE TO INACTIVE STATUS
      await auditLogger.logCreate(SYSCONFIG.ENTITY_TYPE_USER, user.id, { email: user.email }, SYSCONFIG.FAILED, 'User inactive during login attempt');
      return NextResponse.json({ message: 'User is not active' }, { status: 403 });
    }

    // update last_login timestamp
    await queryOne(
      `UPDATE auth_users SET last_login_at = NOW() WHERE id = ?`,
      [user.id]
    );

    // 🔥 LOG AUDIT ACTIVITY - USER LOGIN
    await auditLogger.logCreate(SYSCONFIG.ENTITY_TYPE_USER, user.id, { email: user.email }, SYSCONFIG.SUCCESS);

    const token = generateToken({
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
    });

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
