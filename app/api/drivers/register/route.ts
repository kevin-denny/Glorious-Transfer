import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { randomUUID } from 'crypto';
import { getUserFromToken } from '@/lib/auth';

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

    if (!user || user.role !== 'administrator') {
      return NextResponse.json({ message: 'Unauthorized request!' }, { status: 403 });
    }

    const body: RegisterDriverRequest = await request.json();

    // Validate required fields
    if (!body.driver_number || !body.name || !body.languages || !body.vehicle_type || !body.vehicle_plate) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate languages array
    if (!Array.isArray(body.languages) || body.languages.length === 0) {
      return NextResponse.json(
        { error: 'Languages must be a non-empty array' },
        { status: 400 }
      );
    }

    const driverId = randomUUID();
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

    return NextResponse.json(driver, { status: 201 });

  } catch (error: any) {
    console.error('Driver registration error:', error);

    // Handle duplicate driver_number
    if (error.code === 'ER_DUP_ENTRY') {
      return NextResponse.json(
        { error: 'Driver number already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to register driver' },
      { status: 500 }
    );
  }
}
