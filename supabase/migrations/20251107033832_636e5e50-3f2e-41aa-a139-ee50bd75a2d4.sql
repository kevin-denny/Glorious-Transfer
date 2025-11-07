-- Create user roles enum
CREATE TYPE public.app_role AS ENUM ('administrator', 'finance', 'operations');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Create drivers table
CREATE TABLE public.drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_number TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  languages TEXT[] NOT NULL DEFAULT '{}',
  vehicle_type TEXT NOT NULL,
  vehicle_plate TEXT NOT NULL,
  number_of_rides INTEGER NOT NULL DEFAULT 0,
  complaints TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

-- Create tours table
CREATE TABLE public.tours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_date DATE NOT NULL,
  booking_ref TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  agent TEXT NOT NULL,
  pax INTEGER NOT NULL,
  contact_details TEXT NOT NULL,
  arrival_datetime TIMESTAMPTZ NOT NULL,
  departure_datetime TIMESTAMPTZ NOT NULL,
  flight_no TEXT,
  flight_time TIME,
  remarks TEXT,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.tours ENABLE ROW LEVEL SECURITY;

-- Create payments table
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES public.drivers(id) ON DELETE CASCADE NOT NULL,
  tour_id UUID REFERENCES public.tours(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Create activity_logs table
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name TEXT NOT NULL,
  user_role app_role NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Administrators can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'administrator'));

CREATE POLICY "Administrators can insert roles"
  ON public.user_roles FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'administrator'));

-- RLS Policies for drivers
CREATE POLICY "Authenticated users can view drivers"
  ON public.drivers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Administrators can insert drivers"
  ON public.drivers FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'administrator'));

CREATE POLICY "Administrators can update drivers"
  ON public.drivers FOR UPDATE
  USING (public.has_role(auth.uid(), 'administrator'));

CREATE POLICY "Administrators can delete drivers"
  ON public.drivers FOR DELETE
  USING (public.has_role(auth.uid(), 'administrator'));

-- RLS Policies for tours
CREATE POLICY "Authenticated users can view tours"
  ON public.tours FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Operations can insert tours"
  ON public.tours FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'operations'));

CREATE POLICY "Operations can update tours"
  ON public.tours FOR UPDATE
  USING (public.has_role(auth.uid(), 'operations'));

CREATE POLICY "Operations can delete tours"
  ON public.tours FOR DELETE
  USING (public.has_role(auth.uid(), 'operations'));

-- RLS Policies for payments
CREATE POLICY "Finance and administrators can view payments"
  ON public.payments FOR SELECT
  USING (
    public.has_role(auth.uid(), 'finance') OR 
    public.has_role(auth.uid(), 'administrator')
  );

CREATE POLICY "Finance can update payments"
  ON public.payments FOR UPDATE
  USING (public.has_role(auth.uid(), 'finance'));

-- RLS Policies for activity_logs
CREATE POLICY "Administrators can view all activity logs"
  ON public.activity_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'administrator'));

CREATE POLICY "Authenticated users can insert activity logs"
  ON public.activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Function to generate unique driver number
CREATE OR REPLACE FUNCTION public.generate_driver_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  new_number TEXT;
  exists_check BOOLEAN;
BEGIN
  LOOP
    new_number := 'DRV' || LPAD(FLOOR(RANDOM() * 99999 + 1)::TEXT, 5, '0');
    SELECT EXISTS(SELECT 1 FROM public.drivers WHERE driver_number = new_number) INTO exists_check;
    EXIT WHEN NOT exists_check;
  END LOOP;
  RETURN new_number;
END;
$$;

-- Trigger to auto-generate driver number
CREATE OR REPLACE FUNCTION public.set_driver_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.driver_number IS NULL OR NEW.driver_number = '' THEN
    NEW.driver_number := public.generate_driver_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_set_driver_number
  BEFORE INSERT ON public.drivers
  FOR EACH ROW
  EXECUTE FUNCTION public.set_driver_number();

-- Trigger to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_drivers_updated_at
  BEFORE UPDATE ON public.drivers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tours_updated_at
  BEFORE UPDATE ON public.tours
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'operations')
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'operations')
  );
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Trigger to auto-create payment when tour is assigned
CREATE OR REPLACE FUNCTION public.create_payment_on_tour_assign()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.driver_id IS NOT NULL AND (OLD.driver_id IS NULL OR OLD.driver_id != NEW.driver_id) THEN
    INSERT INTO public.payments (driver_id, tour_id, amount)
    VALUES (NEW.driver_id, NEW.id, 100.00);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_create_payment
  AFTER INSERT OR UPDATE ON public.tours
  FOR EACH ROW
  EXECUTE FUNCTION public.create_payment_on_tour_assign();