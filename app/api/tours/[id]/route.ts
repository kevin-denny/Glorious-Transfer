import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { getUserFromToken } from '@/lib/auth';
import { formatToIST } from '@/lib/utils';

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
        { message: 'Tour not found' },
        { status: 404 }
      );
    }

    // Format tour data
    const formattedTour = {
      id: tour.id,
      customer_name: tour.customer_name,
      customer_phone: tour.customer_phone,
      pickup: tour.pickup,
      destination: tour.destination,
      arrival_datetime: formatToIST(tour.arrival_datetime),
      departure_datetime: formatToIST(tour.departure_datetime),
      passenger_count: tour.passenger_count,
      status: tour.status,
      created_at: formatToIST(tour.created_at),
      updated_at: formatToIST(tour.updated_at),
      assignment: tour.assignment_id ? {
        id: tour.assignment_id,
        assigned_at: formatToIST(tour.assigned_at),
        assigned_by: tour.assigned_by,
        driver: {
          id: tour.driver_id,
          name: tour.driver_name,
          phone: tour.driver_phone,
          vehicle_type: tour.driver_vehicle_type,
          vehicle_number: tour.driver_vehicle_number
        }
      } : null
    };

    return NextResponse.json({ tour: formattedTour });

  } catch (error: any) {
    console.error('Get tour error:', error);
    return NextResponse.json(
      { message: 'Failed to get tour', error: error.message },
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
      flight_time,
      remarks,
      status,
      pickup,
      destination
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
    if (!booking_date || !customer_name || !agent || !pax || !contact_details || 
        !arrival_datetime || !departure_datetime) {
      return NextResponse.json(
        { message: 'Missing required fields: booking_date, customer_name, agent, pax, contact_details, arrival_datetime, departure_datetime' },
        { status: 400 }
      );
    }

    // Validate date and datetime formats
    const bookingDate = new Date(booking_date);
    const arrivalDate = new Date(arrival_datetime);
    const departureDate = new Date(departure_datetime);

    if (isNaN(bookingDate.getTime())) {
      return NextResponse.json(
        { message: 'Invalid booking_date format. Use YYYY-MM-DD format' },
        { status: 400 }
      );
    }

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

    // Validate pax (passenger count)
    if (!Number.isInteger(pax) || pax < 1) {
      return NextResponse.json(
        { message: 'pax must be a positive integer' },
        { status: 400 }
      );
    }

    // If tour has assignment and datetime is changing, check for conflicts
    const hasAssignment = await queryOne(
      'SELECT driver_id FROM assignments WHERE tour_id = ?',
      [tourId]
    );

    if (hasAssignment && 
        (existingTour.arrival_datetime !== arrival_datetime || 
         existingTour.departure_datetime !== departure_datetime)) {
      
      const conflictingAssignment = await queryOne(`
        SELECT a.id 
        FROM assignments a
        JOIN tours t ON a.tour_id = t.id
        WHERE a.driver_id = ? 
        AND t.id != ?
        AND (
          (t.departure_datetime <= ? AND t.arrival_datetime >= ?)
          OR
          (t.arrival_datetime <= ? AND t.departure_datetime >= ?)
        )
      `, [hasAssignment.driver_id, tourId, departure_datetime, arrival_datetime, arrival_datetime, departure_datetime]);

      if (conflictingAssignment) {
        return NextResponse.json(
          {
            message: 'Cannot update tour times: assigned driver has conflicting tour during new time period'
          },
          { status: 409 }
        );
      }
    }

    // Update the tour
    await query(`
      UPDATE tours SET 
        booking_date = ?,
        customer_name = ?,
        agent = ?,
        pax = ?,
        contact_details = ?,
        arrival_datetime = ?,
        departure_datetime = ?,
        flight_no = ?,
        flight_time = ?,
        remarks = ?,
        status = ?,
        pickup = ?,
        destination = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      booking_date,
      customer_name,
      agent,
      pax,
      contact_details,
      arrival_datetime,
      departure_datetime,
      flight_no || null,
      flight_time || null,
      remarks || null,
      status || existingTour.status,
      pickup || null,
      destination || null,
      tourId
    ]);

    // Get the updated tour with assignment details
    const updatedTour = await queryOne(`
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

    // Format the response
    const formattedTour = {
      id: updatedTour.id,
      booking_date: updatedTour.booking_date,
      customer_name: updatedTour.customer_name,
      agent: updatedTour.agent,
      pax: updatedTour.pax,
      contact_details: updatedTour.contact_details,
      arrival_datetime: formatToIST(updatedTour.arrival_datetime),
      departure_datetime: formatToIST(updatedTour.departure_datetime),
      flight_no: updatedTour.flight_no,
      flight_time: updatedTour.flight_time,
      remarks: updatedTour.remarks,
      status: updatedTour.status,
      pickup: updatedTour.pickup,
      destination: updatedTour.destination,
      created_at: formatToIST(updatedTour.created_at),
      updated_at: formatToIST(updatedTour.updated_at),
      created_by: updatedTour.created_by,
      assignment: updatedTour.assignment_id ? {
        id: updatedTour.assignment_id,
        assigned_at: formatToIST(updatedTour.assigned_at),
        assigned_by: updatedTour.assigned_by,
        driver: {
          id: updatedTour.driver_id,
          name: updatedTour.driver_name,
          phone: updatedTour.driver_phone,
          vehicle_type: updatedTour.driver_vehicle_type,
          vehicle_number: updatedTour.driver_vehicle_number
        }
      } : null
    };

    return NextResponse.json({
      message: 'Tour updated successfully',
      tour: formattedTour
    });

  } catch (error: any) {
    console.error('Update tour error:', error);
    return NextResponse.json(
      { message: 'Failed to update tour', error: error.message },
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
      'SELECT id FROM assignments WHERE tour_id = ?',
      [tourId]
    );

    if (assignment) {
      return NextResponse.json(
        { 
          message: 'Cannot delete tour: tour is currently assigned to a driver. Please unassign first.' 
        },
        { status: 409 }
      );
    }

    // Delete the tour (assignments are already handled by foreign key constraints)
    await query(
      'DELETE FROM tours WHERE id = ?',
      [tourId]
    );

    return NextResponse.json({
      message: 'Tour deleted successfully',
      deletedTour: {
        id: tourId,
        customer_name: tour.customer_name,
        status: tour.status
      }
    });

  } catch (error: any) {
    console.error('Delete tour error:', error);
    return NextResponse.json(
      { message: 'Failed to delete tour', error: error.message },
      { status: 500 }
    );
  }
}
