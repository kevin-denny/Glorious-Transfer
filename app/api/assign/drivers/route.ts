import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUserFromToken } from '@/lib/auth';
import { formatToIST, SYSCONFIG } from '@/lib/utils';
import { AuditLogger } from '@/lib/activity-logger.server';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.substring(7);
    const user = await getUserFromToken(token!);

    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // initialize audit logger (server-side)
    const auditLogger = new AuditLogger({
      id: user.id,
      name: user.full_name || user.email,
      role: user.role,
    });

    // Get all active drivers
    const drivers = await query(
      'SELECT * FROM drivers WHERE status = ? ORDER BY name ASC',
      [SYSCONFIG.ACTIVE]
    ) as any[];

    // Format timestamps for all drivers
    const formattedDrivers = drivers.map(driver => ({
      driver_id: driver.id,
      name: driver.name,
      driver_number: driver.driver_number,
    }));

    // LOG AUDIT ACTIVITY - ACTIVE DRIVERS RETRIEVAL
    // await auditLogger.logReadMultiple(SYSCONFIG.ENTITY_TYPE_DRIVER, formattedDrivers.map(d => d.driver_id), SYSCONFIG.SUCCESS, {
    //   filter: { status: SYSCONFIG.ACTIVE },
    //   result_count: formattedDrivers.length,
    // });

    return NextResponse.json({
      data: formattedDrivers,
      total: formattedDrivers.length,
      message: 'Active drivers retrieved successfully'
    });

  } catch (error: any) {
    console.error('Get active drivers error:', error);
    return NextResponse.json(
      { message: 'Failed to get active drivers', error: error.message },
      { status: 500 }
    );
  }
}
