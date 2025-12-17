import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { getUserFromToken } from '@/lib/auth';
import { generateUniqueDriverId } from '@/lib/id-generator';
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

interface RegisterDriverRequest {
  driver_number: string;
  name: string;
  languages: string[];
  vehicle_type: string;
  vehicle_plate: string;
  created_by?: string;
  status?: string;
}

export async function POST(request: NextRequest) {
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

    const body: RegisterDriverRequest = await request.json();

    // Validate required fields
    if (!body.driver_number || !body.name || !body.languages || !body.vehicle_type || !body.vehicle_plate) {
      return NextResponse.json(
        { message: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate languages array
    if (!Array.isArray(body.languages) || body.languages.length === 0) {
      return NextResponse.json(
        { message: 'Languages must be a non-empty array' },
        { status: 400 }
      );
    }

    // Generate unique driver ID
    const driverId = await generateUniqueDriverId();
    const languagesJson = JSON.stringify(body.languages);
    const complaintsJson = JSON.stringify([]);

    // Insert driver into database
    const result = await query(
      `INSERT INTO drivers (
        id, driver_number, name, languages, vehicle_type, 
        vehicle_plate, complaints, created_by, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        driverId,
        body.driver_number,
        body.name,
        languagesJson,
        body.vehicle_type,
        body.vehicle_plate,
        complaintsJson,
        user.id || null,
        body.status || 'Inactive'
      ]
    );

    const driver = await queryOne(
      `SELECT * FROM drivers WHERE id = ?`, 
      [driverId]
    );

    // 🔥 LOG AUDIT ACTIVITY - DRIVER REGISTRATION
    await auditLogger.logCreate(SYSCONFIG.ENTITY_TYPE_DRIVER, driver.id, driver, SYSCONFIG.SUCCESS, {
      change_type: 'driver_registration',
    });

    return NextResponse.json(
      { message: 'Driver registered successfully'},
      { status: 201 }
    );

  } catch (error: any) {
    console.error('Driver registration error:', error);

    // Handle duplicate driver_number
    if (error.code === 'ER_DUP_ENTRY') {
      return NextResponse.json(
        { message: 'Driver number already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { message: 'Failed to register driver' },
      { status: 500 }
    );
  }
}
