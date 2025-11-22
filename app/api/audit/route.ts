import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { getUserFromToken } from '@/lib/auth';
import { formatToIST, SYSCONFIG } from '@/lib/utils';
import { AuditLogger } from '@/lib/activity-logger.server';

export async function GET(request: NextRequest) {
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

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const entity_type = searchParams.get('entity_type');
    const action = searchParams.get('action');
    const user_id = searchParams.get('user_id');
    const entity_id = searchParams.get('entity_id');
    const date_from = searchParams.get('date_from');
    const date_to = searchParams.get('date_to');

    // Validate pagination parameters
    if (page < 1 || pageSize < 1 || pageSize > 100) {
      return NextResponse.json(
        { message: 'Invalid pagination parameters. Page must be >= 1 and pageSize between 1-100' },
        { status: 400 }
      );
    }

    // Calculate offset
    const offset = (page - 1) * pageSize;

    // Build WHERE conditions
    const whereConditions: string[] = [];
    const queryParams: any[] = [];

    if (entity_type) {
      whereConditions.push('entity_type = ?');
      queryParams.push(entity_type);
    }

    if (action) {
      whereConditions.push('action LIKE ?');
      queryParams.push(`%${action}%`);
    }

    if (user_id) {
      whereConditions.push('user_id = ?');
      queryParams.push(user_id);
    }

    if (entity_id) {
      whereConditions.push('entity_id = ?');
      queryParams.push(entity_id);
    }

    if (date_from) {
      whereConditions.push('DATE(created_at) >= ?');
      queryParams.push(date_from);
    }

    if (date_to) {
      whereConditions.push('DATE(created_at) <= ?');
      queryParams.push(date_to);
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
        entity_type,
        action,
        user_id,
        entity_id,
        date_from,
        date_to
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