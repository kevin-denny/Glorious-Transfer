import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUserFromToken } from '@/lib/auth';
import { formatToIST, SYSCONFIG } from '@/lib/utils';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.substring(7);
    const user = await getUserFromToken(token!);

    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

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
