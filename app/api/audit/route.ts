import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { getUserFromToken } from '@/lib/auth';
import { formatToIST, SYSCONFIG } from '@/lib/utils';
import { AuditLogger } from '@/lib/activity-logger.server';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.substring(7);
    const user = await getUserFromToken(token!);

    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // Initialize audit logger
    const auditLogger = new AuditLogger({
      id: user.id,
      name: user.full_name || user.email,
      role: user.role,
    });

    // Get parameters from request body
    const body = await request.json();
    const page = parseInt(body.page || '1');
    const pageSize = parseInt(body.pageSize || '20');
    const searchTerm = body.searchTerm || '';

    // Validate pagination parameters
    if (page < 1 || pageSize < 1 || pageSize > 100) {
      return NextResponse.json(
        { message: 'Invalid pagination parameters. Page must be >= 1 and pageSize between 1-100' },
        { status: 400 }
      );
    }

    // Calculate offset
    const offset = (page - 1) * pageSize;

    // Build WHERE conditions for search
    const whereConditions: string[] = [];
    const queryParams: any[] = [];

    if (searchTerm) {
      whereConditions.push('(user_name LIKE ? OR action LIKE ? OR entity_type LIKE ? OR user_id LIKE ?)');
      queryParams.push(`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`);
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    // Get total count
    const totalResult = await queryOne<{ total: number }>(
      `SELECT COUNT(*) as total FROM activity_logs ${whereClause}`,
      queryParams
    );
    const total = totalResult?.total || 0;

    // Get paginated audit logs
    const auditLogs = await query(
      `SELECT * FROM activity_logs ${whereClause} 
       ORDER BY created_at DESC 
       LIMIT ${pageSize} OFFSET ${offset}`,
      queryParams
    ) as any[];

    // Format the audit logs
    const formattedAuditLogs = auditLogs.map(log => ({
      ...log,
      created_at: formatToIST(log.created_at),
      details: typeof log.details === 'string' ? JSON.parse(log.details) : log.details
    }));

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / pageSize);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    // 🔥 LOG AUDIT ACTIVITY - AUDIT LOGS RETRIEVAL (MULTIPLE)
    await auditLogger.logReadMultiple(SYSCONFIG.ENTITY_TYPE_ACTIVITY_LOG, formattedAuditLogs.map(log => log.id), SYSCONFIG.SUCCESS);

    return NextResponse.json({
      data: formattedAuditLogs,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasNextPage,
        hasPreviousPage
      },
      filters: {
        searchTerm
      }
    });

  } catch (error: any) {
    console.error('Get audit logs error:', error);
    return NextResponse.json(
      { message: 'Failed to get audit logs', error: error.message },
      { status: 500 }
    );
  }
}