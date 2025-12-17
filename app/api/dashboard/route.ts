import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { getUserFromToken } from '@/lib/auth';
import { formatToIST, SYSCONFIG } from '@/lib/utils';

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

interface DashboardRequest {
  current_month_only?: boolean; // Flag to switch between current month and all-time
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.substring(7);
    const user = await getUserFromToken(token!);

    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body: DashboardRequest = await request.json();
    const { current_month_only = true } = body;
    // const current_month_only = true;

    // Get current month prefix for LIKE query (e.g., "2025-01-")
    const now = new Date();
    const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-`;

    // Build date filters based on flag using LIKE queries
    const tourDateFilter = current_month_only 
      ? `AND (pickup_datetime LIKE '${currentMonthPrefix}%' OR (pickup_datetime IS NULL AND arrival_datetime LIKE '${currentMonthPrefix}%'))`
      : '';
    
    const paymentDateFilter = current_month_only 
    ? `AND (t.pickup_datetime LIKE '${currentMonthPrefix}%' OR (t.pickup_datetime IS NULL AND t.arrival_datetime LIKE '${currentMonthPrefix}%'))`
    : '';

    const joinedTourAndPayment = 
    `INNER JOIN tours t ON p.tour_id = t.id`;

    // Get basic statistics
    const [
      totalTours,
      pendingTours,
      assignedTours,
      completedTours,
      cancelledTours,
      totalDrivers,
      activeDrivers,
      totalPayments,
      totalRevenue,
      totalComplaints,
      
      // Driver payment statistics
      driverPaymentsPending,
      driverPaymentsPartial,
      driverPaymentsCompleted,
      
      // Tour payment statistics  
      tourPaymentsPending,
      tourPaymentsPartial,
      tourPaymentsConfirmed,
      
      recentToursResult
    ] = await Promise.all([
      // Tours statistics with optional date filter
      queryOne(`SELECT COUNT(*) as count FROM tours WHERE 1=1 ${tourDateFilter}`),
      queryOne(`SELECT COUNT(*) as count FROM tours WHERE status = '${SYSCONFIG.PENDING}' ${tourDateFilter}`),
      queryOne(`SELECT COUNT(*) as count FROM tours WHERE status = '${SYSCONFIG.ASSIIGNED}' ${tourDateFilter}`),
      queryOne(`SELECT COUNT(*) as count FROM tours WHERE status = '${SYSCONFIG.COMPLETED}' ${tourDateFilter}`),
      queryOne(`SELECT COUNT(*) as count FROM tours WHERE status = '${SYSCONFIG.CANCELLED}' ${tourDateFilter}`),
      
      // Driver statistics (always all-time)
      queryOne('SELECT COUNT(*) as count FROM drivers'),
      queryOne(`SELECT COUNT(*) as count FROM drivers WHERE status = '${SYSCONFIG.ACTIVE}'`),
      
      // Payment statistics with optional date filter
      queryOne(`SELECT COUNT(*) as count FROM payments p ${joinedTourAndPayment} WHERE 1=1 ${paymentDateFilter}`),
      queryOne(`SELECT COALESCE(SUM(p.amount), 0) as total FROM payments p ${joinedTourAndPayment} WHERE p.status = '${SYSCONFIG.COMPLETED}' ${paymentDateFilter}`),
      
      // Complaints with optional date filter  
      queryOne(`SELECT COUNT(*) as count FROM tours WHERE complaints IS NOT NULL AND complaints != '' AND complaints != '[]' ${tourDateFilter}`),
      
      // Driver payment status breakdown with optional date filter
      queryOne(`SELECT COUNT(*) as count FROM payments p ${joinedTourAndPayment} WHERE p.type = 'driver_payment' AND p.status = '${SYSCONFIG.PENDING}' ${paymentDateFilter}`),
      queryOne(`SELECT COUNT(*) as count FROM payments p ${joinedTourAndPayment} WHERE p.type = 'driver_payment' AND p.status = '${SYSCONFIG.PARTIAL}' ${paymentDateFilter}`),
      queryOne(`SELECT COUNT(*) as count FROM payments p ${joinedTourAndPayment} WHERE p.type = 'driver_payment' AND p.status = '${SYSCONFIG.COMPLETED}' ${paymentDateFilter}`),
      
      // Tour payment status breakdown with optional date filter
      queryOne(`SELECT COUNT(*) as count FROM payments p ${joinedTourAndPayment} WHERE p.type = 'tour_payment' AND p.status = '${SYSCONFIG.PENDING}' ${paymentDateFilter}`),
      queryOne(`SELECT COUNT(*) as count FROM payments p ${joinedTourAndPayment} WHERE p.type = 'tour_payment' AND p.status = '${SYSCONFIG.PARTIAL}' ${paymentDateFilter}`),
      queryOne(`SELECT COUNT(*) as count FROM payments p ${joinedTourAndPayment} WHERE p.type = 'tour_payment' AND p.status = '${SYSCONFIG.CONFIRMED}' ${paymentDateFilter}`),
      
      // Recent tours with optional date filter
      query(`SELECT id, customer_name, agent, status, booking_date, pickup_datetime FROM tours WHERE 1=1 ${tourDateFilter} ORDER BY created_at DESC LIMIT 5`)
    ]);

    // Type cast and format recent tours
    const recentTours = (recentToursResult as any[]) || [];
    const formattedRecentTours = recentTours.map((tour: any) => ({
      ...tour,
      booking_date: formatToIST(tour.booking_date),
      pickup_datetime: tour.pickup_datetime ? formatToIST(tour.pickup_datetime) : null
    }));

    const dashboardData = {
      filter_info: {
        current_month_only,
        period: current_month_only 
          ? `${currentMonthPrefix}01 to ${currentMonthPrefix}31` 
          : 'All time',
        month_name: current_month_only 
          ? now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
          : null,
        month_prefix: current_month_only ? currentMonthPrefix : null
      },
      stats: {
        tours: {
          total: totalTours?.count || 0,
          pending: pendingTours?.count || 0,
          assigned: assignedTours?.count || 0,
          completed: completedTours?.count || 0,
          cancelled: cancelledTours?.count || 0
        },
        drivers: {
          total: totalDrivers?.count || 0,
          active: activeDrivers?.count || 0
        },
        payments: {
          total: totalPayments?.count || 0,
        //   revenue: parseFloat(totalRevenue?.total || 0),
          driver_payments: {
            pending: driverPaymentsPending?.count || 0,
            partial: driverPaymentsPartial?.count || 0,
            completed: driverPaymentsCompleted?.count || 0,
            total: (driverPaymentsPending?.count || 0) + (driverPaymentsPartial?.count || 0) + (driverPaymentsCompleted?.count || 0)
          },
          tour_payments: {
            pending: tourPaymentsPending?.count || 0,
            partial: tourPaymentsPartial?.count || 0,
            confirmed: tourPaymentsConfirmed?.count || 0,
            total: (tourPaymentsPending?.count || 0) + (tourPaymentsPartial?.count || 0) + (tourPaymentsConfirmed?.count || 0)
          }
        },
        complaints: {
          total: totalComplaints?.count || 0
        }
      },
    //   recent_tours: formattedRecentTours
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
