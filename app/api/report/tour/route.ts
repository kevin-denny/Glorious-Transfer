import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { getUserFromToken } from '@/lib/auth';
import { formatToIST, SYSCONFIG } from '@/lib/utils';
import { AuditLogger } from '@/lib/activity-logger.server';
import * as XLSX from 'xlsx';

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

interface TourReportRequest {
  startDate: string;
  endDate: string;
  agent: string[];
  download?: boolean;
  downloadAll?: boolean;
  page?: number;
  pageSize?: number;
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
    const { startDate, endDate, agent, download=false, downloadAll=false, page = 1, pageSize = 10 } = body;

    // Skip validation if downloadAll is true
    if (!downloadAll) {
      // Validate mandatory parameters only for filtered reports
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
    }

    // Validate pagination parameters (for non-download requests)
    if (!download && !downloadAll) {
      if (page < 1 || pageSize < 1 || pageSize > 100) {
        return NextResponse.json(
          { message: 'Invalid pagination parameters. Page must be >= 1 and pageSize between 1-100' },
          { status: 400 }
        );
      }
    }

    let tourReports: any[] = [];
    let summary: any = {};
    let totalCount = 0;

    if (downloadAll) {
      // Get all tour data without any filters
      tourReports = await query(
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
        ORDER BY t.pickup_datetime ASC, t.created_at ASC`
      ) as any[];
      totalCount = tourReports.length;
    } else {
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

      if (download) {
        // For download, get all filtered data without pagination
        tourReports = await query(
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
        totalCount = tourReports.length;
      } else {
        // Get total count for pagination
        const totalResult = await query(
          `SELECT COUNT(*) as total FROM tours t ${whereClause}`,
          queryParams
        ) as any[];
        totalCount = totalResult[0]?.total || 0;

        // Calculate offset for pagination
        const offset = (page - 1) * pageSize;

        // Get paginated filtered tour report data
        tourReports = await query(
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
          ORDER BY t.pickup_datetime ASC, t.created_at ASC
          LIMIT ${pageSize} OFFSET ${offset}`,
          queryParams
        ) as any[];
      }
    }

    // Format the data
    const formattedReports: TourReportData[] = tourReports.map(tour => ({
      agent: tour.agent,
      pickup_datetime: tour.pickup_datetime? formatToIST(tour.pickup_datetime) : formatToIST(tour.arrival_datetime),
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
    // const totalIncome = formattedReports.reduce((sum, report) => sum + report.income_amount, 0);
    const agentNames = formattedReports
      .map(report => report.agent)
      .filter(agent => agent && agent.trim() !== '');
    const uniqueAgents = Array.from(new Set(agentNames));

    // Calculate pagination metadata (only for non-download requests)
    let paginationMeta = null;
    if (!download && !downloadAll) {
      const totalPages = Math.ceil(totalCount / pageSize);
      const hasNextPage = page < totalPages;
      const hasPreviousPage = page > 1;

      paginationMeta = {
        page,
        pageSize,
        total: totalCount,
        totalPages,
        hasNextPage,
        hasPreviousPage
      };
    }

    if (downloadAll) {
      summary = {
        total_records: totalCount,
        // total_income: parseFloat(totalIncome.toFixed(2)),
        unique_agents: uniqueAgents.length,
        date_range: 'All Records',
        agents_included: uniqueAgents
      };
    } else {
      summary = {
        total_records: download ? totalCount : totalRecords,
        // total_income: parseFloat(totalIncome.toFixed(2)),
        unique_agents: uniqueAgents.length,
        date_range: {
          start_date: startDate,
          end_date: endDate
        },
        agents_included: uniqueAgents
      };
    }

    // If download is requested, generate Excel file
    if (download || downloadAll) {
      try {
        // Prepare data for Excel
        const excelData = formattedReports.map((report, index) => ({
          'S/N': index + 1,
          'Agent': report.agent,
          'Transfer Date': report.pickup_datetime,
          'Agent Ref': report.agent_ref,
          'Trip ID': report.trip_id,
          'Passenger Name': report.passenger_name,
          'Pick Up': report.pick_up,
          'Drop Off': report.drop_off,
          'Category': report.category,
          'Currency': report.currency,
          'Income Amount': report.income_amount
        }));

        // Add summary row at the end
        // excelData.push({
        //   'S/N': '' as any,
        //   'Agent': '',
        //   'Transfer Date': '',
        //   'Agent Ref': '',
        //   'Trip ID': '',
        //   'Passenger Name': '',
        //   'Pick Up': '',
        //   'Drop Off': '',
        //   'Category': 'TOTAL:',
        //   'Currency': '',
        //   'Income Amount': totalIncome
        // });

        // Create workbook and worksheet
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(excelData);

        // Set column widths
        const columnWidths = [
          { wch: 5 },   // S/N
          { wch: 20 },  // Agent
          { wch: 18 },  // Transfer Date
          { wch: 15 },  // Agent Ref
          { wch: 12 },  // Trip ID
          { wch: 25 },  // Passenger Name
          { wch: 20 },  // Pick Up
          { wch: 20 },  // Drop Off
          { wch: 15 },  // Category
          { wch: 10 },  // Currency
          { wch: 15 }   // Income Amount
        ];
        worksheet['!cols'] = columnWidths;

        // Style the header row
        const headerStyle = {
          font: { bold: true },
          fill: { fgColor: { rgb: "E0E0E0" } }
        };

        // Apply header styling (row 1)
        const headerCells = ['A1', 'B1', 'C1', 'D1', 'E1', 'F1', 'G1', 'H1', 'I1', 'J1', 'K1'];
        headerCells.forEach(cell => {
          if (worksheet[cell]) {
            worksheet[cell].s = headerStyle;
          }
        });

        // Style the total row
        const totalRowNum = excelData.length;
        const totalRowStyle = {
          font: { bold: true },
          fill: { fgColor: { rgb: "FFE0B2" } }
        };

        // Apply total row styling
        const totalCells = [`A${totalRowNum}`, `B${totalRowNum}`, `C${totalRowNum}`, `D${totalRowNum}`, 
                           `E${totalRowNum}`, `F${totalRowNum}`, `G${totalRowNum}`, `H${totalRowNum}`, 
                           `I${totalRowNum}`, `J${totalRowNum}`, `K${totalRowNum}`];
        totalCells.forEach(cell => {
          if (worksheet[cell]) {
            worksheet[cell].s = totalRowStyle;
          }
        });

        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Tour Report');

        // Generate Excel buffer
        const excelBuffer = XLSX.write(workbook, { 
          type: 'buffer', 
          bookType: 'xlsx',
          compression: true
        });

        // Create filename with timestamp
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const filename = downloadAll 
          ? `All_Tours_Report_${timestamp}.xlsx`
          : `Tour_Report_${startDate}_to_${endDate}_${timestamp}.xlsx`;

        // 🔥 LOG AUDIT ACTIVITY - EXCEL DOWNLOAD
        await auditLogger.logRead('tour_report_excel', 'download_excel', SYSCONFIG.SUCCESS, {
          filters: downloadAll ? { downloadAll: true } : { startDate, endDate, agents: agent },
          result_count: totalRecords,
        //   total_income: totalIncome,
          filename
        });

        // Return Excel file as response
        return new NextResponse(excelBuffer, {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Content-Length': excelBuffer.length.toString(),
          },
        });

      } catch (excelError: any) {
        console.error('Excel generation error:', excelError);
        return NextResponse.json(
          { message: 'Failed to generate Excel file', error: excelError.message },
          { status: 500 }
        );
      }
    }

    // 🔥 LOG AUDIT ACTIVITY - TOUR REPORT GENERATION
    await auditLogger.logRead('tour_report', 'generate_report', SYSCONFIG.SUCCESS, {
      filters: downloadAll ? { downloadAll: true } : { startDate, endDate, agents: agent },
      result_count: totalRecords,
    //   total_income: totalIncome
    });

    // Build response
    const response: any = {
      message: downloadAll ? 'All tours report generated successfully' : 'Tour report generated successfully',
      summary,
      data: formattedReports
    };

    // Add pagination only for non-download requests
    if (paginationMeta) {
      response.pagination = paginationMeta;
    }

    return NextResponse.json(response);

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
