import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUserFromToken } from '@/lib/auth';
import { AuditLogger } from '@/lib/activity-logger.server';
import { SYSCONFIG } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.substring(7);
    const user = await getUserFromToken(token!);

    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has administrator role to view activity logs
    if (user.role !== 'administrator') {
      return NextResponse.json({ 
        message: 'Access denied. Administrator role required to view activity logs.' 
      }, { status: 403 });
    }

    // Initialize audit logger
    const auditLogger = new AuditLogger({
      id: user.id,
      name: user.full_name || user.email,
      role: user.role,
    });

    // Get distinct action values from activity_logs table
    const actions = await query(
      'SELECT DISTINCT action FROM activity_logs WHERE action IS NOT NULL ORDER BY action ASC'
    ) as any[];

    // Transform results to array of strings
    const distinctActions = actions.map(row => row.action);

    // Log the read operation
    try {
      await auditLogger.logRead(SYSCONFIG.ENTITY_TYPE_ACTIVITY_LOG, undefined, SYSCONFIG.SUCCESS, {
        operation: 'get_distinct_actions',
        count: distinctActions.length,
        actions: distinctActions
      });
    } catch (auditError) {
      // Don't break response if audit logging fails
      console.warn('Audit log failed for GET /api/assign/actions:', auditError);
    }

    return NextResponse.json({
      data: distinctActions,
      count: distinctActions.length,
      message: 'Distinct action values retrieved successfully'
    });

  } catch (error: any) {
    console.error('Get distinct actions error:', error);
    return NextResponse.json(
      { message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
