import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { getUserFromToken } from '@/lib/auth';
import { formatToIST, SYSCONFIG } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.substring(7);
    const user = await getUserFromToken(token!);

    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // Get basic statistics
    const [
      totalTours,
      pendingTours,
      assignedTours,
      completedTours,
      totalDrivers,
      activeDrivers,
      totalPayments,
      totalRevenue,
      recentToursResult
    ] = await Promise.all([
      queryOne('SELECT COUNT(*) as count FROM tours'),
      queryOne(`SELECT COUNT(*) as count FROM tours WHERE status = '${SYSCONFIG.PENDING}'`),
      queryOne(`SELECT COUNT(*) as count FROM tours WHERE status = '${SYSCONFIG.ASSIIGNED}'`),
      queryOne(`SELECT COUNT(*) as count FROM tours WHERE status = '${SYSCONFIG.COMPLETED}'`),
      queryOne('SELECT COUNT(*) as count FROM drivers'),
      queryOne(`SELECT COUNT(*) as count FROM drivers WHERE status = '${SYSCONFIG.ACTIVE}'`),
      queryOne('SELECT COUNT(*) as count FROM payments'),
      queryOne('SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = "Completed"'),
      query('SELECT id, customer_name, agent, status, booking_date FROM tours ORDER BY created_at DESC LIMIT 5')
    ]);

    // Type cast and format recent tours
    const recentTours = (recentToursResult as any[]) || [];
    const formattedRecentTours = recentTours.map((tour: any) => ({
      ...tour,
      booking_date: formatToIST(tour.booking_date)
    }));

    const dashboardData = {
      stats: {
        tours: {
          total: totalTours?.count || 0,
          pending: pendingTours?.count || 0,
          assigned: assignedTours?.count || 0,
          completed: completedTours?.count || 0
        },
        drivers: {
          total: totalDrivers?.count || 0,
          active: activeDrivers?.count || 0
        },
        payments: {
          total: totalPayments?.count || 0,
          revenue: parseFloat(totalRevenue?.total || 0)
        }
      },
      recent_tours: formattedRecentTours
    };

    return NextResponse.json({
      success: true,
      data: dashboardData
    });

  } catch (error: any) {
    console.error('Dashboard error:', error);
    return NextResponse.json(
      { message: 'Failed to load dashboard', error: error.message },
      { status: 500 }
    );
  }
}
