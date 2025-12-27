import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { getUserFromToken } from "@/lib/auth";
import { generateUniquePaymentId, generateUniqueTourId } from "@/lib/id-generator";
import { SYSCONFIG } from "@/lib/utils";
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

interface CreateTourRequest {
  booking_date: string;
  customer_name: string;
  agent: string;
  pax: number;
  contact_details: string;
  arrival_datetime?: string;
  departure_datetime?: string;
  flight_no?: string;
  remarks?: string;
  driver_id?: string;
  status?: string;
  pickup?: string;
  destination?: string;
  category: string;
  amount?: number;
  currency?: string;
  agent_ref?: string;
  pickup_datetime?: string;
  vehicle_type?: string;
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.substring(7);
    const user = await getUserFromToken(token!);

    if (
      !user ||
      !(user.role === SYSCONFIG.ADMINISTRATOR || user.role === "operations")
    ) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    // Initialize audit logger
    const auditLogger = new AuditLogger({
      id: user.id,
      name: user.full_name || user.email,
      role: user.role,
    });

    const body: CreateTourRequest = await request.json();

    // Validate required fields
    if (
      !body.booking_date ||
      !body.customer_name ||
      !body.agent ||
      !body.pax ||
      !body.contact_details ||
      !body.pickup ||
      !body.destination ||
      !body.category
    ) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate category
    const validCategories = [
      SYSCONFIG.TRIP_CAT_ARRIVAL,
      SYSCONFIG.TRIP_CAT_DEPARTURE,
      SYSCONFIG.TRIP_CAT_ROUND,
      '-'
    ];
    if (!validCategories.includes(body.category)) {
      return NextResponse.json(
        { message: "Invalid trip category" },
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
    const arrivalDate = new Date(body.arrival_datetime || '');
    const departureDate = new Date(body.departure_datetime || '');
    const pickupDate = new Date(body.pickup_datetime || '');

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
        contact_details, arrival_datetime, departure_datetime, flight_no, remarks, 
        pickup, destination, category, amount, currency, 
        agent_ref, pickup_datetime, vehicle_type, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tourId,
        body.booking_date,
        body.customer_name,
        body.agent,
        body.pax,
        body.contact_details,
        body.arrival_datetime || body.pickup_datetime || null,
        body.departure_datetime || null,
        body.flight_no || null,
        body.remarks || null,
        body.pickup || null,
        body.destination || null,
        body.category || '-',
        body.amount || 0,
        body.currency || null,
        body.agent_ref || null,
        body.pickup_datetime || body.arrival_datetime || null,
        body.vehicle_type || null,
        user.id,
      ]
    );

    const tour = await queryOne(`SELECT * FROM tours WHERE id = ?`, [tourId]);

    // 🔥 LOG AUDIT ACTIVITY - TOUR CREATION
    await auditLogger.logCreate(SYSCONFIG.ENTITY_TYPE_TOUR, tour.id, tour, SYSCONFIG.SUCCESS, {
      change_type: 'tour_creation',
    });

    // Add payment record if amount > 0
    if(body.amount && body.amount > 0) {
      const paymentId = await generateUniquePaymentId();
      await query(
        `INSERT INTO payments (
          id, tour_id, driver_id, amount, currency, type, updated_by, agent_ref
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          paymentId,
          tour.id,
          "-",
          body.amount,
          body.currency || null,
          SYSCONFIG.PAYMENT_TYPE_TOUR,
          user.id,
          body.agent_ref || null,
        ]
      );

      // 🔥 LOG AUDIT ACTIVITY - PAYMENT CREATION
      await auditLogger.logCreate(SYSCONFIG.ENTITY_TYPE_PAYMENT, paymentId, {
        id: paymentId,
        reference_id: tour.id,
        amount: body.amount,
        currency: body.currency || null,
        type: SYSCONFIG.PAYMENT_TYPE_TOUR,
        created_by: user.id,
      }, SYSCONFIG.SUCCESS, {
        change_type: 'payment_creation',
      });
    }

    return NextResponse.json(
      {
        message: "Trip created successfully",
        tour_id: tour.id,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Trip creation error:", error);

    return NextResponse.json(
      { message: "Failed to create trip" },
      { status: 500 }
    );
  }
}
