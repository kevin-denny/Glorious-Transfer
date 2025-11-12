# Tourism Management System

A comprehensive, role-based tourism management platform built with Next.js and Supabase. This system enables tour operators to manage drivers, bookings, payments, and track all system activities with detailed audit logs.

## Features Overview

### Three User Roles

1. **Administrator**
   - Complete system access
   - Register and manage drivers
   - View all tours and assignments
   - Monitor all payments
   - Access comprehensive activity logs
   - Handle driver complaints

2. **Operations**
   - Create and manage tour bookings
   - Assign drivers to tours
   - Track tour status and details
   - View driver information
   - Monitor tour schedules

3. **Finance**
   - Track driver payments
   - Mark payments as pending or paid
   - View payment history by driver
   - Link payments to specific tours
   - Generate payment reports

### Core Functionality

#### Driver Management
- System-generated unique driver numbers (DRV00001, DRV00002...)
- Track multiple languages per driver
- Vehicle type and registration management
- Automatic ride counting
- Active/Inactive status tracking
- View assigned tours per driver
- Complaint tracking system

#### Tour Management
- Comprehensive booking system with reference numbers
- Client and agent information
- Passenger count tracking
- Arrival and departure date/time
- Flight information
- Tour status tracking (pending → assigned → completed/cancelled)
- Driver assignment functionality
- Custom remarks and notes

#### Payment Tracking
- Create payment records for drivers
- Link payments to specific tours
- Pending/Paid status management
- Payment date tracking
- Notes and additional information
- Financial overview dashboard

#### Activity Logging
- Complete audit trail of all CRUD operations
- Track user actions by role
- View detailed change logs
- Filter by action type, table, or user
- Timestamp tracking for compliance

## Technology Stack

- **Framework**: Next.js 13 with App Router
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth with RLS
- **UI Components**: shadcn/ui
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Language**: TypeScript
- **State Management**: React Hooks

## Quick Start

### 1. Prerequisites
- Node.js 18 or higher
- Supabase account
- npm or yarn

### 2. Database Setup
1. Create a Supabase project at https://supabase.com
2. Open SQL Editor in your dashboard
3. Run the `DATABASE_SCHEMA.sql` file
4. This creates all tables, functions, triggers, and security policies

### 3. Environment Configuration
```bash
# Copy environment file
cp .env.local.example .env.local

# Add your Supabase credentials
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Install Dependencies
```bash
npm install
```

### 5. Create Users
In Supabase Dashboard:
1. Go to Authentication → Users
2. Add users via email/password
3. Insert profiles using SQL:

```sql
INSERT INTO profiles (id, email, full_name, role)
VALUES ('user-id-from-auth', 'admin@example.com', 'Admin Name', 'administrator');
```

### 6. Run Development Server
```bash
npm run dev
```

Visit http://localhost:3000

## Database Schema

### Tables

1. **profiles** - User accounts with role assignment
   - Links to Supabase Auth
   - Stores role: administrator, finance, operations

2. **drivers** - Driver information
   - Auto-generated driver numbers
   - Languages array
   - Vehicle details
   - Ride counter
   - Status tracking

3. **tours** - Tour bookings
   - Booking references
   - Client information
   - Flight details
   - Driver assignments
   - Status workflow

4. **driver_payments** - Payment tracking
   - Links to drivers and tours
   - Amount and status
   - Payment dates
   - Notes

5. **complaints** - Complaint management
   - Links to drivers
   - Optional tour reference
   - Status tracking
   - Resolution dates

6. **activity_logs** - System audit trail
   - User actions
   - Table and record tracking
   - Change details (JSON)
   - Timestamps

### Security

All tables use Row Level Security (RLS) with role-based policies:
- Administrators: Full access
- Finance: Payment management
- Operations: Tour and driver viewing, tour management
- Activity logging for all operations
- Authenticated user validation

## Project Structure

```
/app
  /dashboard
    /drivers       # Driver management page
    /tours         # Tour management page
    /payments      # Payment tracking page
    /logs          # Activity logs page
    page.tsx       # Dashboard home
  /login           # Login page
  layout.tsx       # Root layout with auth
  page.tsx         # Landing page

/components
  /ui              # shadcn/ui components
  dashboard-layout.tsx  # Main layout with navigation

/lib
  supabase.ts      # Supabase client
  auth-context.tsx # Authentication context
  activity-logger.ts  # Activity logging utility
  utils.ts         # Utility functions

DATABASE_SCHEMA.sql  # Complete database schema
SETUP.md            # Detailed setup guide
```

## Key Features Detail

### Driver Number Generation
Automatic sequential numbering using PostgreSQL function:
- Format: DRV00001, DRV00002, etc.
- Ensures uniqueness
- Handles concurrent insertions

### Tour Assignment Workflow
1. Operations creates tour (status: pending)
2. Operations assigns available driver
3. Status updates to assigned
4. Driver's ride count increments
5. Tour can be marked completed or cancelled

### Payment Processing
1. Finance creates payment record (status: pending)
2. Links to driver and optionally to tour
3. Adds amount and notes
4. Marks as paid when processed
5. Records payment date

### Activity Monitoring
Every CRUD operation automatically logged:
- User ID and profile
- Action type (create/read/update/delete)
- Table name
- Record ID
- Change details (before/after)
- Timestamp

## API Routes

This application uses Supabase client-side SDK exclusively. No custom API routes are needed as:
- Authentication is handled by Supabase Auth
- Data operations use Supabase client with RLS
- Real-time subscriptions available via Supabase

## Deployment

### Build for Production
```bash
npm run build
```

### Deploy to Vercel
1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

### Other Platforms
The app can be deployed to any platform supporting Next.js:
- Netlify
- AWS Amplify
- Railway
- Self-hosted with Node.js

## Security Considerations

- Row Level Security enabled on all tables
- Role-based access control
- Password hashing by Supabase Auth
- API keys should be kept secret
- Activity logging for audit compliance
- HTTPS enforced in production

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Performance

- Static page generation where possible
- Optimized bundle size (~147KB first load)
- Lazy loading of components
- Database indexes on frequently queried columns

## Maintenance

### Updating Dependencies
```bash
npm update
```

### Database Migrations
Create new migration files in Supabase SQL Editor following the format in `DATABASE_SCHEMA.sql`.

### Backup
Regular backups are handled by Supabase. Download backups from:
Dashboard → Database → Backups

## Troubleshooting

### Build Errors
- Ensure all environment variables are set
- Check Node.js version (18+)
- Clear .next folder and rebuild

### Database Errors
- Verify RLS policies are applied
- Check user profiles exist
- Ensure foreign key relationships

### Authentication Issues
- Confirm Supabase credentials
- Check user exists in both Auth and profiles
- Verify role assignment

## License

MIT License - Feel free to use this project for your tourism business.

## Contributing

This is a production-ready template. Feel free to:
- Fork and customize
- Add new features
- Improve UI/UX
- Submit pull requests

## Support

For detailed setup instructions, see `SETUP.md`.

---

Built with Next.js and Supabase for modern tourism operations.

## GENERATE JWT KEY
openssl rand -base64 32

## PASSWORD ENCRYPTION COMAND
node -e "console.log(require('bcryptjs').hashSync('admin123', 10))"

## USER INSERT QUERIES
-- Password: admin123 (bcrypt hash with cost 10)
SET @user_id = UUID();
SET @email = 'admin@glorioustransfer.com';
SET @password_hash = '$2a$10$Z/gjGOYlzPQZQlnM9L..ceSCT233vpNsfPMZUgdInTY.5yGRo.DBG'; -- You need to generate this
SET @full_name = 'System Administrator';
SET @role = 'administrator';

INSERT INTO auth_users (id, email, encrypted_password, created_at, updated_at)
VALUES (@user_id, @email, @password_hash, NOW(), NOW());

INSERT INTO profiles (id, full_name, role, created_at, updated_at)
VALUES (@user_id, @full_name, @role, NOW(), NOW());