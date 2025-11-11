import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { getUserFromToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.substring(7);
    const user = await getUserFromToken(token!);

    if (!user || user.role !== 'administrator') {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const data = await request.json();
    const { name, languages, vehicle_type, vehicle_plate, status } = data;

    await query(
      `UPDATE drivers 
       SET name = ?, languages = ?, vehicle_type = ?, vehicle_plate = ?, status = ? 
       WHERE id = ?`,
      [name, JSON.stringify(languages), vehicle_type, vehicle_plate, status, params.id]
    );

    const driver = await queryOne(`SELECT * FROM drivers WHERE id = ?`, [params.id]);

    return NextResponse.json(driver);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
