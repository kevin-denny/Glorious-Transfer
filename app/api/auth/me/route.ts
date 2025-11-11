import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const user = await getUserFromToken(token);

    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json(user);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
