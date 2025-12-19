import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { getUserFromToken } from '@/lib/auth';
import { formatToIST } from '@/lib/utils';
import { SYSCONFIG } from '@/lib/utils';
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

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.substring(7);
    const user = await getUserFromToken(token!);

    if (!user || !(user.role === SYSCONFIG.ADMINISTRATOR || user.role === SYSCONFIG.OPERATIONS)) {
      return NextResponse.json({ message: 'Unauthorized access!' }, { status: 403 });
    }

    // Initialize audit logger
    const auditLogger = new AuditLogger({
      id: user.id,
      name: user.full_name || user.email,
      role: user.role,
    });

    const driver = await queryOne(`SELECT * FROM drivers WHERE id = ?`, [params.id]);

    if (!driver) {
      return NextResponse.json({ message: 'Driver not found' }, { status: 404 });
    }

    driver.created_at = formatToIST(driver.created_at);
    driver.updated_at = formatToIST(driver.updated_at);

    // 🔥 LOG AUDIT ACTIVITY - DRIVER INFO RETRIEVAL
    await auditLogger.logRead(SYSCONFIG.ENTITY_TYPE_DRIVER, driver.id);

    return NextResponse.json(driver);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.substring(7);
    const user = await getUserFromToken(token!);

    if (!user || !(user.role === SYSCONFIG.ADMINISTRATOR)) {
      return NextResponse.json({ message: 'Unauthorized access!' }, { status: 403 });
    }

    // Initialize audit logger
    const auditLogger = new AuditLogger({
      id: user.id,
      name: user.full_name || user.email,
      role: user.role,
    });

    const data = await request.json();
    const { name, languages, vehicle_type, vehicle_plate, status } = data;

    const old_data = await queryOne(`SELECT * FROM drivers WHERE id = ?`, [params.id]);

    if (!old_data) {
      return NextResponse.json({ message: 'Driver not found' }, { status: 404 });
    }

    await query(
      `UPDATE drivers 
       SET name = ?, languages = ?, vehicle_type = ?, vehicle_plate = ?, status = ? 
       WHERE id = ?`,
      [name, JSON.stringify(languages), vehicle_type, vehicle_plate, status, params.id]
    );

    const driver = await queryOne(`SELECT * FROM drivers WHERE id = ?`, [params.id]);

    // 🔥 LOG AUDIT ACTIVITY - DRIVER UPDATE
    await auditLogger.logUpdate(SYSCONFIG.ENTITY_TYPE_DRIVER, driver.id, old_data, driver, SYSCONFIG.SUCCESS, {
      change_type: 'driver_update',
      updated_fields: Object.keys(data),
    });

    return NextResponse.json(driver);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.substring(7);
    const user = await getUserFromToken(token!);

    if (!user || !(user.role === SYSCONFIG.ADMINISTRATOR)) {
      return NextResponse.json({ message: 'Unauthorized access!' }, { status: 403 });
    }

    // Initialize audit logger
    const auditLogger = new AuditLogger({
      id: user.id,
      name: user.full_name || user.email,
      role: user.role,
    });

    // Check if driver exists
    const driver = await queryOne(`SELECT * FROM drivers WHERE id = ?`, [params.id]);

    if (!driver) {
      return NextResponse.json({ message: 'Driver not found' }, { status: 404 });
    }

    // check for dependencies (e.g., assigned trips) before deletion
    const assignedTrips = await query(
      `SELECT * FROM assignments WHERE driver_id = ? AND status = ?`,
      [params.id, SYSCONFIG.ASSIGNMENT_ONGOING]
    ) as any[];

    if (assignedTrips.length > 0) {
      return NextResponse.json(
        { message: 'Cannot delete driver with assigned or in-progress trips' },
        { status: 400 }
      );
    }

    // Proceed to delete the driver

    const result = await query(`DELETE FROM drivers WHERE id = ?`, [params.id]) as any;

    // Check if deletion was successful
    if (result.affectedRows === 0) {
      return NextResponse.json({ message: 'Failed to delete driver' }, { status: 500 });
    }

    // 🔥 LOG AUDIT ACTIVITY - DRIVER DELETION
    await auditLogger.logDelete(SYSCONFIG.ENTITY_TYPE_DRIVER, driver.id, driver, SYSCONFIG.SUCCESS, {
      reason: 'manual_deletion',
    });

    return NextResponse.json({ message: 'Driver deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
