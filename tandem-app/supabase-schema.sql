-- Tandem Database Schema
-- Run this in Supabase SQL Editor to set up the database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (managed by Supabase Auth, we just extend it)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'USER' CHECK (role IN ('USER', 'ADMIN')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login TIMESTAMP WITH TIME ZONE
);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users
CREATE POLICY "Users can view all profiles" ON public.users
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Resources table
CREATE TABLE IF NOT EXISTS public.resources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  labels TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

-- RLS Policies for resources
CREATE POLICY "Anyone can view resources" ON public.resources
  FOR SELECT USING (true);

CREATE POLICY "Only admins can insert resources" ON public.resources
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'ADMIN')
  );

CREATE POLICY "Only admins can update resources" ON public.resources
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'ADMIN')
  );

CREATE POLICY "Only admins can delete resources" ON public.resources
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'ADMIN')
  );

-- Bookings table
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resource_id UUID NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  branch TEXT NOT NULL,
  notes TEXT,
  build_link TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  released_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT one_active_booking_per_resource CHECK (released_at IS NULL OR released_at IS NOT NULL)
);

-- Indexes for bookings
CREATE INDEX idx_bookings_resource_id ON public.bookings(resource_id);
CREATE INDEX idx_bookings_user_id ON public.bookings(user_id);
CREATE INDEX idx_bookings_expires_at ON public.bookings(expires_at);
CREATE INDEX idx_bookings_released_at ON public.bookings(released_at);

-- Unique constraint: one active booking per resource
CREATE UNIQUE INDEX unique_active_booking_per_resource
  ON public.bookings(resource_id)
  WHERE released_at IS NULL;

-- Enable Row Level Security
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for bookings
CREATE POLICY "Anyone can view bookings" ON public.bookings
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create bookings" ON public.bookings
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own bookings or admins can update any" ON public.bookings
  FOR UPDATE USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'ADMIN')
  );

CREATE POLICY "Users can delete their own bookings or admins can delete any" ON public.bookings
  FOR DELETE USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'ADMIN')
  );

-- Booking History table
CREATE TABLE IF NOT EXISTS public.booking_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID,
  action TEXT NOT NULL CHECK (action IN ('BOOK', 'EXTEND', 'RELEASE', 'EXPIRED', 'EDIT')),
  resource_id UUID NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  branch TEXT NOT NULL,
  notes TEXT,
  build_link TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  released_at TIMESTAMP WITH TIME ZONE,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for booking_history
CREATE INDEX idx_booking_history_resource_id ON public.booking_history(resource_id);
CREATE INDEX idx_booking_history_user_id ON public.booking_history(user_id);
CREATE INDEX idx_booking_history_timestamp ON public.booking_history(timestamp);
CREATE INDEX idx_booking_history_action ON public.booking_history(action);

-- Enable Row Level Security
ALTER TABLE public.booking_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for booking_history
CREATE POLICY "Anyone can view booking history" ON public.booking_history
  FOR SELECT USING (true);

CREATE POLICY "System can insert into booking history" ON public.booking_history
  FOR INSERT WITH CHECK (true);

-- Function to auto-release expired bookings
CREATE OR REPLACE FUNCTION auto_release_expired_bookings()
RETURNS void AS $$
DECLARE
  expired_booking RECORD;
BEGIN
  -- Find all expired bookings that haven't been released
  FOR expired_booking IN
    SELECT * FROM public.bookings
    WHERE released_at IS NULL
    AND expires_at <= NOW()
  LOOP
    -- Update booking as released
    UPDATE public.bookings
    SET released_at = NOW()
    WHERE id = expired_booking.id;

    -- Log to history
    INSERT INTO public.booking_history (
      booking_id,
      action,
      resource_id,
      user_id,
      branch,
      notes,
      build_link,
      expires_at,
      released_at,
      timestamp
    ) VALUES (
      expired_booking.id,
      'EXPIRED',
      expired_booking.resource_id,
      expired_booking.user_id,
      expired_booking.branch,
      expired_booking.notes,
      expired_booking.build_link,
      expired_booking.expires_at,
      NOW(),
      NOW()
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle new user creation (trigger on auth.users)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, avatar_url, role, created_at, last_login)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url',
    'USER',
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create user profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update last_login
CREATE OR REPLACE FUNCTION public.update_last_login()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.users
  SET last_login = NOW()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update last_login on auth
DROP TRIGGER IF EXISTS on_auth_user_login ON auth.users;
CREATE TRIGGER on_auth_user_login
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (OLD.last_sign_in_at IS DISTINCT FROM NEW.last_sign_in_at)
  EXECUTE FUNCTION public.update_last_login();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.users TO anon, authenticated;
GRANT SELECT ON public.resources TO anon, authenticated;
GRANT SELECT ON public.bookings TO anon, authenticated;
GRANT SELECT ON public.booking_history TO anon, authenticated;
GRANT INSERT, UPDATE ON public.bookings TO authenticated;
GRANT INSERT ON public.booking_history TO authenticated;

-- Note: To set up the auto-release cron job, you can either:
-- 1. Use Supabase Edge Functions with a cron trigger
-- 2. Use pg_cron extension (if available in your Supabase plan):
--    SELECT cron.schedule('auto-release-bookings', '* * * * *', 'SELECT auto_release_expired_bookings()');
-- 3. Use an external cron service to call the function via API
