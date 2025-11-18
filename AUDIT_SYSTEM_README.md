# Audit Logging System - Implementation Guide

This document explains the comprehensive audit logging system implemented for the Glorious Transfer application.

## 📋 Overview

The audit logging system automatically tracks all CRUD operations across your application, storing detailed logs in the `activity_logs` table. It provides:

- **Complete Activity Tracking**: Every create, read, update, delete operation
- **User Attribution**: Who performed each action
- **Data Changes**: Before/after data for updates
- **Contextual Details**: Additional metadata for each operation
- **Query API**: Paginated retrieval with filtering capabilities

## 🏗️ Architecture

### 1. Database Schema
```sql
CREATE TABLE activity_logs (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id CHAR(36),
  user_name VARCHAR(255) NOT NULL,
  user_role ENUM('administrator', 'finance', 'operations') NOT NULL,
  action VARCHAR(255) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id CHAR(36),
  details JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  -- Foreign keys and indexes...
);
```

### 2. Core Components

- **`/lib/activity-logger.ts`**: Core audit logging functionality
- **`/app/api/audit/route.ts`**: API endpoint for retrieving audit logs
- **`/lib/audit-integration-example.ts`**: Integration examples

## 🚀 Quick Start

### Step 1: Import the AuditLogger
```typescript
import { AuditLogger } from '@/lib/activity-logger';
```

### Step 2: Initialize After Authentication
```typescript
const user = await getUserFromToken(token!);
const auditLogger = new AuditLogger({
  id: user.id,
  name: user.full_name || user.email,
  role: user.role
});
```

### Step 3: Log Operations
```typescript
// CREATE operation
await auditLogger.logCreate('tour', tourId, newTourData, {
  booking_source: 'web_portal'
});

// UPDATE operation
const oldData = await queryOne('SELECT * FROM tours WHERE id = ?', [tourId]);
// ... perform update ...
const newData = await queryOne('SELECT * FROM tours WHERE id = ?', [tourId]);
await auditLogger.logUpdate('tour', tourId, oldData, newData);

// DELETE operation
const dataToDelete = await queryOne('SELECT * FROM tours WHERE id = ?', [tourId]);
await query('DELETE FROM tours WHERE id = ?', [tourId]);
await auditLogger.logDelete('tour', tourId, dataToDelete);
```

## 📊 API Usage

### GET /api/audit - Retrieve Audit Logs

**Query Parameters:**
- `page` (default: 1): Page number
- `pageSize` (default: 20, max: 100): Items per page
- `entity_type`: Filter by entity type (tour, driver, assignment, etc.)
- `action`: Filter by action (CREATE_TOUR, UPDATE_DRIVER, etc.)
- `user_id`: Filter by user who performed the action
- `entity_id`: Filter by specific entity ID
- `date_from`: Filter from date (YYYY-MM-DD)
- `date_to`: Filter to date (YYYY-MM-DD)

**Example Request:**
```bash
GET /api/audit?page=1&pageSize=20&entity_type=tour&date_from=2024-11-01
```

**Response:**
```json
{
  "data": [
    {
      "id": "L123456",
      "user_id": "U123456",
      "user_name": "John Admin",
      "user_role": "administrator",
      "action": "CREATE_TOUR",
      "entity_type": "tour",
      "entity_id": "T789012",
      "details": {
        "new_data": {
          "customer_name": "Jane Doe",
          "pickup": "Airport",
          "destination": "Hotel"
        },
        "booking_source": "web_portal"
      },
      "created_at": "2024-11-19 10:30:00 IST"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 150,
    "totalPages": 8,
    "hasNextPage": true,
    "hasPreviousPage": false
  },
  "filters": {
    "entity_type": "tour",
    "date_from": "2024-11-01"
  }
}
```

## 🔧 Integration Examples

### 1. Tours API Integration
```typescript
// In your tours POST endpoint
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken(token!);
    const auditLogger = new AuditLogger({
      id: user.id,
      name: user.full_name || user.email,
      role: user.role
    });

    const body = await request.json();
    
    // Create tour
    const tourId = await generateUniqueTourId();
    await query('INSERT INTO tours (...) VALUES (...)', [...]);
    
    // 🔥 LOG AUDIT
    await auditLogger.logCreate('tour', tourId, body, {
      booking_source: 'admin_panel',
      ip_address: request.headers.get('x-forwarded-for')
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    // Log failed attempts too
    await auditLogger?.logCreate('tour', 'unknown', null, {
      error: error.message,
      status: 'failed'
    });
    throw error;
  }
}
```

### 2. Assignment Operations
```typescript
// Special methods for assignment operations
await auditLogger.logAssign(tourId, driverId, {
  tour_details: { customer_name: 'John Doe' },
  driver_details: { name: 'Driver Name' }
});

await auditLogger.logUnassign(tourId, driverId, {
  reason: 'driver_unavailable'
});
```

## 📝 Available Methods

### AuditLogger Class Methods

#### `logCreate(entity_type, entity_id, newData, additionalDetails?)`
- Logs creation of new records
- **Action Format**: `CREATE_{ENTITY_TYPE}`

#### `logRead(entity_type, entity_id?, additionalDetails?)`
- Logs read/view operations
- **Action Format**: `READ_{ENTITY_TYPE}`

#### `logUpdate(entity_type, entity_id, oldData, newData, additionalDetails?)`
- Logs updates with before/after data
- **Action Format**: `UPDATE_{ENTITY_TYPE}`

#### `logDelete(entity_type, entity_id, oldData, additionalDetails?)`
- Logs deletions with original data
- **Action Format**: `DELETE_{ENTITY_TYPE}`

#### `logAssign(tour_id, driver_id, additionalDetails?)`
- Logs tour assignments
- **Action**: `ASSIGN_TOUR`

#### `logUnassign(tour_id, driver_id, additionalDetails?)`
- Logs tour unassignments  
- **Action**: `UNASSIGN_TOUR`

## 🎯 Entity Types

Use these standardized entity types:
- `'tour'` - Tours table operations
- `'driver'` - Drivers table operations
- `'assignment'` - Assignments table operations
- `'payment'` - Payments table operations
- `'user'` - Auth users operations
- `'profile'` - User profiles operations

## 🔍 Filtering & Search

The audit API supports comprehensive filtering:

```typescript
// Get all tour operations by a specific user
GET /api/audit?entity_type=tour&user_id=U123456

// Get all operations on a specific tour
GET /api/audit?entity_id=T789012

// Get all CREATE operations in the last week
GET /api/audit?action=CREATE&date_from=2024-11-12

// Get all assignment operations
GET /api/audit?entity_type=assignment
```

## 🚨 Error Handling

The audit logger is designed to never break your main operations:

```typescript
try {
  // Your main business logic
  await createTour(data);
  
  // Audit logging (won't throw)
  await auditLogger.logCreate('tour', tourId, data);
} catch (error) {
  // Main operation failed, but audit log attempt won't break this
  console.error('Operation failed:', error);
  throw error;
}
```

## 📈 Performance Considerations

- Audit logs are inserted asynchronously
- Failed audit logs don't break main operations
- Use pagination for large audit log queries
- Consider archiving old logs for performance

## 🔐 Security & Compliance

- All user actions are tracked with full attribution
- Sensitive data can be excluded from details field
- Timestamps are automatically managed
- Foreign key constraints maintain data integrity

## 🛠️ Maintenance

### Regular Cleanup
Consider implementing a cleanup job for old audit logs:

```sql
-- Archive logs older than 1 year
DELETE FROM activity_logs 
WHERE created_at < DATE_SUB(NOW(), INTERVAL 1 YEAR);
```

### Performance Monitoring
Monitor audit log table size and query performance regularly.

---

## ✅ Integration Checklist

For each API endpoint, ensure you:

1. ✅ Import `AuditLogger`
2. ✅ Initialize after user authentication
3. ✅ Get old data before updates/deletes
4. ✅ Call appropriate audit method
5. ✅ Include meaningful additional details
6. ✅ Handle errors gracefully
7. ✅ Test audit log creation

**Happy Auditing! 🎉**