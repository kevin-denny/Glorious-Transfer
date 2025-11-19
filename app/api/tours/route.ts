import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { getUserFromToken } from "@/lib/auth";
import { formatToIST } from "@/lib/utils";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.substring(7);
    const user = await getUserFromToken(token!);

    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Get search term and pagination from body
    const body = await request.json();
    const { searchTerm = '', limit = 15, page = 1, pageSize = 10 } = body;

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
    const total = totalResult?.total || 0;

    let tours = [];
    // Get paginated tours with assignment details
    if(searchTerm && searchTerm.trim().length > 0) {
      tours = (await query(`
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
        WHERE t.id LIKE ? OR t.customer_name LIKE ?
        ORDER BY t.created_at DESC 
        LIMIT ${limit}
      `, [`%${searchTerm}%`, `%${searchTerm}%`])) as any[];
    } else {
      tours = (await query(`
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
      `)) as any[];
    }

    // Format timestamps and structure assignment data for all tours
    const formattedTours = tours.map((tour) => ({
      id: tour.id,
      booking_date: formatToIST(tour.booking_date).split(" ")[0],
      customer_name: tour.customer_name,
      agent: tour.agent,
      pax: tour.pax,
      contact_details: tour.contact_details,
      arrival_datetime: formatToIST(tour.arrival_datetime),
      departure_datetime: formatToIST(tour.departure_datetime),
      flight_no: tour.flight_no,
      remarks: tour.remarks,
      status: tour.status,
      created_at: formatToIST(tour.created_at),
      updated_at: formatToIST(tour.updated_at),
      pickup: tour.pickup,
      destination: tour.destination,
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
    }));

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / pageSize);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

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
    console.error('Tours fetch error:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
