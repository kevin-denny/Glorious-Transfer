import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { getUserFromToken } from '@/lib/auth';
import { formatToIST, SYSCONFIG } from '@/lib/utils';
import { generateUniquePaymentId } from '@/lib/id-generator';
import { AuditLogger } from '@/lib/activity-logger.server';

export const dynamic = 'force-dynamic';

interface CreatePaymentRequest {
  driver_id?: string;
  tour_id: string;
  amount: number;
  currency?: string;
  type: string;
  status?: string;
}

export async function GET(request: NextRequest) {
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

    // Get payments summary
    const [pendingPayments, totalDriverPayments, totalTourPayments, recentPayments] = await Promise.all([
      // Pending payments count and amount
      queryOne(`
        SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total_amount 
        FROM payments 
        WHERE status = 'Pending'
      `),
      
      // Total driver payments (completed)
      queryOne(`
        SELECT COUNT(*) as count, COALESCE(SUM(paid_amount), 0) as total_amount 
        FROM payments 
        WHERE status = 'Completed' AND type = 'driver_payment'
      `),
      
      // Total tour payments
      queryOne(`
        SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total_amount 
        FROM payments 
        WHERE status = 'Completed'
      `),
      
      // Recent payments (last 10)
      query(`
        SELECT 
          p.*,
          d.name as driver_name,
          t.customer_name,
          t.id as tour_booking_ref
        FROM payments p
        LEFT JOIN drivers d ON p.driver_id = d.id
        LEFT JOIN tours t ON p.tour_id = t.id
        ORDER BY p.created_at DESC 
        LIMIT 10
      `)
    ]);

    const formattedRecentPayments = (recentPayments as any[]).map(payment => ({
      ...payment,
      created_at: formatToIST(payment.created_at),
      updated_at: formatToIST(payment.updated_at),
      paid_at: payment.paid_at ? formatToIST(payment.paid_at) : null
    }));

    const summary = {
      pending_payments: {
        count: pendingPayments?.count || 0,
        total_amount: parseFloat(pendingPayments?.total_amount || 0)
      },
      driver_payments: {
        count: totalDriverPayments?.count || 0,
        total_amount: parseFloat(totalDriverPayments?.total_amount || 0)
      },
      tour_payments: {
        count: totalTourPayments?.count || 0,
        total_amount: parseFloat(totalTourPayments?.total_amount || 0)
      },
      recent_payments: formattedRecentPayments
    };

    // 🔥 LOG AUDIT ACTIVITY - PAYMENT SUMMARY RETRIEVAL
    await auditLogger.logRead(SYSCONFIG.ENTITY_TYPE_PAYMENT, 'summary', SYSCONFIG.SUCCESS, summary);

    return NextResponse.json({ summary });

  } catch (error: any) {
    console.error('Payment summary error:', error);
    return NextResponse.json(
      { message: 'Failed to get payment summary', error: error.message },
      { status: 500 }
    );
  }
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

    const body: CreatePaymentRequest = await request.json();
    let driver: any = null;

    // Validate required fields
    if (!body.tour_id || !body.amount || !body.type) {
      return NextResponse.json(
        { message: 'Missing required fields: tour_id, amount, type' },
        { status: 400 }
      );
    }

    // Validate amount
    if (body.amount <= 0) {
      return NextResponse.json(
        { message: 'Amount must be greater than 0' },
        { status: 400 }
      );
    }

    // Validate type
    const validTypes = ['tour_payment', 'driver_payment'];
    if (!validTypes.includes(body.type)) {
      return NextResponse.json(
        { message: 'Invalid payment type. Must be: tour_payment or driver_payment' },
        { status: 400 }
      );
    }

    // Only validate driver_id for driver_payment type
    if (body.type === 'driver_payment') {
      if (!body.driver_id) {
        return NextResponse.json(
          { message: 'driver_id is required for driver_payment type' },
          { status: 400 }
        );
      }

      // Verify driver exists
      driver = await queryOne(
        'SELECT id, name FROM drivers WHERE id = ?',
        [body.driver_id]
      );

      if (!driver) {
        return NextResponse.json(
          { message: 'Driver not found' },
          { status: 404 }
        );
      }
    }

    // Verify tour exists
    const tour = await queryOne(
      'SELECT id, customer_name FROM tours WHERE id = ?',
      [body.tour_id]
    );

    if (!tour) {
      return NextResponse.json(
        { message: 'Tour not found' },
        { status: 404 }
      );
    }

    // For tour_payment, check if payment already exists for this tour-type combination
    // For driver_payment, check if payment already exists for this tour-driver-type combination
    let existingPaymentQuery;
    let existingPaymentParams;

    if (body.type === 'tour_payment') {
      existingPaymentQuery = 'SELECT id FROM payments WHERE tour_id = ? AND type = ?';
      existingPaymentParams = [body.tour_id, body.type];
    } else {
      existingPaymentQuery = 'SELECT id FROM payments WHERE driver_id = ? AND tour_id = ? AND type = ?';
      existingPaymentParams = [body.driver_id, body.tour_id, body.type];
    }

    const existingPayment = await queryOne(existingPaymentQuery, existingPaymentParams);

    if (existingPayment) {
      return NextResponse.json(
        { message: `Payment of type '${body.type}' already exists for this ${body.type === 'tour_payment' ? 'tour' : 'tour-driver combination'}` },
        { status: 409 }
      );
    }

    // Generate unique payment ID
    const paymentId = await generateUniquePaymentId();

    // Insert payment (driver_id can be null for tour_payment)
    await query(
      `INSERT INTO payments (
        id, driver_id, tour_id, amount, currency, type, 
        status, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        paymentId,
        body.driver_id || null, // null for tour_payment
        body.tour_id,
        body.amount,
        body.currency || 'USD',
        body.type,
        body.status || 'Pending',
        user.id
      ]
    );

    const payment = await queryOne(
      `SELECT 
        p.*,
        d.name as driver_name,
        t.customer_name,
        t.id as tour_booking_ref
      FROM payments p
      LEFT JOIN drivers d ON p.driver_id = d.id
      LEFT JOIN tours t ON p.tour_id = t.id
      WHERE p.id = ?`,
      [paymentId]
    );

    // 🔥 LOG AUDIT ACTIVITY - PAYMENT CREATION
    const auditData = {
      change_type: 'payment_creation',
      tour_id: tour.id,
      customer_name: tour.customer_name,
      driver_id: body.driver_id || null,
      driver_name: driver ? driver.name : null
    };

    await auditLogger.logCreate(SYSCONFIG.ENTITY_TYPE_PAYMENT, payment.id, payment, SYSCONFIG.SUCCESS, auditData);

    return NextResponse.json(
      {
        message: 'Payment created successfully',
        payment: {
          ...payment,
          created_at: formatToIST(payment.created_at),
          updated_at: formatToIST(payment.updated_at)
        }
      },
      { status: 201 }
    );

  } catch (error: any) {
    console.error('Payment creation error:', error);
    return NextResponse.json(
      { message: 'Failed to create payment', error: error.message },
      { status: 500 }
    );
  }
}
