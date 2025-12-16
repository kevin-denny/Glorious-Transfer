import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { getUserFromToken } from '@/lib/auth';
import { formatToIST, SYSCONFIG } from '@/lib/utils';
import { AuditLogger } from '@/lib/activity-logger.server';

export const dynamic = 'force-dynamic';

interface ComplaintItem {
  tour_id: string;
  customer_name?: string;
  agent?: string;
  status?: string;
  booking_date?: string;
  complaint: string;
  created_at?: string;
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.substring(7);
    const user = await getUserFromToken(token!);

    if (!user || user.role !== SYSCONFIG.ADMINISTRATOR) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // Initialize audit logger
    const auditLogger = new AuditLogger({
      id: user.id,
      name: user.full_name || user.email,
      role: user.role,
    });

    const body = await request.json();
    const { driver_id } = body;

    // Validate driver_id
    if (!driver_id) {
      return NextResponse.json(
        { message: 'driver_id is required' },
        { status: 400 }
      );
    }

    // Check if driver exists
    const driver = await queryOne(
      'SELECT id, name, driver_number FROM drivers WHERE id = ?',
      [driver_id]
    );

    if (!driver) {
      return NextResponse.json(
        { message: 'Driver not found' },
        { status: 404 }
      );
    }

    // Get all tours with complaints for this driver
    const complaintsData = await query(
      `SELECT 
        t.id as tour_id,
        t.customer_name,
        t.complaints,
        t.booking_date,
        t.agent,
        t.status,
        t.created_at
      FROM tours t
      INNER JOIN assignments a ON t.id = a.tour_id
      WHERE a.driver_id = ? 
      AND t.complaints IS NOT NULL 
      AND t.complaints != '' 
      AND t.complaints != '[]'
      ORDER BY t.created_at DESC`,
      [driver_id]
    ) as any[];

    // Format the complaints data
    const formattedComplaints = complaintsData.map(complaint => {
      let parsedComplaints: string[] = [];
      
      try {
        // Try to parse complaints if it's JSON
        if (complaint.complaints && complaint.complaints.trim().startsWith('[')) {
          parsedComplaints = JSON.parse(complaint.complaints);
        } else if (complaint.complaints) {
          // If it's a plain string, wrap it in an array
          parsedComplaints = [complaint.complaints];
        }
      } catch (error) {
        // If parsing fails, treat as plain string
        parsedComplaints = complaint.complaints ? [complaint.complaints] : [];
      }

      return {
        tour_id: complaint.tour_id,
        customer_name: complaint.customer_name,
        agent: complaint.agent,
        status: complaint.status,
        booking_date: complaint.booking_date,
        complaints: parsedComplaints,
        created_at: formatToIST(complaint.created_at)
      };
    });

    // Collect all complaints into a flat array with explicit typing
    const allComplaints: ComplaintItem[] = [];
    formattedComplaints.forEach(item => {
      if (item.complaints && Array.isArray(item.complaints)) {
        item.complaints.forEach(complaint => {
          if (complaint && complaint.trim() !== '') {
            allComplaints.push({
              tour_id: item.tour_id,
            //   customer_name: item.customer_name,
            //   agent: item.agent,
            //   status: item.status,
            //   booking_date: item.booking_date,
              complaint: complaint,
            //   created_at: item.created_at
            });
          }
        });
      }
    });

    const response = {
    //   driver: {
    //     id: driver.id,
    //     name: driver.name,
    //     driver_number: driver.driver_number
    //   },
      total_complaints: allComplaints.length,
    //   total_tours_with_complaints: formattedComplaints.length,
      complaints: allComplaints
    };

    // 🔥 LOG AUDIT ACTIVITY - DRIVER COMPLAINTS RETRIEVAL
    await auditLogger.logRead(SYSCONFIG.ENTITY_TYPE_DRIVER, driver_id, SYSCONFIG.SUCCESS, {
      action: 'complaints_retrieval',
      total_complaints: allComplaints.length,
      total_tours: formattedComplaints.length
    });

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('Driver complaints error:', error);
    return NextResponse.json(
      { message: 'Failed to get driver complaints', error: error.message },
      { status: 500 }
    );
  }
}
