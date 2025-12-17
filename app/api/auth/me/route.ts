import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { AuditLogger } from '@/lib/activity-logger.server';
import { SYSCONFIG } from '@/lib/utils';

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

    // Initialize audit logger
    const auditLogger = new AuditLogger({
      id: user.id,
      name: user.full_name || user.email,
      role: user.role,
    });

    // 🔥 LOG AUDIT ACTIVITY - USER INFO RETRIEVAL
    await auditLogger.logRead(SYSCONFIG.ENTITY_TYPE_USER, user.id);

    return NextResponse.json(user);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
