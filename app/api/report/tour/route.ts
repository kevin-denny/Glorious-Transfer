import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { getUserFromToken } from '@/lib/auth';
import { formatToIST, SYSCONFIG } from '@/lib/utils';
import { AuditLogger } from '@/lib/activity-logger.server';

interface TourReportRequest {
  startDate: string;
  endDate: string;
  agent: string[];
  download?: boolean;
  downloadAll?: boolean;
}

interface TourReportData {
  agent: string;
  pickup_datetime: string;
  agent_ref: string;
  trip_id: string;
  passenger_name: string;
  pick_up: string;
  drop_off: string;
  income_amount: number;
  currency?: string;
  category?: string;
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.substring(7);
    const user = await getUserFromToken(token!);

    if (!user || !(user.role === SYSCONFIG.ADMINISTRATOR || user.role === SYSCONFIG.FINANCE || user.role === SYSCONFIG.OPERATIONS)) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
    }

    // Initialize audit logger
    const auditLogger = new AuditLogger({
      id: user.id,
      name: user.full_name || user.email,
      role: user.role,
    });

    const body: TourReportRequest = await request.json();
    const { startDate, endDate, agent, download=false, downloadAll=false } = body;

    // Validate mandatory parameters
    if (!startDate || !endDate || !agent) {
      return NextResponse.json(
        { message: 'Missing required parameters: startDate, endDate, agent are mandatory' },
        { status: 400 }
      );
    }

    // Validate agent array
    if (!Array.isArray(agent) || agent.length === 0) {
      return NextResponse.json(
        { message: 'Agent must be a non-empty array' },
        { status: 400 }
      );
    }

    // Simple date format validation (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      return NextResponse.json(
        { message: 'Invalid date format. Use YYYY-MM-DD format' },
        { status: 400 }
      );
    }

    // Validate date format
    const startDateObj = formatToIST(new Date(startDate));
    const endDateObj = formatToIST(new Date(endDate));

    // Validate date range
    if (startDateObj > endDateObj) {
      return NextResponse.json(
        { message: 'Start date must be before or equal to end date' },
        { status: 400 }
      );
    }

    // Build dynamic WHERE clause for agents with fallback datetime logic
    const agentPlaceholders = agent.map(() => '?').join(',');
    const whereClause = `
      WHERE (
        (t.pickup_datetime IS NOT NULL AND DATE(t.pickup_datetime) >= ? AND DATE(t.pickup_datetime) <= ?)
        OR 
        (t.pickup_datetime IS NULL AND DATE(t.arrival_datetime) >= ? AND DATE(t.arrival_datetime) <= ?)
      )
      AND t.agent IN (${agentPlaceholders})
      AND t.status IN (?, ?, ?)
    `;

    // Query parameters - need to include startDate and endDate twice for both conditions
    const queryParams = [
      startDate,  // for pickup_datetime >= ?
      endDate,    // for pickup_datetime <= ?
      startDate,  // for arrival_datetime >= ?
      endDate,    // for arrival_datetime <= ?
      ...agent,
      SYSCONFIG.PENDING,
      SYSCONFIG.ASSIIGNED,
      SYSCONFIG.COMPLETED
    ];

    // Get tour report data
    const tourReports = await query(
      `SELECT 
        t.agent,
        t.pickup_datetime as pickup_datetime,
        t.arrival_datetime as arrival_datetime,
        t.agent_ref,
        t.id as trip_id,
        t.customer_name as passenger_name,
        t.pickup as pick_up,
        t.destination as drop_off,
        COALESCE(t.amount, 0) as income_amount,
        t.currency,
        t.status,
        t.pax,
        t.created_at,
        t.category
      FROM tours t
      ${whereClause}
      ORDER BY t.pickup_datetime ASC, t.created_at ASC`,
      queryParams
    ) as any[];

    // Format the data
    const formattedReports: TourReportData[] = tourReports.map(tour => ({
      agent: tour.agent,
      pickup_datetime: tour.pickup_datetime? formatToIST(tour.pickup_datetime) : formatToIST(tour.arrival_datetime), // Already in YYYY-MM-DD format from MySQL DATE column
      agent_ref: tour.agent_ref || '-',
      trip_id: tour.trip_id,
      passenger_name: tour.passenger_name,
      pick_up: tour.pick_up || '-',
      drop_off: tour.drop_off || '-',
      income_amount: parseFloat(tour.income_amount || 0),
      currency: tour.currency || '-',
      category: tour.category || '-'
    }));

    // Calculate summary statistics
    const totalRecords = formattedReports.length;
    const totalIncome = formattedReports.reduce((sum, report) => sum + report.income_amount, 0);
    const agentNames = formattedReports
      .map(report => report.agent)
      .filter(agent => agent && agent.trim() !== '');
    const uniqueAgents = Array.from(new Set(agentNames));

    const summary = {
      total_records: totalRecords,
      total_income: parseFloat(totalIncome.toFixed(2)),
      unique_agents: uniqueAgents.length,
      date_range: {
        start_date: startDate,
        end_date: endDate
      },
      agents_included: uniqueAgents
    };

    // 🔥 LOG AUDIT ACTIVITY - TOUR REPORT GENERATION
    await auditLogger.logRead('tour_report', 'generate_report', SYSCONFIG.SUCCESS, {
      filters: {
        startDate,
        endDate,
        agents: agent
      },
      result_count: totalRecords,
      total_income: totalIncome
    });

    return NextResponse.json({
      message: 'Tour report generated successfully',
      summary,
      data: formattedReports
    });

  } catch (error: any) {
    console.error('Tour report error:', error);
    return NextResponse.json(
      { message: 'Failed to generate tour report', error: error.message },
      { status: 500 }
    );
  }
}

// GET method to retrieve available agents for filter dropdown
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.substring(7);
    const user = await getUserFromToken(token!);

    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // Get unique agents from tours table
    const agents = await query(
      `SELECT DISTINCT agent 
       FROM tours 
       WHERE agent IS NOT NULL AND agent != ''
       ORDER BY agent ASC`
    ) as any[];

    const agentList = agents.map(item => item.agent);

    return NextResponse.json({
      agents: agentList,
      count: agentList.length
    });

  } catch (error: any) {
    console.error('Get agents error:', error);
    return NextResponse.json(
      { message: 'Failed to get agents list', error: error.message },
      { status: 500 }
    );
  }
}
