import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { getUserFromToken } from '@/lib/auth';
import { formatToIST, SYSCONFIG } from '@/lib/utils';
import { AuditLogger } from '@/lib/activity-logger.server';

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
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

    const paymentId = params.id;
    const body = await request.json();
    const { amount, status, paid_amount, currency, type } = body;

    // Check if payment exists
    const existingPayment = await queryOne(
      'SELECT * FROM payments WHERE id = ?',
      [paymentId]
    );

    if (!existingPayment) {
      return NextResponse.json(
        { message: 'Payment not found' },
        { status: 404 }
      );
    }

    // Validate amount if provided
    if (amount !== undefined && amount <= 0) {
      return NextResponse.json(
        { message: 'Amount must be greater than 0' },
        { status: 400 }
      );
    }

    // Set paid_at timestamp if status is changing to Completed
    let paid_at = existingPayment.paid_at;
    if (status === 'Completed' && existingPayment.status !== 'Completed') {
      // Convert to MySQL datetime format (YYYY-MM-DD HH:MM:SS)
      const now = new Date();
      paid_at = now.toISOString().slice(0, 19).replace('T', ' ');
    }

    // Prepare update values, replacing undefined with existing values
    const updateAmount = amount !== undefined ? amount : existingPayment.amount;
    let updateStatus = status !== undefined ? status : existingPayment.status;
    const updateCurrency = currency !== undefined ? currency : existingPayment.currency;
    const updateType = type !== undefined ? type : existingPayment.type;

    // Calculate paid amount - add new payment to existing paid amount
    let updatePaidAmount: number;
    if (paid_amount !== undefined) {
      // Add the new paid_amount to the existing paid_amount
      updatePaidAmount = parseFloat(paid_amount) + parseFloat(existingPayment.paid_amount || 0);
    } else {
      // Keep existing paid_amount if not provided
      updatePaidAmount = existingPayment.paid_amount;
    }

    // if tour_payment, if status is Confirmed, change to Confirmed
    if (updateType === SYSCONFIG.PAYMENT_TYPE_TOUR && updateStatus === SYSCONFIG.CONFIRMED) {
      updateStatus = SYSCONFIG.CONFIRMED;
      updatePaidAmount = existingPayment.amount; // set paid amount to total amount
      // Set paid_at timestamp
      const now = new Date();
      paid_at = now.toISOString().slice(0, 19).replace('T', ' ');
    } else if(updateType === SYSCONFIG.PAYMENT_TYPE_DRIVER) {
      // Auto-calculate status based on paid amount vs total amount
      if (updatePaidAmount >= updateAmount) {
        updateStatus = SYSCONFIG.COMPLETED;
      } else if (updatePaidAmount > 0 && updatePaidAmount < updateAmount) {
        updateStatus = SYSCONFIG.PARTIAL;
      } else if (updatePaidAmount === 0) {
        updateStatus = SYSCONFIG.PENDING;
      }
    }

    // Update payment
    await query(
      `UPDATE payments SET 
        amount = ?,
        status = ?,
        paid_amount = ?,
        currency = ?,
        type = ?,
        paid_at = ?,
        updated_by = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [updateAmount, updateStatus, updatePaidAmount, updateCurrency, updateType, paid_at, user.id, paymentId]
    );

    // Get updated payment with related data
    const updatedPayment = await queryOne(
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

    // 🔥 LOG AUDIT ACTIVITY - PAYMENT UPDATE
    await auditLogger.logUpdate(SYSCONFIG.ENTITY_TYPE_PAYMENT, paymentId, existingPayment, updatedPayment, SYSCONFIG.SUCCESS, {
      change_type: 'payment_update',
      updated_fields: Object.keys(body)
    });

    return NextResponse.json({
      message: 'Payment updated successfully',
      payment: {
        ...updatedPayment,
        created_at: formatToIST(updatedPayment.created_at),
        updated_at: formatToIST(updatedPayment.updated_at),
        paid_at: updatedPayment.paid_at ? formatToIST(updatedPayment.paid_at) : null
      }
    });

  } catch (error: any) {
    console.error('Payment update error:', error);
    return NextResponse.json(
      { message: 'Failed to update payment', error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.substring(7);
    const user = await getUserFromToken(token!);

    if (!user || user.role !== SYSCONFIG.ADMINISTRATOR) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
    }

    // Initialize audit logger
    const auditLogger = new AuditLogger({
      id: user.id,
      name: user.full_name || user.email,
      role: user.role,
    });

    const paymentId = params.id;

    // Check if payment exists
    const payment = await queryOne(
      `SELECT 
        p.*,
        d.name as driver_name,
        t.customer_name
      FROM payments p
      LEFT JOIN drivers d ON p.driver_id = d.id
      LEFT JOIN tours t ON p.tour_id = t.id
      WHERE p.id = ?`,
      [paymentId]
    );

    if (!payment) {
      return NextResponse.json(
        { message: 'Payment not found' },
        { status: 404 }
      );
    }

    // Delete payment
    const result: any = await query(
      'DELETE FROM payments WHERE id = ?',
      [paymentId]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { message: 'Failed to delete payment' },
        { status: 500 }
      );
    }

    // 🔥 LOG AUDIT ACTIVITY - PAYMENT DELETION
    await auditLogger.logDelete(SYSCONFIG.ENTITY_TYPE_PAYMENT, paymentId, payment, SYSCONFIG.SUCCESS, {
      reason: 'manual_deletion',
      driver_name: payment.driver_name,
      customer_name: payment.customer_name
    });

    return NextResponse.json({
      message: 'Payment deleted successfully',
      deletedPayment: {
        id: paymentId,
        driver_name: payment.driver_name,
        customer_name: payment.customer_name,
        amount: payment.amount
      }
    });

  } catch (error: any) {
    console.error('Payment deletion error:', error);
    return NextResponse.json(
      { message: 'Failed to delete payment', error: error.message },
      { status: 500 }
    );
  }
}
