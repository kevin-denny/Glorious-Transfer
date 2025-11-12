import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { getUserFromToken } from '@/lib/auth';

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