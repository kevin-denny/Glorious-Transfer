import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { getUserFromToken } from "@/lib/auth";
import { generateUniqueAssignmentId } from "@/lib/id-generator";
import { SYSCONFIG } from "@/lib/utils";

export async function POST(request: NextRequest) {
  let assignmentId: string | null = null;
  
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.substring(7);
    const user = await getUserFromToken(token!);

    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

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

    // Check if driver is already assigned to another tour at the same time
    const conflictingAssignment = await queryOne(
      `
      SELECT a.id 
      FROM assignments a
      JOIN tours t ON a.tour_id = t.id
      WHERE a.driver_id = ? 
      AND t.id != ?
      AND (
        (t.departure_datetime <= (SELECT departure_datetime FROM tours WHERE id = ?) 
         AND t.arrival_datetime >= (SELECT arrival_datetime FROM tours WHERE id = ?))
        OR
        (t.arrival_datetime <= (SELECT arrival_datetime FROM tours WHERE id = ?) 
         AND t.departure_datetime >= (SELECT departure_datetime FROM tours WHERE id = ?))
      )
    `,
      [driver_id, tour_id, tour_id, tour_id, tour_id, tour_id]
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

    // Generate assignment ID
    assignmentId = await generateUniqueAssignmentId();

    // Create the assignment
    await query(
      "INSERT INTO assignments (id, tour_id, driver_id, assigned_by) VALUES (?, ?, ?, ?)",
      [assignmentId, tour_id, driver_id, user.id]
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
        d.name as driver_name,
        d.driver_number as driver_number,
        d.vehicle_type as driver_vehicle_type,
        d.vehicle_plate as driver_vehicle_plate,
        t.customer_name
      FROM assignments a
      JOIN drivers d ON a.driver_id = d.id
      JOIN tours t ON a.tour_id = t.id
      WHERE a.id = ?
    `,
      [assignmentId]
    );

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
    }
    console.error("Assignment error:", error);
    return NextResponse.json(
      { message: "Failed to create assignment", error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.substring(7);
    const user = await getUserFromToken(token!);

    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tour_id = searchParams.get("tour_id");

    if (!tour_id) {
      return NextResponse.json(
        { message: "tour_id is required" },
        { status: 400 }
      );
    }

    // Check if assignment exists
    const assignment = await queryOne(
      "SELECT id FROM assignments WHERE tour_id = ?",
      [tour_id]
    );

    if (!assignment) {
      return NextResponse.json(
        { message: "Assignment not found for this tour" },
        { status: 404 }
      );
    }

    // Delete the assignment
    await query("DELETE FROM assignments WHERE tour_id = ?", [tour_id]);

    return NextResponse.json({
      message: "Assignment removed successfully",
    });
  } catch (error: any) {
    console.error("Unassign error:", error);
    return NextResponse.json(
      { message: "Failed to remove assignment", error: error.message },
      { status: 500 }
    );
  }
}
