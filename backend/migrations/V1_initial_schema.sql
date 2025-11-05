-- ========================================
-- Migration: V1 - Initial Schema
-- ========================================
-- Description: Initial database schema for Tandem resource booking system
-- Author: Tandem Team
-- Date: 2024-11-05
-- Dependencies: None
--
-- This migration creates:
-- - resources table: Manages QA environments/resources
-- - bookings table: Tracks resource bookings with time-based reservations
-- - booking_history table: Audit trail for all booking actions
-- - RLS policies: Row-level security (currently open to all)
-- - Functions: auto_release_expired_bookings()
-- ========================================

-- Run this in Supabase SQL Editor to set up the database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Resources table
CREATE TABLE IF NOT EXISTS public.resources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  labels TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (but allow all operations)
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

-- RLS Policies for resources - anyone can do anything
CREATE POLICY "Anyone can view resources" ON public.resources
  FOR SELECT USING (true);

CREATE POLICY "Anyone can insert resources" ON public.resources
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update resources" ON public.resources
  FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete resources" ON public.resources
  FOR DELETE USING (true);

-- Bookings table (no user_id, just booked_by name)
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resource_id UUID NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  booked_by TEXT NOT NULL,
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
CREATE INDEX idx_bookings_booked_by ON public.bookings(booked_by);
CREATE INDEX idx_bookings_expires_at ON public.bookings(expires_at);
CREATE INDEX idx_bookings_released_at ON public.bookings(released_at);

-- Unique constraint: one active booking per resource
CREATE UNIQUE INDEX unique_active_booking_per_resource
  ON public.bookings(resource_id)
  WHERE released_at IS NULL;

-- Enable Row Level Security
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for bookings - anyone can do anything
CREATE POLICY "Anyone can view bookings" ON public.bookings
  FOR SELECT USING (true);

CREATE POLICY "Anyone can create bookings" ON public.bookings
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update bookings" ON public.bookings
  FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete bookings" ON public.bookings
  FOR DELETE USING (true);

-- Booking History table
CREATE TABLE IF NOT EXISTS public.booking_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID,
  action TEXT NOT NULL CHECK (action IN ('BOOK', 'EXTEND', 'RELEASE', 'EXPIRED', 'EDIT')),
  resource_id UUID NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  booked_by TEXT NOT NULL,
  branch TEXT NOT NULL,
  notes TEXT,
  build_link TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  released_at TIMESTAMP WITH TIME ZONE,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for booking_history
CREATE INDEX idx_booking_history_resource_id ON public.booking_history(resource_id);
CREATE INDEX idx_booking_history_booked_by ON public.booking_history(booked_by);
CREATE INDEX idx_booking_history_timestamp ON public.booking_history(timestamp);
CREATE INDEX idx_booking_history_action ON public.booking_history(action);

-- Enable Row Level Security
ALTER TABLE public.booking_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for booking_history
CREATE POLICY "Anyone can view booking history" ON public.booking_history
  FOR SELECT USING (true);

CREATE POLICY "Anyone can insert into booking history" ON public.booking_history
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
      booked_by,
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
      expired_booking.booked_by,
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

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.resources TO anon, authenticated;
GRANT ALL ON public.bookings TO anon, authenticated;
GRANT ALL ON public.booking_history TO anon, authenticated;

-- Note: To set up the auto-release cron job, you can either:
-- 1. Use Supabase Edge Functions with a cron trigger
-- 2. Use pg_cron extension (if available in your Supabase plan):
--    SELECT cron.schedule('auto-release-bookings', '* * * * *', 'SELECT auto_release_expired_bookings()');
-- 3. Use an external cron service to call the function via API
