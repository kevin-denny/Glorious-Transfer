# Tourism Management System - Setup Guide

## Prerequisites
- Node.js 18+ installed
- Supabase account (free tier works)
- npm or yarn package manager

## Setup Instructions

### 1. Supabase Database Setup

1. Create a new project in [Supabase](https://supabase.com)
2. Go to SQL Editor in your Supabase dashboard
3. Copy and paste the entire contents of `DATABASE_SCHEMA.sql` into the SQL Editor
4. Run the SQL script to create all tables, functions, triggers, and RLS policies

### 2. Environment Configuration

1. Copy `.env.local.example` to `.env.local`:
   ```bash
   cp .env.local.example .env.local
   ```

2. Update `.env.local` with your Supabase credentials:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

   You can find these values in:
   - Supabase Dashboard → Settings → API

### 3. Install Dependencies

```bash
npm install
```

### 4. Create Initial Users

Since this is a role-based system, you need to create users in Supabase Auth first:

1. Go to Supabase Dashboard → Authentication → Users
2. Create users with different roles
3. After creating each user in Auth, insert their profile in the SQL Editor:

```sql
-- Create Administrator
INSERT INTO profiles (id, email, full_name, role)
VALUES (
  'user-auth-id-here',  -- Get this from Auth → Users
  'admin@example.com',
  'Admin User',
  'administrator'
);

-- Create Finance User
INSERT INTO profiles (id, email, full_name, role)
VALUES (
  'user-auth-id-here',
  'finance@example.com',
  'Finance Manager',
  'finance'
);

-- Create Operations User
INSERT INTO profiles (id, email, full_name, role)
VALUES (
  'user-auth-id-here',
  'operations@example.com',
  'Operations Manager',
  'operations'
);
```

### 5. Run the Development Server

```bash
npm run dev
```

Visit http://localhost:3000 and log in with one of your created users.

## User Roles & Permissions

### Administrator
- Full access to all features
- Manage drivers (CRUD operations)
- View all tours
- View all payments
- View activity logs
- View complaints

### Finance
- View dashboard
- Manage payments
- Mark payments as paid
- View pending payments

### Operations
- View dashboard
- Manage tours (CRUD operations)
- Assign drivers to tours
- View drivers (read-only)

## Features

### Driver Management (Administrator Only)
- Register new drivers with auto-generated driver numbers (DRV00001, DRV00002, etc.)
- Track languages spoken, vehicle type, and vehicle plate
- Monitor number of rides completed
- View driver complaints
- View assigned tours
- Active/Inactive status management

### Tour Management (Operations & Administrator)
- Create and manage tour bookings
- Enter booking details: date, reference, client info, agent, passengers
- Track arrival/departure dates and times
- Record flight information
- Assign drivers to tours
- Tour status tracking: pending, assigned, completed, cancelled

### Payment Management (Finance & Administrator)
- Track driver payments
- Link payments to specific tours
- Mark payments as pending or paid
- View payment history
- Add notes to payments
- Filter by status

### Activity Logging (Administrator Only)
- Comprehensive audit trail of all CRUD operations
- Track user actions across all tables
- View changes made to records
- Filter by action type, table, or user
- Timestamp for all activities

## Database Schema

The system uses 6 main tables:

1. **profiles** - User accounts with role assignment
2. **drivers** - Driver information and status
3. **tours** - Tour bookings and assignments
4. **driver_payments** - Payment tracking
5. **complaints** - Driver complaint management
6. **activity_logs** - System audit trail

All tables have Row Level Security (RLS) enabled with policies based on user roles.

## Build for Production

```bash
npm run build
npm run start
```

## Technologies Used

- **Framework**: Next.js 13 (App Router)
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **UI Components**: shadcn/ui
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Form Handling**: React Hook Form
- **Type Safety**: TypeScript

## Support

For issues or questions, please check:
1. Database schema is correctly applied
2. Environment variables are set correctly
3. User profiles are created in the database
4. RLS policies are enabled

## Security Notes

- All data access is controlled by Row Level Security
- Users can only perform actions allowed by their role
- All mutations are logged in activity_logs
- Password authentication is handled by Supabase Auth
- API keys should never be committed to version control
