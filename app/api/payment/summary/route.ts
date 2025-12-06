import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUserFromToken } from '@/lib/auth';
import { SYSCONFIG } from '@/lib/utils';
import { AuditLogger } from '@/lib/activity-logger.server';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.substring(7);
    const user = await getUserFromToken(token!);

    if (!user || !(user.role === SYSCONFIG.ADMINISTRATOR || user.role === SYSCONFIG.FINANCE)) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
    }

    // Initialize audit logger
    const auditLogger = new AuditLogger({
      id: user.id,
      name: user.full_name || user.email,
      role: user.role,
    });

    // Get month from request body
    const body = await request.json();
    const { month, startMonth = '', endMonth = '' } = body;

    // if (!month) {
    //   return NextResponse.json(
    //     { message: 'Month parameter is required (format: YYYY-MM)' },
    //     { status: 400 }
    //   );
    // }

    // // Validate month format
    // const monthPattern = /^\d{4}-\d{2}$/;
    // if (!monthPattern.test(month)) {
    //   return NextResponse.json(
    //     { message: 'Invalid month format. Use YYYY-MM (e.g., 2025-12)' },
    //     { status: 400 }
    //   );
    // }

    if (startMonth && endMonth && (startMonth.trim().length > 0 && endMonth.trim().length > 0)) {
      const monthPattern = /^\d{4}-\d{2}$/;
      if (!monthPattern.test(startMonth) || !monthPattern.test(endMonth)) {
        return NextResponse.json(
          { message: 'Invalid month format. Use YYYY-MM (e.g., 2025-12)' },
          { status: 400 }
        );
      } else if (startMonth > endMonth) {
        return NextResponse.json(
          { message: 'Invalid month range. startMonth should be less than or equal to endMonth.' },
          { status: 400 }
        );
      }
    }

    const [endYear, endMonthNum] = endMonth.split('-').map(Number);
    const lastDayOfMonth = new Date(endYear, endMonthNum, 0).getDate();
    const dateRangeParams = [];
    dateRangeParams.push(`${startMonth}-01 00:00:00`, `${endMonth}-${lastDayOfMonth} 23:59:59`);


    // Query for tour payments grouped by currency
    const tourPaymentsQuery = `
      SELECT 
        p.currency,
        COALESCE(SUM(p.amount), 0) as total_amount
      FROM payments p
      WHERE p.type = 'tour_payment'
        AND (p.created_at BETWEEN ? AND ?)
      GROUP BY p.currency
    `;

    // Query for driver payments (LKR only)
    const driverPaymentsQuery = `
      SELECT
        p.currency, 
        COALESCE(SUM(p.amount), 0) as total_amount
      FROM payments p
      WHERE p.type = 'driver_payment'
        AND (p.created_at BETWEEN ? AND ?)
      GROUP BY p.currency
    `;

    const [tourPaymentsResult, driverPaymentsResult] = await Promise.all([
      query(tourPaymentsQuery, [...dateRangeParams]),
      query(driverPaymentsQuery, [...dateRangeParams])  
    ]);

    // Format tour payments by currency
    const tourPayments: Record<string, number> = {
      USD: 0,
      EUR: 0,
      LKR: 0
    };

    (tourPaymentsResult as any[]).forEach((row: any) => {
      if (row.currency && ['USD', 'EUR', 'LKR'].includes(row.currency)) {
        tourPayments[row.currency] = parseFloat(row.total_amount || 0);
      }
    });

    // Format driver payments
    const driverPayments: Record<string, number> = {
      USD: 0,
      EUR: 0,
      LKR: 0
    };

    (driverPaymentsResult as any[]).forEach((row: any) => {
      if (row.currency && ['USD', 'EUR', 'LKR'].includes(row.currency)) {
        driverPayments[row.currency] = parseFloat(row.total_amount || 0);
      }
    });

    const summary = {
      month,
      tour_payments: tourPayments,
      driver_payments: driverPayments
    };

    // 🔥 LOG AUDIT ACTIVITY - PAYMENT SUMMARY RETRIEVAL
    await auditLogger.logRead(
      SYSCONFIG.ENTITY_TYPE_PAYMENT, 
      'summary', 
      SYSCONFIG.SUCCESS, 
      { month, summary }
    );

    return NextResponse.json({ summary });

  } catch (error: any) {
    console.error('Payment summary error:', error);
    return NextResponse.json(
      { message: 'Failed to get payment summary', error: error.message },
      { status: 500 }
    );
  }
}
