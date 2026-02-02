import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { getUserFromToken } from '@/lib/auth';
import { formatToIST, SYSCONFIG } from '@/lib/utils';
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

    // Get search term and pagination from body
    const body = await request.json();
    const { searchTerm = '', page = 1, pageSize = 10, driver_id, limit = 15, startMonth = '', endMonth = '' } = body;

    // Validate pagination parameters
    if (page < 1 || pageSize < 1 || pageSize > 100) {
      return NextResponse.json(
        { message: 'Invalid pagination parameters. Page must be >= 1 and pageSize between 1-100' },
        { status: 400 }
      );
    }

    // Calculate offset
    const offset = (page - 1) * pageSize;

    let whereClause = 'p.type = "driver_payment"';
    let queryParams: any[] = [];

    // Add driver filter if provided
    if (driver_id) {
      whereClause += ' AND p.driver_id = ?';
      queryParams.push(driver_id);
    }

    // Get total count for pagination
    const totalResult = await queryOne(
      `SELECT COUNT(*) as total FROM payments p 
       LEFT JOIN drivers d ON p.driver_id = d.id 
       LEFT JOIN tours t ON p.tour_id = t.id 
       WHERE ${whereClause}`,
      queryParams
    );
    let total;

    let payments = [];

    if (searchTerm && searchTerm.trim().length > 0) {
      // Search mode
      const searchParams = [...queryParams];
      searchParams.push(`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`);

      payments = await query(
        `SELECT 
          p.*,
          d.name as driver_name,
          d.driver_number,
          t.customer_name,
          t.pickup_datetime,
          t.id as tour_booking_ref
        FROM payments p
        LEFT JOIN drivers d ON p.driver_id = d.id
        LEFT JOIN tours t ON p.tour_id = t.id
        WHERE ${whereClause} AND (p.id LIKE ? OR d.id LIKE ? OR t.customer_name LIKE ? OR p.status LIKE ?)
        ORDER BY p.created_at DESC 
        LIMIT ${limit} OFFSET ${offset}`,
        searchParams
      ) as any[];

      total = payments.length;
    } else if (startMonth && endMonth && startMonth.trim().length > 0 && endMonth.trim().length > 0) {
      if (!/^\d{4}-\d{2}$/.test(startMonth) || !/^\d{4}-\d{2}$/.test(endMonth)) {
        return NextResponse.json(
          { message: 'Invalid month format. Use YYYY-MM (e.g., 2025-12)' },
          { status: 400 }
        );
      }
      // Filter by date range mode
      // Calculate the last day of the endMonth properly
      const [endYear, endMonthNum] = endMonth.split('-').map(Number);
      const lastDayOfMonth = new Date(endYear, endMonthNum, 0).getDate();

      const dateRangeParams = [...queryParams];
      dateRangeParams.push(`${startMonth}-01 00:00:00`, `${endMonth}-${lastDayOfMonth} 23:59:59`);

      payments = await query(
        `SELECT 
          p.*,
          d.name as driver_name,
          d.driver_number,
          t.customer_name,
          t.pickup_datetime,
          t.id as tour_booking_ref
        FROM payments p
        LEFT JOIN drivers d ON p.driver_id = d.id
        LEFT JOIN tours t ON p.tour_id = t.id
        WHERE ${whereClause} AND (p.created_at BETWEEN ? AND ?)
        ORDER BY p.created_at DESC 
        LIMIT ${limit} OFFSET ${offset}`,
        dateRangeParams
      ) as any[];

      total = payments.length;
    } else {
      // Regular pagination mode
      payments = await query(
        `SELECT 
          p.*,
          d.name as driver_name,
          d.driver_number,
          t.customer_name,
          t.pickup_datetime,
          t.id as tour_booking_ref
        FROM payments p
        LEFT JOIN drivers d ON p.driver_id = d.id
        LEFT JOIN tours t ON p.tour_id = t.id
        WHERE ${whereClause}
        ORDER BY p.created_at DESC 
        LIMIT ${pageSize} OFFSET ${offset}`,
        queryParams
      ) as any[];

      total = totalResult?.total || 0;
    }

    // Format timestamps
    const formattedPayments = payments.map(payment => ({
      ...payment,
      created_at: formatToIST(payment.created_at),
      updated_at: formatToIST(payment.updated_at),
      paid_at: payment.paid_at ? formatToIST(payment.paid_at) : null
    }));

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / pageSize);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    // Avoid logging if searchTerm is not empty
    if (searchTerm.trim().length === 0) {
      // 🔥 LOG AUDIT ACTIVITY - DRIVER PAYMENTS RETRIEVAL
      await auditLogger.logReadMultiple(SYSCONFIG.ENTITY_TYPE_PAYMENT, formattedPayments.map(p => p.id), SYSCONFIG.SUCCESS, {
        filter: { searchTerm, driver_id },
        result_count: formattedPayments.length
      });
    }

    return NextResponse.json({
      data: formattedPayments,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasNextPage,
        hasPreviousPage
      }
    });

  } catch (error: any) {
    console.error('Driver payments error:', error);
    return NextResponse.json(
      { message: 'Failed to get driver payments', error: error.message },
      { status: 500 }
    );
  }
}
