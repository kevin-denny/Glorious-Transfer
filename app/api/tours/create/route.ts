import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { getUserFromToken } from "@/lib/auth";
import { generateUniqueTourId } from "@/lib/id-generator";

interface CreateTourRequest {
  booking_date: string;
  customer_name: string;
  agent: string;
  pax: number;
  contact_details: string;
  arrival_datetime: string;
  departure_datetime: string;
  flight_no?: string;
  flight_time?: string;
  remarks?: string;
  driver_id?: string;
  status?: string;
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.substring(7);
    const user = await getUserFromToken(token!);

    if (
      !user ||
      !(user.role === "administrator" || user.role === "operations")
    ) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    const body: CreateTourRequest = await request.json();

    // Validate required fields
    if (
      !body.booking_date ||
      !body.customer_name ||
      !body.agent ||
      !body.pax ||
      !body.contact_details ||
      !body.arrival_datetime ||
      !body.departure_datetime
    ) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate pax is a positive number
    if (body.pax < 1) {
      return NextResponse.json(
        { message: "Pax must be at least 1" },
        { status: 400 }
      );
    }

    // Validate arrival is before departure
    const arrivalDate = new Date(body.arrival_datetime);
    const departureDate = new Date(body.departure_datetime);

    if (arrivalDate >= departureDate) {
      return NextResponse.json(
        { message: "Arrival datetime must be before departure datetime" },
        { status: 400 }
      );
    }

    // Generate unique tour ID - will be used as booking_ref
    const tourId = await generateUniqueTourId();

    // Insert tour into database (booking_ref = tourId)
    await query(
      `INSERT INTO tours (
        id, booking_date, customer_name, agent, pax,
        contact_details, arrival_datetime, departure_datetime,
        flight_no, flight_time, remarks,
        created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tourId,
        body.booking_date,
        body.customer_name,
        body.agent,
        body.pax,
        body.contact_details,
        body.arrival_datetime,
        body.departure_datetime,
        body.flight_no || null,
        body.flight_time || null,
        body.remarks || null,
        user.id,
      ]
    );

    const tour = await queryOne(`SELECT * FROM tours WHERE id = ?`, [tourId]);

    return NextResponse.json(
      {
        message: "Tour created successfully",
        tour_id: tour.id,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Tour creation error:", error);

    return NextResponse.json(
      { message: "Failed to create tour" },
      { status: 500 }
    );
  }
}
