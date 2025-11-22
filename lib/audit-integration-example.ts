// Example: How to integrate audit logging into your API endpoints
// This shows the pattern for adding audit logs to the assignment POST endpoint
import 'server-only';
import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { getUserFromToken } from "@/lib/auth";
import { generateUniqueAssignmentId } from "@/lib/id-generator";
import { SYSCONFIG } from "@/lib/utils";
import { AuditLogger } from "@/lib/activity-logger.server";

export async function POST(request: NextRequest) {
  let assignmentId: string | null = null;
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
      role: user.role
    });

    const body = await request.json();
    const { tour_id, driver_id } = body;

    // Validate required fields
    if (!tour_id || !driver_id) {
      return NextResponse.json(
        { message: "tour_id and driver_id are required" },
        { status: 400 }
      );
    }

    // Check if tour exists
    const tour = await queryOne("SELECT * FROM tours WHERE id = ?", [tour_id]);
    if (!tour) {
      return NextResponse.json({ message: "Tour not found" }, { status: 404 });
    }

    // Check if driver exists
    const driver = await queryOne("SELECT * FROM drivers WHERE id = ?", [driver_id]);
    if (!driver) {
      return NextResponse.json({ message: "Driver not found" }, { status: 404 });
    }

    if (driver.status !== SYSCONFIG.ACTIVE) {
      return NextResponse.json(
        { message: "Driver is not active" },
        { status: 400 }
      );
    }

    // Check for existing assignment
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

    // Generate assignment ID
    assignmentId = await generateUniqueAssignmentId();

    // Create the assignment
    await query(
      "INSERT INTO assignments (id, tour_id, driver_id, assigned_by) VALUES (?, ?, ?, ?)",
      [assignmentId, tour_id, driver_id, user.id]
    );

    // Get the created assignment with details
    const newAssignment = await queryOne(`
      SELECT 
        a.id, a.tour_id, a.driver_id, a.assigned_at, a.assigned_by,
        d.name as driver_name, d.driver_number,
        t.customer_name
      FROM assignments a
      JOIN drivers d ON a.driver_id = d.id
      JOIN tours t ON a.tour_id = t.id
      WHERE a.id = ?
    `, [assignmentId]);

    // 🔥 LOG AUDIT ACTIVITY - ASSIGNMENT CREATION
    await auditLogger.logAssign(tour_id, driver_id, SYSCONFIG.SUCCESS, {
      assignment_id: assignmentId,
      tour_details: {
        customer_name: tour.customer_name,
        pickup: tour.pickup,
        destination: tour.destination
      },
      driver_details: {
        name: driver.name,
        driver_number: driver.driver_number,
        vehicle_type: driver.vehicle_type
      }
    });

    return NextResponse.json({
      message: "Tour assigned successfully",
      assignment: newAssignment,
    }, { status: 201 });

  } catch (error: any) {
    // Revert assignment if error occurs
    if (assignmentId) {
      await query("DELETE FROM assignments WHERE id = ?", [assignmentId]);
    }

    // 🔥 LOG AUDIT ACTIVITY - FAILED ASSIGNMENT ATTEMPT
    if (auditLogger) {
      const requestBody = await request.json().catch(() => ({}));
      await auditLogger.logCreate('assignment', assignmentId || 'unknown', null, SYSCONFIG.FAILED, {
        error: error.message,
        status: 'failed',
        attempted_tour_id: requestBody?.tour_id,
        attempted_driver_id: requestBody?.driver_id
      });
    }

    console.error("Assignment error:", error);
    return NextResponse.json(
      { message: "Failed to create assignment", error: error.message },
      { status: 500 }
    );
  }
}

// Example for UPDATE operation
export async function PUT(request: NextRequest) {
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
      role: user.role
    });

    const body = await request.json();
    const { assignment_id, new_driver_id } = body;

    // Get old assignment data for audit log
    const oldAssignment = await queryOne(
      "SELECT * FROM assignments WHERE id = ?",
      [assignment_id]
    );

    if (!oldAssignment) {
      return NextResponse.json({ message: "Assignment not found" }, { status: 404 });
    }

    // Update assignment
    await query(
      "UPDATE assignments SET driver_id = ?, assigned_by = ?, assigned_at = CURRENT_TIMESTAMP WHERE id = ?",
      [new_driver_id, user.id, assignment_id]
    );

    // Get updated assignment data
    const newAssignment = await queryOne(
      "SELECT * FROM assignments WHERE id = ?",
      [assignment_id]
    );

    // 🔥 LOG AUDIT ACTIVITY - ASSIGNMENT UPDATE
    await auditLogger.logUpdate('assignment', assignment_id, oldAssignment, newAssignment, SYSCONFIG.SUCCESS, {
      change_type: 'driver_reassignment',
      old_driver_id: oldAssignment.driver_id,
      new_driver_id: new_driver_id
    });

    return NextResponse.json({
      message: "Assignment updated successfully",
      assignment: newAssignment,
    });

  } catch (error: any) {
    console.error("Assignment update error:", error);
    return NextResponse.json(
      { message: "Failed to update assignment", error: error.message },
      { status: 500 }
    );
  }
}

// Example for DELETE operation
export async function DELETE(request: NextRequest) {
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
      role: user.role
    });

    const { searchParams } = new URL(request.url);
    const assignment_id = searchParams.get("assignment_id");

    if (!assignment_id) {
      return NextResponse.json({ message: "assignment_id is required" }, { status: 400 });
    }

    // Get assignment data before deletion for audit log
    const assignmentToDelete = await queryOne(
      "SELECT * FROM assignments WHERE id = ?",
      [assignment_id]
    );

    if (!assignmentToDelete) {
      return NextResponse.json({ message: "Assignment not found" }, { status: 404 });
    }

    // Delete the assignment
    await query("DELETE FROM assignments WHERE id = ?", [assignment_id]);

    // 🔥 LOG AUDIT ACTIVITY - ASSIGNMENT DELETION
    await auditLogger.logDelete('assignment', assignment_id, assignmentToDelete, SYSCONFIG.SUCCESS, {
      reason: 'manual_deletion',
      tour_id: assignmentToDelete.tour_id,
      driver_id: assignmentToDelete.driver_id
    });

    return NextResponse.json({
      message: "Assignment deleted successfully",
    });

  } catch (error: any) {
    console.error("Assignment deletion error:", error);
    return NextResponse.json(
      { message: "Failed to delete assignment", error: error.message },
      { status: 500 }
    );
  }
}

/*
🔥 INTEGRATION CHECKLIST FOR OTHER ENDPOINTS:

1. Import AuditLogger from '@/lib/activity-logger'
2. Initialize AuditLogger with user info after authentication
3. Get old data before updates/deletes
4. Call appropriate audit log method:
   - auditLogger.logCreate(entity_type, entity_id, newData, additionalDetails)
   - auditLogger.logRead(entity_type, entity_id, additionalDetails)
   - auditLogger.logUpdate(entity_type, entity_id, oldData, newData, additionalDetails)
   - auditLogger.logDelete(entity_type, entity_id, oldData, additionalDetails)
   - auditLogger.logAssign(tour_id, driver_id, additionalDetails)
   - auditLogger.logUnassign(tour_id, driver_id, additionalDetails)

5. Add error handling to log failed operations
6. Test thoroughly to ensure audit logs are created correctly

ENTITY TYPES TO USE:
- 'driver' for drivers table operations
- 'tour' for tours table operations  
- 'assignment' for assignments table operations
- 'payment' for payments table operations
- 'user' for auth_users table operations
- 'profile' for profiles table operations
*/