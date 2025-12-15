import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { getUserFromToken } from '@/lib/auth';
import { formatToIST, SYSCONFIG } from '@/lib/utils';
import { AuditLogger } from '@/lib/activity-logger.server';
import * as XLSX from 'xlsx';

interface DriverReportRequest {
  startDate: string;
  endDate: string;
  status: string[];
  download?: boolean;
  downloadAll?: boolean;
  page?: number;
  pageSize?: number;
  driverId?: string;
}

interface DriverReportData {
  driver: string;
  trip_id: string;
  agent_id: string;
  amount: number;
  paid_amount: number;
  pick_up: string;
  drop_off: string;
  passenger_name: string;
  pickup_datetime: string;
  currency?: string;
  payment_status?: string;
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

    const body: DriverReportRequest = await request.json();
    const { startDate, endDate, status, download=false, downloadAll=false, page = 1, pageSize = 10, driverId = "" } = body;

    // Skip validation if downloadAll is true
    if (!downloadAll) {
      // Validate mandatory parameters only for filtered reports
      if (!startDate || !endDate || !status) {
        return NextResponse.json(
          { message: 'Missing required parameters: startDate, endDate, status are mandatory' },
          { status: 400 }
        );
      }

      // Validate status array
      if (!Array.isArray(status) || status.length === 0) {
        return NextResponse.json(
          { message: 'Status must be a non-empty array' },
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

    let driverReports: any[] = [];
    let summary: any = {};
    let totalCount = 0;

    if (downloadAll) {
      // Get all driver payment data without any filters
      console.log('Fetching all driver report...');
      driverReports = await query(
        `SELECT 
          d.name as driver,
          d.id as driver_id,
          t.id as trip_id,
          t.agent as agent_id,
          COALESCE(p.amount, 0) as amount,
          COALESCE(p.paid_amount, 0) as paid_amount,
          t.pickup as pick_up,
          t.destination as drop_off,
          t.customer_name as passenger_name,
          t.pickup_datetime as pickup_datetime,
          t.arrival_datetime as arrival_datetime,
          t.status as tour_status,
          p.currency,
          p.status as payment_status
        FROM assignments a
        INNER JOIN drivers d ON a.driver_id = d.id
        INNER JOIN tours t ON a.tour_id = t.id
        LEFT JOIN payments p ON (p.driver_id = d.id AND p.tour_id = t.id AND p.type = 'driver_payment')
        ORDER BY COALESCE(t.pickup_datetime, t.arrival_datetime) DESC, t.created_at DESC`
      ) as any[];
      totalCount = driverReports.length;
      console.log(`Found ${totalCount} driver report records`);
    } else {
      // Build dynamic WHERE clause for payment status with fallback datetime logic
      const statusPlaceholders = status.map(() => '?').join(',');
      const whereClause = `
        WHERE (
          (t.pickup_datetime IS NOT NULL AND DATE(t.pickup_datetime) >= ? AND DATE(t.pickup_datetime) <= ?)
          OR 
          (t.pickup_datetime IS NULL AND DATE(t.arrival_datetime) >= ? AND DATE(t.arrival_datetime) <= ?)
        )
        AND p.status IN (${statusPlaceholders})
        AND d.id LIKE ?
      `;

      // Query parameters - need to include startDate and endDate twice for both conditions
      const queryParams = [
        startDate,  // for pickup_datetime >= ?
        endDate,    // for pickup_datetime <= ?
        startDate,  // for arrival_datetime >= ?
        endDate,    // for arrival_datetime <= ?
        ...status,
        driverId
      ];

    //   console.log('Query params:', queryParams);
    //   console.log('Where clause:', whereClause);

      if (download) {
        console.log('Fetching driver report...');
        // For download, get all filtered data without pagination
        driverReports = await query(
          `SELECT 
            d.name as driver,
            d.id as driver_id,
            t.id as trip_id,
            t.agent as agent_id,
            COALESCE(p.amount, 0) as amount,
            COALESCE(p.paid_amount, 0) as paid_amount,
            t.pickup as pick_up,
            t.destination as drop_off,
            t.customer_name as passenger_name,
            t.pickup_datetime as pickup_datetime,
            t.arrival_datetime as arrival_datetime,
            t.status as tour_status,
            p.currency,
            p.status as payment_status
          FROM assignments a
          INNER JOIN drivers d ON a.driver_id = d.id
          INNER JOIN tours t ON a.tour_id = t.id
          INNER JOIN payments p ON (p.driver_id = d.id AND p.tour_id = t.id AND p.type = 'driver_payment')
          ${whereClause}
          ORDER BY COALESCE(t.pickup_datetime, t.arrival_datetime) DESC, t.created_at DESC`,
          queryParams
        ) as any[];
        totalCount = driverReports.length;
        console.log(`Found ${totalCount} records for download`);
      } else {
        // Get total count for pagination
        const totalResult = await query(
          `SELECT COUNT(*) as total FROM assignments a
           INNER JOIN drivers d ON a.driver_id = d.id
           INNER JOIN tours t ON a.tour_id = t.id
           INNER JOIN payments p ON (p.driver_id = d.id AND p.tour_id = t.id AND p.type = 'driver_payment')
           ${whereClause}`,
          queryParams
        ) as any[];
        totalCount = totalResult[0]?.total || 0;
        
        console.log(`Total count: ${totalCount}`);

        // If no records found, return early with debug info
        if (totalCount === 0) {
          // Debug query to see what data exists
        //   const debugData = await query(
        //     `SELECT 
        //       COUNT(*) as total_assignments,
        //       COUNT(DISTINCT p.status) as unique_payment_statuses,
        //       GROUP_CONCAT(DISTINCT p.status) as all_payment_statuses,
        //       COUNT(DISTINCT t.status) as unique_tour_statuses,
        //       GROUP_CONCAT(DISTINCT t.status) as all_tour_statuses,
        //       MIN(DATE(COALESCE(t.pickup_datetime, t.arrival_datetime))) as earliest_date,
        //       MAX(DATE(COALESCE(t.pickup_datetime, t.arrival_datetime))) as latest_date
        //     FROM assignments a
        //     INNER JOIN drivers d ON a.driver_id = d.id
        //     INNER JOIN tours t ON a.tour_id = t.id
        //     LEFT JOIN payments p ON (p.driver_id = d.id AND p.tour_id = t.id AND p.type = 'driver_payment')`
        //   ) as any[];

        //   console.log('Debug data:', debugData[0]);

          return NextResponse.json({
            message: 'No driver reports found for the specified criteria',
            // debug: debugData[0],
            filters: { startDate, endDate, status },
            summary: {
              total_records: 0,
            //   total_amount: 0,
            //   total_paid_amount: 0,
              unique_drivers: 0,
              date_range: { start_date: startDate, end_date: endDate },
              drivers_included: [],
              status_filter: status
            },
            data: [],
            pagination: {
              page: 1,
              pageSize: 10,
              total: 0,
              totalPages: 0,
              hasNextPage: false,
              hasPreviousPage: false
            }
          });
        }

        // Calculate offset for pagination
        const offset = (page - 1) * pageSize;

        // Get paginated filtered driver report data
        driverReports = await query(
          `SELECT 
            d.name as driver,
            d.id as driver_id,
            t.id as trip_id,
            t.agent as agent_id,
            COALESCE(p.amount, 0) as amount,
            COALESCE(p.paid_amount, 0) as paid_amount,
            t.pickup as pick_up,
            t.destination as drop_off,
            t.customer_name as passenger_name,
            t.pickup_datetime as pickup_datetime,
            t.arrival_datetime as arrival_datetime,
            t.status as tour_status,
            p.currency,
            p.status as payment_status
          FROM assignments a
          INNER JOIN drivers d ON a.driver_id = d.id
          INNER JOIN tours t ON a.tour_id = t.id
          INNER JOIN payments p ON (p.driver_id = d.id AND p.tour_id = t.id AND p.type = 'driver_payment')
          ${whereClause}
          ORDER BY COALESCE(t.pickup_datetime, t.arrival_datetime) DESC, t.created_at DESC
          LIMIT ${pageSize} OFFSET ${offset}`,
          queryParams
        ) as any[];

        console.log(`Found ${driverReports.length} records after pagination`);
      }
    }

    // Debug: Log first few records
    // if (driverReports.length > 0) {
    //   console.log('First record:', driverReports[0]);
    // }

    // Format the data with better error handling
    const formattedReports: DriverReportData[] = driverReports.map((report, index) => {
      try {
        return {
          driver: report.driver || 'Unknown Driver',
          trip_id: report.trip_id || '-',
          agent_id: report.agent_id || '-',
          amount: parseFloat(report.amount || 0),
          paid_amount: parseFloat(report.paid_amount || 0),
          pick_up: report.pick_up || '-',
          drop_off: report.drop_off || '-',
          passenger_name: report.passenger_name || '-',
          pickup_datetime: report.pickup_datetime 
            ? formatToIST(report.pickup_datetime) 
            : (report.arrival_datetime ? formatToIST(report.arrival_datetime) : '-'),
          currency: report.currency || '-',
          payment_status: report.payment_status || '-'
        };
      } catch (formatError) {
        console.error(`Error formatting record ${index}:`, formatError, report);
        return {
          driver: 'Error',
          trip_id: '-',
          agent_id: '-',
          amount: 0,
          paid_amount: 0,
          pick_up: '-',
          drop_off: '-',
          passenger_name: '-',
          pickup_datetime: '-',
          currency: 'USD',
          payment_status: 'Error'
        };
      }
    });

    console.log(`Formatted ${formattedReports.length} records`);

    // Calculate summary statistics
    const totalRecords = formattedReports.length;
    // const totalAmount = formattedReports.reduce((sum, report) => sum + report.amount, 0);
    // const totalPaidAmount = formattedReports.reduce((sum, report) => sum + report.paid_amount, 0);
    const driverNames = formattedReports
      .map(report => report.driver)
      .filter(driver => driver && driver.trim() !== '');
    const uniqueDrivers = Array.from(new Set(driverNames));

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
        // total_amount: parseFloat(totalAmount.toFixed(2)),
        // total_paid_amount: parseFloat(totalPaidAmount.toFixed(2)),
        unique_drivers: uniqueDrivers.length,
        date_range: 'All Records',
        drivers_included: uniqueDrivers,
        status_filter: 'All Statuses'
      };
    } else {
      summary = {
        total_records: download ? totalCount : totalRecords,
        // total_amount: parseFloat(totalAmount.toFixed(2)),
        // total_paid_amount: parseFloat(totalPaidAmount.toFixed(2)),
        unique_drivers: uniqueDrivers.length,
        date_range: {
          start_date: startDate,
          end_date: endDate
        },
        drivers_included: uniqueDrivers,
        status_filter: status
      };
    }

    // If download is requested, generate Excel file
    if (download || downloadAll) {
      try {
        // Prepare data for Excel
        const excelData = formattedReports.map((report, index) => ({
          'S/N': index + 1,
          'Driver': report.driver,
          'Trip ID': report.trip_id,
          'Agent ID': report.agent_id,
          'Amount': report.amount,
          'Paid Amount': report.paid_amount,
          'Pick Up': report.pick_up,
          'Drop Off': report.drop_off,
          'Passenger Name': report.passenger_name,
          'Transfer Date': report.pickup_datetime,
          'Currency': report.currency,
          'Payment Status': report.payment_status
        }));

        // Add summary row at the end
        // excelData.push({
        //   'S/N': '' as any,
        //   'Driver': '',
        //   'Trip ID': '',
        //   'Agent ID': '',
        //   'Amount': totalAmount,
        //   'Paid Amount': totalPaidAmount,
        //   'Pick Up': '',
        //   'Drop Off': '',
        //   'Passenger Name': 'TOTAL:',
        //   'Transfer Date': '',
        //   'Currency': '',
        //   'Payment Status': ''
        // });

        // Create workbook and worksheet
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(excelData);

        // Set column widths
        const columnWidths = [
          { wch: 5 },   // S/N
          { wch: 20 },  // Driver
          { wch: 12 },  // Trip ID
          { wch: 15 },  // Agent ID
          { wch: 15 },  // Amount
          { wch: 15 },  // Paid Amount
          { wch: 20 },  // Pick Up
          { wch: 20 },  // Drop Off
          { wch: 25 },  // Passenger Name
          { wch: 18 },  // Transfer Date
          { wch: 10 },  // Currency
          { wch: 15 }   // Payment Status
        ];
        worksheet['!cols'] = columnWidths;

        // Style the header row
        const headerStyle = {
          font: { bold: true },
          fill: { fgColor: { rgb: "E0E0E0" } }
        };

        // Apply header styling (row 1)
        const headerCells = ['A1', 'B1', 'C1', 'D1', 'E1', 'F1', 'G1', 'H1', 'I1', 'J1', 'K1', 'L1'];
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
                           `I${totalRowNum}`, `J${totalRowNum}`, `K${totalRowNum}`, `L${totalRowNum}`];
        totalCells.forEach(cell => {
          if (worksheet[cell]) {
            worksheet[cell].s = totalRowStyle;
          }
        });

        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Driver Report');

        // Generate Excel buffer
        const excelBuffer = XLSX.write(workbook, { 
          type: 'buffer', 
          bookType: 'xlsx',
          compression: true
        });

        // Create filename with timestamp
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const filename = downloadAll 
          ? `All_Drivers_Report_${timestamp}.xlsx`
          : `Driver_Report_${startDate}_to_${endDate}_${timestamp}.xlsx`;

        // 🔥 LOG AUDIT ACTIVITY - EXCEL DOWNLOAD
        await auditLogger.logRead('driver_report_excel', 'download_excel', SYSCONFIG.SUCCESS, {
          filters: downloadAll ? { downloadAll: true } : { startDate, endDate, status: status },
          result_count: totalRecords,
        //   total_amount: totalAmount,
        //   total_paid_amount: totalPaidAmount,
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

    // 🔥 LOG AUDIT ACTIVITY - DRIVER REPORT GENERATION
    await auditLogger.logRead('driver_report', 'generate_report', SYSCONFIG.SUCCESS, {
      filters: downloadAll ? { downloadAll: true } : { startDate, endDate, status: status },
      result_count: totalRecords,
    //   total_amount: totalAmount,
    //   total_paid_amount: totalPaidAmount
    });

    // Build response
    const response: any = {
      message: downloadAll ? 'All drivers report generated successfully' : 'Driver report generated successfully',
      summary,
      data: formattedReports
    };

    // Add pagination only for non-download requests
    if (paginationMeta) {
      response.pagination = paginationMeta;
    }

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('Driver report error:', error);
    return NextResponse.json(
      { message: 'Failed to generate driver report', error: error.message },
      { status: 500 }
    );
  }
}

// GET method to retrieve available payment statuses for filter dropdown
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.substring(7);
    const user = await getUserFromToken(token!);

    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // Return available payment statuses
    const statusList = [
      { value: SYSCONFIG.PENDING, label: SYSCONFIG.PENDING },
      { value: SYSCONFIG.COMPLETED, label: SYSCONFIG.COMPLETED },
      { value: SYSCONFIG.CANCELLED, label: SYSCONFIG.CANCELLED }
    ];

    return NextResponse.json({
      statuses: statusList,
      count: statusList.length
    });

  } catch (error: any) {
    console.error('Get statuses error:', error);
    return NextResponse.json(
      { message: 'Failed to get statuses list', error: error.message },
      { status: 500 }
    );
  }
}
