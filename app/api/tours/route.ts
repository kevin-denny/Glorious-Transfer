import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { getUserFromToken } from "@/lib/auth";
import { formatToIST, SYSCONFIG } from "@/lib/utils";
import { AuditLogger } from "@/lib/activity-logger.server";

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

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.substring(7);
    const user = await getUserFromToken(token!);

    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Initialize audit logger
    const auditLogger = new AuditLogger({
      id: user.id,
      name: user.full_name || user.email,
      role: user.role,
    });

    // Get search term and pagination from body
    const body = await request.json();
    const { searchTerm = '', limit = 15, page = 1, pageSize = 10, startDate, endDate } = body;

    // Validate pagination parameters
    if (page < 1 || pageSize < 1 || pageSize > 100) {
      return NextResponse.json(
        {
          message:
            "Invalid pagination parameters. Page must be >= 1 and pageSize between 1-100",
        },
        { status: 400 }
      );
    }

    // Calculate offset
    const offset = (page - 1) * pageSize;

    // Get total count
    const totalResult = await queryOne<{ total: number }>(
      `SELECT COUNT(*) as total FROM tours`
    );
    let total;

    let tours: any[] = [];
    // Get paginated tours with assignment details
    if (startDate && endDate && searchTerm && searchTerm.trim().length > 0) {
      // Filter by date with pickup_datetime priority, fallback to arrival_datetime
      const dateFilterQuery = `
        SELECT 
          t.*,
          a.id as assignment_id,
          a.assigned_at,
          a.assigned_by,
          d.id as driver_id,
          d.name as driver_name,
          d.driver_number as driver_number,
          d.vehicle_type as driver_vehicle_type,
          d.vehicle_plate as driver_vehicle_plate
        FROM tours t
        LEFT JOIN assignments a ON t.id = a.tour_id
        LEFT JOIN drivers d ON a.driver_id = d.id
        WHERE (
          (t.pickup_datetime IS NOT NULL AND DATE(t.pickup_datetime) >= ? AND DATE(t.pickup_datetime) <= ?)
          OR 
          (t.pickup_datetime IS NULL AND t.arrival_datetime IS NOT NULL AND DATE(t.arrival_datetime) >= ? AND DATE(t.arrival_datetime) <= ?)
        ) AND (t.id LIKE ? OR t.customer_name LIKE ? OR t.agent LIKE ? OR t.agent_ref LIKE ? OR t.status LIKE ?)
        ORDER BY COALESCE(t.pickup_datetime, t.arrival_datetime) DESC, t.created_at DESC 
        LIMIT ${pageSize} OFFSET ${offset}
      `;

      // Get total count for date range
      const totalDateResult = await queryOne<{ total: number }>(`
        SELECT COUNT(*) as total FROM tours t
        WHERE (
          (t.pickup_datetime IS NOT NULL AND DATE(t.pickup_datetime) >= ? AND DATE(t.pickup_datetime) <= ?)
          OR 
          (t.pickup_datetime IS NULL AND t.arrival_datetime IS NOT NULL AND DATE(t.arrival_datetime) >= ? AND DATE(t.arrival_datetime) <= ?)
        )
      `, [startDate, endDate, startDate, endDate]);

      const queryResult = await query(dateFilterQuery, [startDate, endDate, startDate, endDate, `%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`]);
      tours = Array.isArray(queryResult) ? queryResult : [];
      total = totalDateResult?.total || 0;
    } else if (startDate && endDate) {
      // Filter by date with pickup_datetime priority, fallback to arrival_datetime
      const dateFilterQuery = `
        SELECT 
          t.*,
          a.id as assignment_id,
          a.assigned_at,
          a.assigned_by,
          d.id as driver_id,
          d.name as driver_name,
          d.driver_number as driver_number,
          d.vehicle_type as driver_vehicle_type,
          d.vehicle_plate as driver_vehicle_plate
        FROM tours t
        LEFT JOIN assignments a ON t.id = a.tour_id
        LEFT JOIN drivers d ON a.driver_id = d.id
        WHERE (
          (t.pickup_datetime IS NOT NULL AND DATE(t.pickup_datetime) >= ? AND DATE(t.pickup_datetime) <= ?)
          OR 
          (t.pickup_datetime IS NULL AND t.arrival_datetime IS NOT NULL AND DATE(t.arrival_datetime) >= ? AND DATE(t.arrival_datetime) <= ?)
        )
        ORDER BY COALESCE(t.pickup_datetime, t.arrival_datetime) DESC, t.created_at DESC 
        LIMIT ${pageSize} OFFSET ${offset}
      `;

      // Get total count for date range
      const totalDateResult = await queryOne<{ total: number }>(`
        SELECT COUNT(*) as total FROM tours t
        WHERE (
          (t.pickup_datetime IS NOT NULL AND DATE(t.pickup_datetime) >= ? AND DATE(t.pickup_datetime) <= ?)
          OR 
          (t.pickup_datetime IS NULL AND t.arrival_datetime IS NOT NULL AND DATE(t.arrival_datetime) >= ? AND DATE(t.arrival_datetime) <= ?)
        )
      `, [startDate, endDate, startDate, endDate]);

      const queryResult = await query(dateFilterQuery, [startDate, endDate, startDate, endDate]);
      tours = Array.isArray(queryResult) ? queryResult : [];
      total = totalDateResult?.total || 0;
    } else if (searchTerm && searchTerm.trim().length > 0) {
      const queryResult = await query(`
        SELECT 
          t.*,
          a.id as assignment_id,
          a.assigned_at,
          a.assigned_by,
          d.id as driver_id,
          d.name as driver_name,
          d.driver_number as driver_number,
          d.vehicle_type as driver_vehicle_type,
          d.vehicle_plate as driver_vehicle_plate
        FROM tours t
        LEFT JOIN assignments a ON t.id = a.tour_id
        LEFT JOIN drivers d ON a.driver_id = d.id
        WHERE t.id LIKE ? OR t.customer_name LIKE ? OR t.agent LIKE ? OR t.agent_ref LIKE ? OR t.status LIKE ?
        ORDER BY t.created_at DESC 
        LIMIT ${limit} OFFSET ${offset}
      `, [`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`]);
      tours = Array.isArray(queryResult) ? queryResult : [];
      total = tours.length;
    } else {
      const queryResult = await query(`
        SELECT 
          t.*,
          a.id as assignment_id,
          a.assigned_at,
          a.assigned_by,
          d.id as driver_id,
          d.name as driver_name,
          d.driver_number as driver_number,
          d.vehicle_type as driver_vehicle_type,
          d.vehicle_plate as driver_vehicle_plate
        FROM tours t
        LEFT JOIN assignments a ON t.id = a.tour_id
        LEFT JOIN drivers d ON a.driver_id = d.id
        ORDER BY t.created_at DESC 
        LIMIT ${pageSize} OFFSET ${offset}
      `);
      tours = Array.isArray(queryResult) ? queryResult : [];
      total = totalResult?.total || 0;
    }

    // Format timestamps and structure assignment data for all tours
    const formattedTours = Array.isArray(tours) ? tours.map((tour) => ({
      id: tour.id,
      booking_date: formatToIST(tour.booking_date).split(" ")[0],
      customer_name: tour.customer_name,
      agent: tour.agent,
      pax: tour.pax,
      category: tour.category,
      contact_details: tour.contact_details,
      arrival_datetime: tour.arrival_datetime ? formatToIST(tour.arrival_datetime) : null,
      departure_datetime: tour.departure_datetime ? formatToIST(tour.departure_datetime) : null,
      pickup_datetime: tour.pickup_datetime ? formatToIST(tour.pickup_datetime) : null,
      flight_no: tour.flight_no,
      remarks: tour.remarks,
      status: tour.status,
      created_at: formatToIST(tour.created_at),
      updated_at: formatToIST(tour.updated_at),
      pickup: tour.pickup,
      destination: tour.destination,
      amount: tour.amount,
      currency: tour.currency,
      agent_ref: tour.agent_ref,
      complaints: tour.complaints,
      assignment: tour.assignment_id
        ? {
          id: tour.assignment_id,
          assigned_at: formatToIST(tour.assigned_at),
          assigned_by: tour.assigned_by,
          driver: {
            id: tour.driver_id,
            name: tour.driver_name,
            phone: tour.driver_number,
            vehicle_type: tour.driver_vehicle_type,
            vehicle_number: tour.driver_vehicle_plate,
          },
        }
        : null,
    })) : [];

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / pageSize);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    // avoid logging if searchTerm is not empty
    if (searchTerm.trim().length === 1) {
      // 🔥 LOG AUDIT ACTIVITY - TOURS LIST RETRIEVAL
      await auditLogger.logReadMultiple(SYSCONFIG.ENTITY_TYPE_TOUR, formattedTours.map(t => t.id), SYSCONFIG.SUCCESS, {
        filter: searchTerm ? { searchTerm } : {},
        result_count: formattedTours.length,
      });
    }

    return NextResponse.json({
      data: formattedTours,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasNextPage,
        hasPreviousPage,
      },
    });
  } catch (error: any) {
    console.error('Trips fetch error:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
