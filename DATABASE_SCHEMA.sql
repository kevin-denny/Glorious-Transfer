-- Tourism Management System Database Schema
-- Execute this SQL in your Supabase SQL Editor

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('administrator', 'finance', 'operations')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Drivers table
CREATE TABLE IF NOT EXISTS drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_number text UNIQUE NOT NULL,
  name text NOT NULL,
  languages text[] DEFAULT '{}',
  vehicle_type text NOT NULL,
  vehicle_plate text NOT NULL,
  number_of_rides integer DEFAULT 0,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES profiles(id)
);

-- Tours table
CREATE TABLE IF NOT EXISTS tours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_date date NOT NULL,
  booking_ref text UNIQUE NOT NULL,
  client_name text NOT NULL,
  agent text NOT NULL,
  pax integer NOT NULL CHECK (pax > 0),
  contact_details text NOT NULL,
  arrival_datetime timestamptz NOT NULL,
  departure_datetime timestamptz NOT NULL,
  flight_no text,
  flight_time text,
  remarks text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'completed', 'cancelled')),
  assigned_driver_id uuid REFERENCES drivers(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES profiles(id),
  updated_at timestamptz DEFAULT now()
);

-- Driver payments table
CREATE TABLE IF NOT EXISTS driver_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  tour_id uuid REFERENCES tours(id) ON DELETE SET NULL,
  amount decimal(10, 2) NOT NULL CHECK (amount >= 0),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  payment_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES profiles(id)
);

-- Complaints table
CREATE TABLE IF NOT EXISTS complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  tour_id uuid REFERENCES tours(id) ON DELETE SET NULL,
  complaint_text text NOT NULL,
  status text DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved')),
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES profiles(id),
  resolved_at timestamptz
);

-- Activity logs table
CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id),
  action text NOT NULL CHECK (action IN ('create', 'read', 'update', 'delete')),
  table_name text NOT NULL,
  record_id uuid,
  changes jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_drivers_status ON drivers(status);
CREATE INDEX IF NOT EXISTS idx_tours_status ON tours(status);
CREATE INDEX IF NOT EXISTS idx_tours_assigned_driver ON tours(assigned_driver_id);
CREATE INDEX IF NOT EXISTS idx_payments_driver ON driver_payments(driver_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON driver_payments(status);
CREATE INDEX IF NOT EXISTS idx_complaints_driver ON complaints(driver_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id);

-- Function to generate driver number
CREATE OR REPLACE FUNCTION generate_driver_number()
RETURNS text AS $$
DECLARE
  next_number integer;
  driver_num text;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(driver_number FROM 4) AS integer)), 0) + 1
  INTO next_number
  FROM drivers
  WHERE driver_number ~ '^DRV[0-9]+$';

  driver_num := 'DRV' || LPAD(next_number::text, 5, '0');
  RETURN driver_num;
END;
$$ LANGUAGE plpgsql;

-- Function to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tours_updated_at
  BEFORE UPDATE ON tours
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON driver_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tours ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Drivers policies
CREATE POLICY "Authenticated users can view drivers" ON drivers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Administrators can create drivers" ON drivers FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'administrator'));
CREATE POLICY "Administrators can update drivers" ON drivers FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'administrator'));
CREATE POLICY "Administrators can delete drivers" ON drivers FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'administrator'));

-- Tours policies
CREATE POLICY "Authenticated users can view tours" ON tours FOR SELECT TO authenticated USING (true);
CREATE POLICY "Operations can create tours" ON tours FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('operations', 'administrator')));
CREATE POLICY "Operations can update tours" ON tours FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('operations', 'administrator')));
CREATE POLICY "Operations can delete tours" ON tours FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('operations', 'administrator')));

-- Payments policies
CREATE POLICY "Authenticated users can view payments" ON driver_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Finance can create payments" ON driver_payments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('finance', 'administrator')));
CREATE POLICY "Finance can update payments" ON driver_payments FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('finance', 'administrator')));

-- Complaints policies
CREATE POLICY "Authenticated users can view complaints" ON complaints FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create complaints" ON complaints FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Administrators can update complaints" ON complaints FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'administrator'));

-- Activity logs policies
CREATE POLICY "Administrators can view logs" ON activity_logs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'administrator'));
CREATE POLICY "Users can create logs" ON activity_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
