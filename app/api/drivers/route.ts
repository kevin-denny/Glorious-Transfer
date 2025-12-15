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

    // Get search term and pagination from body
    const body = await request.json();
    const { searchTerm = '', limit = 15, page = 1, pageSize = 10 } = body;

    // Validate pagination parameters
    if (page < 1 || pageSize < 1 || pageSize > 100) {
      return NextResponse.json(
        { message: 'Invalid pagination parameters. Page must be >= 1 and pageSize between 1-100' },
        { status: 400 }
      );
    }

    // Calculate offset
    const offset = (page - 1) * pageSize;

    // Get total count
    const totalResult = await queryOne<{ total: number }>(
      `SELECT COUNT(*) as total FROM drivers`
    );
    let total;
    
    let drivers = [];
    if(searchTerm && searchTerm.trim().length > 0) {
      // Get search results
      drivers = await query(
        `SELECT * FROM drivers 
        WHERE id LIKE ? OR name LIKE ? OR driver_number LIKE ? OR vehicle_plate LIKE ? OR status LIKE ?
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}`,
        [`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`]
      ) as any[];
      total = drivers.length;
    } else {
      // Get paginated drivers
      drivers = await query(
        `SELECT * FROM drivers ORDER BY created_at DESC LIMIT ${pageSize} OFFSET ${offset}`
      ) as any[];
      total = totalResult?.total || 0;
    }

    // Format timestamps for all drivers
    const formattedDrivers = drivers.map(driver => ({
      ...driver,
      created_at: formatToIST(driver.created_at),
      updated_at: formatToIST(driver.updated_at)
    }));

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / pageSize);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    // avoid logging if searchTerm is not empty
    if (searchTerm.trim().length === 1) {
      // 🔥 LOG AUDIT ACTIVITY - DRIVER LIST RETRIEVAL
      await auditLogger.logReadMultiple(SYSCONFIG.ENTITY_TYPE_DRIVER, formattedDrivers.map(d => d.id), SYSCONFIG.SUCCESS, {
        filter: searchTerm ? { searchTerm } : {},
        result_count: formattedDrivers.length,
      });
    }

    return NextResponse.json({
      data: formattedDrivers,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasNextPage,
        hasPreviousPage
      }
    });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}