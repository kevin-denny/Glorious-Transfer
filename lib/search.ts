import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { query } from './db';
import { formatToIST, SYSCONFIG } from './utils';

export interface SearchResult {
  type: 'driver' | 'tour' | 'payment' | 'activity_log';
  id: string;
  title: string;
  subtitle: string;
  data: any;
}

export async function performSearch(q: string, type: string, limit: number): Promise<NextResponse> {
  try {

    // Validate search term
    if (!q || q.trim().length < 1) {
      return NextResponse.json(
        { message: 'Search term must be at least 1 character' },
        { status: 400 }
      );
    }

    // Validate limit
    if (limit < 1 || limit > 50) {
      return NextResponse.json(
        { message: 'Limit must be between 1 and 50' },
        { status: 400 }
      );
    }

    let results;

    switch (type) {
      case SYSCONFIG.DRIVER:
        results = await searchDrivers(q, limit);
        break;
      case SYSCONFIG.TOUR:
        results = await searchTours(q, limit);
        break;
      case SYSCONFIG.PAYMENT:
        results = await searchPayments(q, limit);
        break;
      case SYSCONFIG.ACTIVITY_LOG:
        results = await searchActivityLogs(q, limit);
        break;
      case SYSCONFIG.ALL:
        results = await universalSearch(q, Math.floor(limit / 4));
        break;
      default:
        return NextResponse.json(
          { message: 'Invalid search type. Must be: driver, tour, payment, activity_log, or all' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      query: q,
      type,
      count: results.length,
      results
    });

  } catch (error: any) {
    console.error('Search error:', error);
    return NextResponse.json(
      { message: 'Search failed', error: error.message },
      { status: 500 }
    );
  }
}

// Search drivers by ID or name
export async function searchDrivers(searchTerm: string, limit: number = 10): Promise<SearchResult[]> {
  const results = await query(
    `SELECT * FROM drivers 
     WHERE id LIKE ? OR name LIKE ? OR driver_number LIKE ?
     LIMIT ?`,
    [`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`, limit]
  ) as any[];

  return results.map(driver => ({
    type: 'driver',
    id: driver.id,
    title: driver.name,
    subtitle: `${driver.driver_number} - ${driver.vehicle_type} (${driver.vehicle_plate})`,
    data: {
      ...driver,
      created_at: formatToIST(driver.created_at),
      updated_at: formatToIST(driver.updated_at)
    }
  }));
}

// Search tours by ID, booking ref, or customer name
export async function searchTours(searchTerm: string, limit: number = 10): Promise<SearchResult[]> {
  const results = await query(
    `SELECT * FROM tours 
     WHERE id LIKE ? OR booking_ref LIKE ? OR customer_name LIKE ?
     LIMIT ?`,
    [`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`, limit]
  ) as any[];

  return results.map(tour => ({
    type: 'tour',
    id: tour.id,
    title: `${tour.booking_ref} - ${tour.customer_name}`,
    subtitle: `${tour.agent} | ${tour.pax} pax | ${tour.status}`,
    data: {
      ...tour,
      created_at: formatToIST(tour.created_at),
      updated_at: formatToIST(tour.updated_at),
      arrival_datetime: formatToIST(tour.arrival_datetime),
      departure_datetime: formatToIST(tour.departure_datetime)
    }
  }));
}

// Search payments by ID or tour ID
export async function searchPayments(searchTerm: string, limit: number = 10): Promise<SearchResult[]> {
  const results = await query(
    `SELECT p.*, t.customer_name, t.booking_ref 
     FROM payments p
     LEFT JOIN tours t ON p.tour_id = t.id
     WHERE p.id LIKE ? OR p.tour_id LIKE ?
     LIMIT ?`,
    [`%${searchTerm}%`, `%${searchTerm}%`, limit]
  ) as any[];

  return results.map(payment => ({
    type: 'payment',
    id: payment.id,
    title: `Payment ${payment.id}`,
    subtitle: `${payment.booking_ref || 'N/A'} - ${payment.customer_name || 'N/A'} | Amount: ${payment.amount}`,
    data: {
      ...payment,
      created_at: formatToIST(payment.created_at),
      updated_at: formatToIST(payment.updated_at)
    }
  }));
}

// Search activity logs by ID or user ID
export async function searchActivityLogs(searchTerm: string, limit: number = 10): Promise<SearchResult[]> {
  const results = await query(
    `SELECT al.*, p.full_name 
     FROM activity_logs al
     LEFT JOIN profiles p ON al.user_id = p.id
     WHERE al.id LIKE ? OR al.user_id LIKE ? OR al.action LIKE ?
     LIMIT ?`,
    [`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`, limit]
  ) as any[];

  return results.map(log => ({
    type: 'activity_log',
    id: log.id,
    title: log.action,
    subtitle: `${log.full_name || 'Unknown'} | ${log.entity_type} - ${log.entity_id}`,
    data: {
      ...log,
      created_at: formatToIST(log.created_at)
    }
  }));
}

// Universal search across all entities
export async function universalSearch(searchTerm: string, limit: number = 5): Promise<SearchResult[]> {
  const [drivers, tours, payments, activityLogs] = await Promise.all([
    searchDrivers(searchTerm, limit),
    searchTours(searchTerm, limit),
    searchPayments(searchTerm, limit),
    searchActivityLogs(searchTerm, limit)
  ]);

  return [...drivers, ...tours, ...payments, ...activityLogs];
}
