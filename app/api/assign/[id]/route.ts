import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { getUserFromToken } from "@/lib/auth";
import { formatToIST, SYSCONFIG } from "@/lib/utils";
import { AuditLogger } from "@/lib/activity-logger.server";

// GET assignment by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {

  let auditLogger: AuditLogger | null = null;

  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.substring(7);
    const user = await getUserFromToken(token!);

    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Initialize audit logger with user information
    auditLogger = new AuditLogger({
      id: user.id,
      name: user.full_name || user.email,
      role: user.role,
    });

    const assignmentId = params.id;

    // Get assignment with complete details
    const assignment = await queryOne(
      `
      SELECT 
        a.id,
        a.tour_id,
        a.driver_id,
        a.assigned_at,
        a.assigned_by,
        d.name as driver_name,
        d.driver_number,
        d.vehicle_type,
        d.vehicle_plate,
        t.customer_name,
        t.agent,
        t.pax,
        t.contact_details,
        t.pickup,
        t.destination,
        t.arrival_datetime,
        t.departure_datetime,
        t.flight_no,
        t.flight_time,
        t.remarks,
        t.status as tour_status,
        p.full_name as assigned_by_name
      FROM assignments a
      JOIN drivers d ON a.driver_id = d.id
      JOIN tours t ON a.tour_id = t.id
      LEFT JOIN profiles p ON a.assigned_by = p.id
      WHERE a.id = ?
    `,
      [assignmentId]
    );

    if (!assignment) {
      return NextResponse.json(
        { message: "Assignment not found" },
        { status: 404 }
      );
    }

    // Format timestamps
    const formattedAssignment = {
      ...assignment,
      assigned_at: formatToIST(assignment.assigned_at),
      arrival_datetime: formatToIST(assignment.arrival_datetime),
      departure_datetime: formatToIST(assignment.departure_datetime),
    };

    // 🔥 LOG AUDIT ACTIVITY - ASSIGNMENT RETRIEVAL
    await auditLogger.logRead('assignment', assignmentId, formattedAssignment);

    return NextResponse.json({ assignment: formattedAssignment });
  } catch (error: any) {
    console.error("Get assignment error:", error);
    return NextResponse.json(
      { message: "Failed to get assignment", error: error.message },
      { status: 500 }
    );
  }
}

// UPDATE assignment by ID
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const assignmentId = params.id;
    const body = await request.json();
    const { driver_id } = body;

    // Validate required fields
    if (!driver_id) {
      return NextResponse.json(
        { message: "driver_id is required" },
        { status: 400 }
      );
    }

    // Check if assignment exists and get full data for audit log
    const existingAssignment = await queryOne(
      `SELECT a.*, t.customer_name, t.agent, t.pickup, t.destination, d.name as driver_name 
       FROM assignments a 
       LEFT JOIN tours t ON a.tour_id = t.id 
       LEFT JOIN drivers d ON a.driver_id = d.id 
       WHERE a.id = ?`,
      [assignmentId]
    );

    if (!existingAssignment) {
      return NextResponse.json(
        { message: "Assignment not found" },
        { status: 404 }
      );
    }

    // Check if new driver exists
    const driver = await queryOne(
      "SELECT id, name, status FROM drivers WHERE id = ?",
      [driver_id]
    );

    if (!driver) {
      return NextResponse.json(
        { message: "Driver not found" },
        { status: 404 }
      );
    } else {
      if (driver.status !== SYSCONFIG.ACTIVE) {
        return NextResponse.json(
          { message: "Driver is not active" },
          { status: 400 }
        );
      }
    }

    // If driver is changing, check for time conflicts
    if (existingAssignment.driver_id !== driver_id) {
      const conflictingAssignment = await queryOne(
        `
        SELECT a.id 
        FROM assignments a
        JOIN tours t ON a.tour_id = t.id
        WHERE a.driver_id = ? 
        AND a.id != ?
        AND (
          (t.departure_datetime <= (SELECT departure_datetime FROM tours WHERE id = ?) 
           AND t.arrival_datetime >= (SELECT arrival_datetime FROM tours WHERE id = ?))
          OR
          (t.arrival_datetime <= (SELECT arrival_datetime FROM tours WHERE id = ?) 
           AND t.departure_datetime >= (SELECT departure_datetime FROM tours WHERE id = ?))
        )
      `,
        [
          driver_id,
          assignmentId,
          existingAssignment.tour_id,
          existingAssignment.tour_id,
          existingAssignment.tour_id,
          existingAssignment.tour_id,
        ]
      );

      if (conflictingAssignment) {
        return NextResponse.json(
          {
            message:
              "Driver is already assigned to another tour during this time period",
          },
          { status: 409 }
        );
      }
    }

    // Update the assignment
    await query(
      "UPDATE assignments SET driver_id = ?, assigned_by = ?, assigned_at = CURRENT_TIMESTAMP WHERE id = ?",
      [driver_id, user.id, assignmentId]
    );

    // Get the updated assignment with complete details
    const updatedAssignment = await queryOne(
      `
      SELECT 
        a.id,
        a.tour_id,
        a.driver_id,
        a.assigned_at,
        a.assigned_by,
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

    // 🔥 LOG AUDIT ACTIVITY - ASSIGNMENT UPDATE
    await auditLogger.logUpdate('assignment', assignmentId, existingAssignment, updatedAssignment, {
      change_type: 'driver_reassignment',
      old_driver_id: existingAssignment.driver_id,
      new_driver_id: driver_id,
      tour_id: existingAssignment.tour_id
    });

    return NextResponse.json({
      message: "Assignment updated successfully",
      assignment: {
        id: updatedAssignment.id,
        tour_id: updatedAssignment.tour_id,
        driver_id: updatedAssignment.driver_id,
        assigned_at: formatToIST(updatedAssignment.assigned_at),
      },
    });
  } catch (error: any) {
    // revert update in case of error
    console.error("Update assignment error:", error);
    return NextResponse.json(
      { message: "Failed to update assignment", error: error.message },
      { status: 500 }
    );
  }
}

// DELETE assignment by ID
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const assignmentId = params.id;

    // Check if assignment exists and get full data for audit log
    const assignment = await queryOne(
      `SELECT a.*, t.customer_name, t.agent, t.pickup, t.destination, d.name as driver_name 
       FROM assignments a 
       LEFT JOIN tours t ON a.tour_id = t.id 
       LEFT JOIN drivers d ON a.driver_id = d.id 
       WHERE a.id = ?`,
      [assignmentId]
    );

    if (!assignment) {
      return NextResponse.json(
        { message: "Assignment not found" },
        { status: 404 }
      );
    }

    // Delete the assignment
    await query("DELETE FROM assignments WHERE id = ?", [assignmentId]);

    // 🔥 LOG AUDIT ACTIVITY - ASSIGNMENT DELETION
    await auditLogger.logDelete('assignment', assignmentId, assignment, {
      reason: 'manual_deletion',
      tour_id: assignment.tour_id,
      driver_id: assignment.driver_id,
      customer_name: assignment.customer_name,
      driver_name: assignment.driver_name
    });

    return NextResponse.json({
      message: "Assignment deleted successfully",
      deletedAssignment: {
        id: assignmentId,
        tour_id: assignment.tour_id,
        driver_id: assignment.driver_id,
      },
    });
  } catch (error: any) {
    console.error("Delete assignment error:", error);
    return NextResponse.json(
      { message: "Failed to delete assignment", error: error.message },
      { status: 500 }
    );
  }
}
