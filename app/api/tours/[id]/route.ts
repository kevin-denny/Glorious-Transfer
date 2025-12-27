import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, transaction } from '@/lib/db';
import { getUserFromToken } from '@/lib/auth';
import { formatToIST, SYSCONFIG } from '@/lib/utils';
import { AuditLogger } from '@/lib/activity-logger.server';

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

// GET tour by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const tourId = params.id;

    // Get tour with assignment details
    const tour = await queryOne(`
      SELECT 
        t.*,
        a.id as assignment_id,
        a.assigned_at,
        a.assigned_by,
        d.id as driver_id,
        d.name as driver_name,
        d.driver_number as driver_phone,
        d.vehicle_type as driver_vehicle_type,
        d.vehicle_plate as driver_vehicle_number
      FROM tours t
      LEFT JOIN assignments a ON t.id = a.tour_id
      LEFT JOIN drivers d ON a.driver_id = d.id
      WHERE t.id = ?
    `, [tourId]);

    if (!tour) {
      return NextResponse.json(
        { message: 'Trip not found' },
        { status: 404 }
      );
    }

    // Format tour data
    const formattedTour = {
      id: tour.id,
      booking_date: formatToIST(tour.booking_date).split(" ")[0],
      customer_name: tour.customer_name,
      agent: tour.agent,
      pax: tour.pax,
      category: tour.category,
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
      amount: tour.amount,
      currency: tour.currency,
      agent_ref: tour.agent_ref,
      pickup_datetime: formatToIST(tour.pickup_datetime),
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
    };

    // 🔥 LOG AUDIT ACTIVITY - TOUR INFO RETRIEVAL
    await auditLogger.logRead(SYSCONFIG.ENTITY_TYPE_TOUR, tour.id, SYSCONFIG.SUCCESS, formattedTour);

    return NextResponse.json({ tour: formattedTour });

  } catch (error: any) {
    console.error('Get trip error:', error);
    return NextResponse.json(
      { message: 'Failed to get trip', error: error.message },
      { status: 500 }
    );
  }
}

// UPDATE tour by ID
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const tourId = params.id;
    const body = await request.json();
    
    const {
      booking_date,
      customer_name,
      agent,
      pax,
      contact_details,
      arrival_datetime,
      departure_datetime,
      flight_no,
      remarks,
      status,
      pickup,
      destination,
      category,
      amount,
      currency,
      agent_ref,
      pickup_datetime,
      complaints,
      driver_id,
      vehicle_type
    } = body;

    // Check if tour exists
    const existingTour = await queryOne(
      'SELECT id, status FROM tours WHERE id = ?',
      [tourId]
    );

    if (!existingTour) {
      return NextResponse.json(
        { message: 'Tour not found' },
        { status: 404 }
      );
    }

    // Validate required fields
    if (!booking_date || !customer_name || !agent || !pax || !contact_details || !category) {
      return NextResponse.json(
        { message: 'Missing required fields: booking_date, customer_name, agent, pax, contact_details, category' },
        { status: 400 }
      );
    }

    // Validate date and datetime formats
    const bookingDate = new Date(booking_date);

    if (isNaN(bookingDate.getTime())) {
      return NextResponse.json(
        { message: 'Invalid booking_date format. Use YYYY-MM-DD format' },
        { status: 400 }
      );
    }

    // Validate arrival and departure datetimes if provided
    if (arrival_datetime && departure_datetime) {
      const arrivalDate = new Date(arrival_datetime);
      const departureDate = new Date(departure_datetime);

      if (isNaN(arrivalDate.getTime()) || isNaN(departureDate.getTime())) {
        return NextResponse.json(
          { message: 'Invalid datetime format. Use ISO format (YYYY-MM-DDTHH:MM:SS)' },
          { status: 400 }
        );
      }

      if (departureDate <= arrivalDate) {
        return NextResponse.json(
          { message: 'Departure datetime must be after arrival datetime' },
          { status: 400 }
        );
      }
    }

    // Validate pax (passenger count)
    if (!Number.isInteger(pax) || pax < 1) {
      return NextResponse.json(
        { message: 'pax must be a positive integer' },
        { status: 400 }
      );
    }

    // validate status completed with driver_id
    if (status === SYSCONFIG.COMPLETED && !driver_id) {
      return NextResponse.json(
        { message: 'driver_id is required when marking tour as Completed' },
        { status: 400 }
      );
    }

    // Use transaction to ensure atomicity
    const result = await transaction(async (connection) => {
      // Update the tour
      await connection.execute(`
        UPDATE tours SET 
          booking_date = ?,
          customer_name = ?,
          agent = ?,
          pax = ?,
          contact_details = ?,
          arrival_datetime = ?,
          departure_datetime = ?,
          flight_no = ?,
          remarks = ?,
          status = ?,
          pickup = ?,
          destination = ?,
          category = ?,
          amount = ?,
          currency = ?,
          agent_ref = ?,
          pickup_datetime = ?,
          complaints = ?,
          vehicle_type = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        booking_date,
        customer_name,
        agent,
        pax,
        contact_details,
        arrival_datetime || pickup_datetime || null,
        departure_datetime,
        flight_no || null,
        remarks || null,
        status || existingTour.status,
        pickup || null,
        destination || null,
        category || "-",
        amount || 0,
        currency || null,
        agent_ref || null,
        pickup_datetime || arrival_datetime || null,
        complaints || null,
        vehicle_type || null,
        tourId
      ]);

      // Delete assignment if status is Cancelled or Completed
      // if (status === SYSCONFIG.CANCELLED || status === SYSCONFIG.COMPLETED) {
      //   await connection.execute(
      //     'DELETE FROM assignments WHERE tour_id = ?',
      //     [tourId]
      //   );
      // }

      // Update assignment status if tour is Completed or Cancelled
      if (status === SYSCONFIG.COMPLETED || status === SYSCONFIG.CANCELLED) {
        await connection.execute(
          'UPDATE assignments SET status = ? WHERE tour_id = ?',
          [status === SYSCONFIG.COMPLETED ? SYSCONFIG.ASSIGNMENT_COMPLETED : SYSCONFIG.ASSIGNMENT_CANCELLED, tourId]
        );
      }

      // if(status === SYSCONFIG.ASSIIGNED) {
      //   if(complaints && complaints.length > 0) {
      //     // Update complaints into complaints TEXT column in tours table
      //     await connection.execute(
      //       'UPDATE tours SET complaints = ? WHERE id = ?',
      //       [complaints, tourId]
      //     );
      //   }
      // }

      // Increment driver's number_of_rides if status changed to Completed
      if (status === SYSCONFIG.COMPLETED && existingTour.status !== SYSCONFIG.COMPLETED && driver_id) {
        await connection.execute(
          'UPDATE drivers SET number_of_rides = COALESCE(number_of_rides, 0) + 1 WHERE id = ?',
          [driver_id]
        );
      }

      // Update currency in payments table if changed
      if (currency) {
        await connection.execute(
          'UPDATE payments SET currency = ? WHERE tour_id = ? AND type = ?',
          [currency, tourId, SYSCONFIG.PAYMENT_TYPE_TOUR]
        );
      }

      // Get the updated tour with assignment details
      const [rows] = await connection.execute(`
        SELECT 
          t.*,
          a.id as assignment_id,
          a.assigned_at,
          a.assigned_by,
          d.id as driver_id,
          d.name as driver_name,
          d.driver_number as driver_phone,
          d.vehicle_type as driver_vehicle_type,
          d.vehicle_plate as driver_vehicle_number
        FROM tours t
        LEFT JOIN assignments a ON t.id = a.tour_id
        LEFT JOIN drivers d ON a.driver_id = d.id
        WHERE t.id = ?
      `, [tourId]);

      return (rows as any[])[0];
    });

    // Format the response
    const formattedTour = {
      id: result.id,
      booking_date: result.booking_date,
      customer_name: result.customer_name,
      agent: result.agent,
      pax: result.pax,
      contact_details: result.contact_details,
      arrival_datetime: formatToIST(result.arrival_datetime),
      departure_datetime: formatToIST(result.departure_datetime),
      flight_no: result.flight_no,
      remarks: result.remarks,
      status: result.status,
      pickup: result.pickup,
      destination: result.destination,
      category: result.category,
      amount: result.amount,
      currency: result.currency,
      agent_ref: result.agent_ref,
      pickup_datetime: formatToIST(result.pickup_datetime),
      created_at: formatToIST(result.created_at),
      updated_at: formatToIST(result.updated_at),
      created_by: result.created_by,
      complaints: result.complaints,
      assignment: result.assignment_id ? {
        id: result.assignment_id,
        assigned_at: formatToIST(result.assigned_at),
        assigned_by: result.assigned_by,
        driver: {
          id: result.driver_id,
          name: result.driver_name,
          phone: result.driver_phone,
          vehicle_type: result.driver_vehicle_type,
          vehicle_number: result.driver_vehicle_number
        }
      } : null
    };

    // 🔥 LOG AUDIT ACTIVITY - TOUR UPDATE
    await auditLogger.logUpdate(SYSCONFIG.ENTITY_TYPE_TOUR, formattedTour.id, existingTour, formattedTour, SYSCONFIG.SUCCESS, {
      change_type: 'tour_update',
    });

    return NextResponse.json({
      message: 'Trip updated successfully',
      tour: formattedTour
    });

  } catch (error: any) {
    console.error('Update trip error:', error);
    return NextResponse.json(
      { message: 'Failed to update trip', error: error.message },
      { status: 500 }
    );
  }
}

// DELETE tour by ID
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const tourId = params.id;

    // Check if tour exists
    const tour = await queryOne(
      'SELECT id, customer_name, status FROM tours WHERE id = ?',
      [tourId]
    );

    if (!tour) {
      return NextResponse.json(
        { message: 'Tour not found' },
        { status: 404 }
      );
    }

    // Check if tour has an active assignment
    const assignment = await queryOne(
      'SELECT id FROM assignments WHERE tour_id = ? AND status = ?',
      [tourId, SYSCONFIG.ASSIGNMENT_ONGOING]
    );

    if (assignment) {
      return NextResponse.json(
        { 
          message: 'Cannot delete trip: trip is currently assigned to a driver. Please unassign first.' 
        },
        { status: 409 }
      );
    }

    // Delete the tour (assignments are already handled by foreign key constraints)
    await query(
      'DELETE FROM tours WHERE id = ?',
      [tourId]
    );

    // 🔥 LOG AUDIT ACTIVITY - TOUR DELETION
    await auditLogger.logDelete(SYSCONFIG.ENTITY_TYPE_TOUR, tourId, tour, SYSCONFIG.SUCCESS, {
      reason: 'manual_deletion',
      customer_name: tour.customer_name,
      status: tour.status
    });

    return NextResponse.json({
      message: 'Trip deleted successfully',
      deletedTour: {
        id: tourId,
        customer_name: tour.customer_name,
        status: tour.status
      }
    });

  } catch (error: any) {
    console.error('Delete trip error:', error);
    return NextResponse.json(
      { message: 'Failed to delete trip', error: error.message },
      { status: 500 }
    );
  }
}
