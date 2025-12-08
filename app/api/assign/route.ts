import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { getUserFromToken } from "@/lib/auth";
import { generateUniqueAssignmentId, generateUniquePaymentId } from "@/lib/id-generator";
import { SYSCONFIG, formatToIST } from "@/lib/utils";
import { AuditLogger } from "@/lib/activity-logger.server";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.substring(7);
    const user = await getUserFromToken(token!);

    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // initialize audit logger (server-side)
    const auditLogger = new AuditLogger({
      id: user.id,
      name: user.full_name || user.email,
      role: user.role,
    });

    // Get pagination parameters from query string
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');
    const status = searchParams.get('status'); // Filter by tour status
    const driver_id = searchParams.get('driver_id'); // Filter by driver

    // Validate pagination parameters
    if (page < 1 || pageSize < 1 || pageSize > 100) {
      return NextResponse.json(
        { message: 'Invalid pagination parameters. Page must be >= 1 and pageSize between 1-100' },
        { status: 400 }
      );
    }

    // Calculate offset
    const offset = (page - 1) * pageSize;

    // Build WHERE conditions for filtering
    const whereConditions: string[] = [];
    const queryParams: any[] = [];

    if (status) {
      whereConditions.push('t.status = ?');
      queryParams.push(status);
    }

    if (driver_id) {
      whereConditions.push('a.driver_id = ?');
      queryParams.push(driver_id);
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    // Get total count
    const totalResult = await queryOne<{ total: number }>(
      `SELECT COUNT(*) as total 
       FROM assignments a
       JOIN tours t ON a.tour_id = t.id
       JOIN drivers d ON a.driver_id = d.id
       ${whereClause}`,
      queryParams
    );
    const total = totalResult?.total || 0;

    // Get paginated assignments with complete details
    const assignments = await query(
      `SELECT 
        a.id,
        a.tour_id,
        a.driver_id,
        a.assigned_at,
        a.assigned_by,
        d.name as driver_name,
        d.driver_number,
        d.vehicle_type,
        d.vehicle_plate,
        d.status as driver_status,
        t.customer_name,
        t.agent,
        t.pax,
        t.contact_details,
        t.pickup,
        t.destination,
        t.arrival_datetime,
        t.departure_datetime,
        t.flight_no,
        t.status as tour_status,
        t.booking_date,
        p.full_name as assigned_by_name
       FROM assignments a
       JOIN tours t ON a.tour_id = t.id
       JOIN drivers d ON a.driver_id = d.id
       LEFT JOIN profiles p ON a.assigned_by = p.id
       ${whereClause}
       ORDER BY a.assigned_at DESC
       LIMIT ${pageSize} OFFSET ${offset}`,
      queryParams
    ) as any[];

    // Format timestamps for all assignments
    const formattedAssignments = assignments.map(assignment => ({
      ...assignment,
      assigned_at: formatToIST(assignment.assigned_at),
      arrival_datetime: formatToIST(assignment.arrival_datetime),
      departure_datetime: formatToIST(assignment.departure_datetime),
      booking_date: assignment.booking_date // This is already a date, no formatting needed
    }));

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / pageSize);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    // 🔥 LOG AUDIT ACTIVITY - ASSIGNMENTS RETRIEVAL (MULTIPLE)
    await auditLogger.logReadMultiple(SYSCONFIG.ENTITY_TYPE_ASSIGNMENT, assignments.map(a => a.id));

    return NextResponse.json({
      data: formattedAssignments,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasNextPage,
        hasPreviousPage
      },
      filters: {
        status,
        driver_id
      }
    });

  } catch (error: any) {
    console.error('Get assignments error:', error);
    return NextResponse.json(
      { message: 'Failed to get assignments', error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  let assignmentId: string | null = null;
  let tour_id_revert: string | null = null;
  let paymentId: string | null = null;
  
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

    const body = await request.json();
    const { tour_id, driver_id, amount, currency, paid_amount } = body;
    tour_id_revert = tour_id;

    // Validate required fields
    if (!tour_id || !driver_id) {
      return NextResponse.json(
        { message: "tour_id and driver_id are required" },
        { status: 400 }
      );
    }

    // Check if tour exists
    const tour = await queryOne("SELECT id, status FROM tours WHERE id = ?", [
      tour_id,
    ]);

    if (!tour) {
      return NextResponse.json({ message: "Tour not found" }, { status: 404 });
    }

    // Check if driver exists
    const driver = await queryOne("SELECT id, name, status FROM drivers WHERE id = ?", [
      driver_id,
    ]);

    if (!driver) {
      return NextResponse.json(
        { message: "Driver not found" },
        { status: 404 }
      );
    } else {
        if(driver.status !== SYSCONFIG.ACTIVE) {
            return NextResponse.json(
                { message: "Driver is not active" },
                { status: 400 }
              );
        }
    }

    // Get the tour details to check category and pickup_datetime
    const tourDetails = await queryOne(
      "SELECT id, status, category, pickup_datetime FROM tours WHERE id = ?",
      [tour_id]
    );

    if (!tourDetails) {
      return NextResponse.json({ message: "Tour not found" }, { status: 404 });
    }

    // Check if tour is already assigned
    const existingAssignment = await queryOne(
      "SELECT id FROM assignments WHERE tour_id = ?",
      [tour_id]
    );

    if (existingAssignment) {
      return NextResponse.json(
        { message: "Tour is already assigned to a driver" },
        { status: 409 }
      );
    }

    // Check if driver is already assigned to a Round Tour
    const roundTourAssignment = await queryOne(
      `SELECT a.id, t.id as tour_id, t.customer_name, t.category
       FROM assignments a
       JOIN tours t ON a.tour_id = t.id
       WHERE a.driver_id = ? 
       AND t.category = ?
       AND t.status NOT IN (?, ?)`,
      [driver_id, SYSCONFIG.TRIP_CAT_ROUND, SYSCONFIG.COMPLETED, SYSCONFIG.CANCELLED]
    );

    if (roundTourAssignment) {
      return NextResponse.json(
        {
          message: `Driver is already assigned to a Round Tour (${roundTourAssignment.tour_id}). Cannot assign to another tour until the Round Tour is completed or cancelled.`
        },
        { status: 409 }
      );
    }

    // If trying to assign a Round Tour, check if driver has any active assignments
    if (tourDetails.category === SYSCONFIG.TRIP_CAT_ROUND) {
      const activeAssignment = await queryOne(
        `SELECT a.id, t.id as tour_id, t.customer_name, t.category
         FROM assignments a
         JOIN tours t ON a.tour_id = t.id
         WHERE a.driver_id = ? 
         AND t.status NOT IN (?, ?)`,
        [driver_id, SYSCONFIG.COMPLETED, SYSCONFIG.CANCELLED]
      );

      if (activeAssignment) {
        return NextResponse.json(
          {
            message: `Driver is already assigned to a ${activeAssignment.category} trip (${activeAssignment.tour_id}). Cannot assign to a Round Tour until current assignment is completed or cancelled.`
          },
          { status: 409 }
        );
      }
    }

    // If assigning Arrival or Departure, check for conflicts at the same pickup_datetime
    if (tourDetails.category === SYSCONFIG.TRIP_CAT_ARRIVAL || tourDetails.category === SYSCONFIG.TRIP_CAT_DEPARTURE) {
      const conflictingAssignment = await queryOne(
        `SELECT a.id, t.id as tour_id, t.customer_name, t.category, t.pickup_datetime
         FROM assignments a
         JOIN tours t ON a.tour_id = t.id
         WHERE a.driver_id = ? 
         AND t.id != ?
         AND (t.category = ? OR t.category = ?)
         AND t.pickup_datetime = ?
         AND t.status NOT IN (?, ?)`,
        [
          driver_id, 
          tour_id, 
          SYSCONFIG.TRIP_CAT_ARRIVAL, 
          SYSCONFIG.TRIP_CAT_DEPARTURE,
          tourDetails.pickup_datetime,
          SYSCONFIG.COMPLETED,
          SYSCONFIG.CANCELLED
        ]
      );

      if (conflictingAssignment) {
        return NextResponse.json(
          {
            message: `Driver is already assigned to a ${conflictingAssignment.category} trip (${conflictingAssignment.tour_id}) at the same pickup time (${formatToIST(conflictingAssignment.pickup_datetime)}). Cannot assign to another ${tourDetails.category} trip at the same time.`
          },
          { status: 409 }
        );
      }
    }

    // Generate assignment ID
    assignmentId = await generateUniqueAssignmentId();

    // Create the assignment
    await query(
      "INSERT INTO assignments (id, tour_id, driver_id, assigned_by, amount, currency, paid_amount, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [assignmentId, tour_id, driver_id, user.id, amount || 0, currency || null, paid_amount || null, SYSCONFIG.ASSIGNMENT_ONGOING]
    );

    // Get the created assignment with driver details
    const newAssignment = await queryOne(
      `
      SELECT 
        a.id,
        a.tour_id,
        a.driver_id,
        a.assigned_at,
        a.assigned_by,
        a.amount,
        a.paid_amount,
        a.currency,
        d.name as driver_name,
        d.driver_number,
        d.vehicle_type,
        d.vehicle_plate,
        t.customer_name,
        t.agent,
        t.pickup,
        t.destination
      FROM assignments a
      JOIN drivers d ON a.driver_id = d.id
      JOIN tours t ON a.tour_id = t.id
      WHERE a.id = ?
    `,
      [assignmentId]
    );

    // update tour status to Assigned
    await query("UPDATE tours SET status = ? WHERE id = ?", [
      SYSCONFIG.ASSIIGNED,
      tour_id,
    ]);

    // 🔥 LOG AUDIT ACTIVITY - ASSIGNMENT CREATION
    await auditLogger.logCreate(SYSCONFIG.ENTITY_TYPE_ASSIGNMENT, assignmentId, newAssignment, SYSCONFIG.SUCCESS);

    // add payment record if amount > 0
    if(amount && parseFloat(amount) > 0) {
      paymentId = await generateUniquePaymentId();
      let status = SYSCONFIG.PENDING;
      if(paid_amount && parseFloat(paid_amount) == parseFloat(amount)) {
        status = SYSCONFIG.COMPLETED;
      } else if(paid_amount && parseFloat(paid_amount) > 0 && parseFloat(paid_amount) < parseFloat(amount)) {
        status = SYSCONFIG.PARTIAL;
      }
      await query(
        `INSERT INTO payments 
          (id, driver_id, tour_id, amount, currency, paid_amount, updated_by, status, assignment_id, type) 
         VALUES 
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [paymentId, driver_id, tour_id, parseFloat(amount), currency || null, parseFloat(paid_amount) || 0, user.id, status, assignmentId, SYSCONFIG.PAYMENT_TYPE_DRIVER]
      );
    }

    return NextResponse.json(
      {
        message: "Tour assigned successfully",
        assignment_id: newAssignment.id,
      },
      { status: 201 }
    );
  } catch (error: any) {
    // revert insertion of assignment in case of error
    if (assignmentId) {
      await query("DELETE FROM assignments WHERE id = ?", [assignmentId]);
      // optionally revert tour status change if needed
      await query("UPDATE tours SET status = ? WHERE id = ?", [
        SYSCONFIG.PENDING,
        tour_id_revert,
      ]);
    }
    console.error("Assignment error:", error);
    return NextResponse.json(
      { message: "Failed to create assignment", error: error.message },
      { status: 500 }
    );
  }
}

// export async function DELETE(request: NextRequest) {
//   try {
//     const authHeader = request.headers.get("authorization");
//     const token = authHeader?.substring(7);
//     const user = await getUserFromToken(token!);

//     if (!user) {
//       return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
//     }

//     const { searchParams } = new URL(request.url);
//     const tour_id = searchParams.get("tour_id");

//     if (!tour_id) {
//       return NextResponse.json(
//         { message: "tour_id is required" },
//         { status: 400 }
//       );
//     }

//     // Check if assignment exists
//     const assignment = await queryOne(
//       "SELECT id FROM assignments WHERE tour_id = ?",
//       [tour_id]
//     );

//     if (!assignment) {
//       return NextResponse.json(
//         { message: "Assignment not found for this tour" },
//         { status: 404 }
//       );
//     }

//     // Delete the assignment
//     await query("DELETE FROM assignments WHERE tour_id = ?", [tour_id]);

//     return NextResponse.json({
//       message: "Assignment removed successfully",
//     });
//   } catch (error: any) {
//     console.error("Unassign error:", error);
//     return NextResponse.json(
//       { message: "Failed to remove assignment", error: error.message },
//       { status: 500 }
//     );
//   }
// }
