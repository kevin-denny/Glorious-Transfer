import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { getUserFromToken } from '@/lib/auth';
import { formatToIST, SYSCONFIG } from '@/lib/utils';
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

    // Get search term and pagination from body
    const body = await request.json();
    const { searchTerm = '', page = 1, pageSize = 10, tour_id, limit = 15, startMonth = '', endMonth = '' } = body;

    // Validate pagination parameters
    if (page < 1 || pageSize < 1 || pageSize > 100) {
      return NextResponse.json(
        { message: 'Invalid pagination parameters. Page must be >= 1 and pageSize between 1-100' },
        { status: 400 }
      );
    }

    // Calculate offset
    const offset = (page - 1) * pageSize;

    let whereClause = 'p.type = "tour_payment"';
    let queryParams: any[] = [];

    // Add tour filter if provided
    if (tour_id) {
      whereClause += ' AND p.tour_id = ?';
      queryParams.push(tour_id);
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
      searchParams.push(`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`);
      
      payments = await query(
        `SELECT 
          p.*,
          d.name as driver_name,
          d.driver_number,
          t.customer_name,
          t.agent,
          t.id as tour_booking_ref
        FROM payments p
        LEFT JOIN drivers d ON p.driver_id = d.id
        LEFT JOIN tours t ON p.tour_id = t.id
        WHERE ${whereClause} AND (p.id LIKE ? OR t.id LIKE ? OR t.customer_name LIKE ?)
        ORDER BY p.created_at DESC 
        LIMIT ${limit} OFFSET ${offset}`,
        searchParams
      ) as any[];
      
      total = payments.length;
    } else if(startMonth && endMonth && startMonth.trim().length > 0 && endMonth.trim().length > 0) {
      if(!/^\d{4}-\d{2}$/.test(startMonth) || !/^\d{4}-\d{2}$/.test(endMonth)) {
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
          t.agent,
          t.id as tour_booking_ref
        FROM payments p
        LEFT JOIN drivers d ON p.driver_id = d.id
        LEFT JOIN tours t ON p.tour_id = t.id
        WHERE ${whereClause} AND (p.created_at BETWEEN ? AND ?)
        ORDER BY p.created_at DESC 
        LIMIT ${pageSize} OFFSET ${offset}`,
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
          t.agent,
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
      // 🔥 LOG AUDIT ACTIVITY - TOUR PAYMENTS RETRIEVAL
      await auditLogger.logReadMultiple(SYSCONFIG.ENTITY_TYPE_PAYMENT, formattedPayments.map(p => p.id), SYSCONFIG.SUCCESS, {
        filter: { searchTerm, tour_id },
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
    console.error('Tour payments error:', error);
    return NextResponse.json(
      { message: 'Failed to get tour payments', error: error.message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
    try {
      const authHeader = request.headers.get('authorization');
      const token = authHeader?.substring(7);
      const user = await getUserFromToken(token!);
  
      if (!user) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
      }
  
      // Get all tours with id and customer_name for dropdown
      const tours = await query(
        `SELECT 
          id as tour_id, 
          customer_name,
          agent,
          status,
          pax
        FROM tours 
        WHERE status IN ('${SYSCONFIG.PENDING}', '${SYSCONFIG.ASSIIGNED}')
        ORDER BY created_at DESC`
      ) as any[];
  
      // Format for dropdown
      const formattedTours = tours.map(tour => ({
        value: tour.tour_id,
        label: `${tour.tour_id} - ${tour.customer_name}`,
        customer_name: tour.customer_name,
        agent: tour.agent,
        status: tour.status,
        pax: tour.pax
      }));
  
      return NextResponse.json({
        tours: formattedTours,
        count: formattedTours.length
      });
  
    } catch (error: any) {
      console.error('Tours dropdown error:', error);
      return NextResponse.json(
        { message: 'Failed to get tours dropdown', error: error.message },
        { status: 500 }
      );
    }
  }
