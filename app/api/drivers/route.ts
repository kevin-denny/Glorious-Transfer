import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { getUserFromToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.substring(7);
    const user = await getUserFromToken(token!);

    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const drivers = await query(
      `SELECT * FROM drivers ORDER BY created_at DESC`
    );

    return NextResponse.json(drivers);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.substring(7);
    const user = await getUserFromToken(token!);

    if (!user || user.role !== 'administrator') {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const data = await request.json();
    const { name, languages, vehicle_type, vehicle_plate, status = 'active' } = data;

    const result = await query<any>(
      `INSERT INTO drivers (name, languages, vehicle_type, vehicle_plate, status, created_by) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, JSON.stringify(languages), vehicle_type, vehicle_plate, status, user.id]
    );

    const driver = await queryOne(
      `SELECT * FROM drivers WHERE id = LAST_INSERT_ID()`
    );

    return NextResponse.json(driver, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
