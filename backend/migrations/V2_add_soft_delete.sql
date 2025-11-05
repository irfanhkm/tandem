-- ========================================
-- Migration: V2 - Add Soft Delete Support
-- ========================================
-- Description: Adds soft delete functionality to prevent permanent data loss
-- Author: Tandem Team
-- Date: 2024-11-05
-- Dependencies: V1_initial_schema.sql
--
-- This migration adds:
-- - deleted_at column to resources table
-- - deleted_at column to bookings table
-- - Indexes on deleted_at columns for performance
-- - 'DELETE' action to booking_history constraint
--
-- Impact: Changes delete behavior from hard delete to soft delete.
--         Queries must filter WHERE deleted_at IS NULL to exclude deleted records.
-- ========================================

-- Run this in Supabase SQL Editor if your database already exists

-- Add deleted_at column to resources table
ALTER TABLE public.resources
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Add index for soft delete queries on resources
CREATE INDEX IF NOT EXISTS idx_resources_deleted_at ON public.resources(deleted_at);

-- Add deleted_at column to bookings table
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Add index for soft delete queries on bookings
CREATE INDEX IF NOT EXISTS idx_bookings_deleted_at ON public.bookings(deleted_at);

-- Update booking_history action constraint to include DELETE
ALTER TABLE public.booking_history
DROP CONSTRAINT IF EXISTS booking_history_action_check;

ALTER TABLE public.booking_history
ADD CONSTRAINT booking_history_action_check
CHECK (action IN ('BOOK', 'EXTEND', 'RELEASE', 'EXPIRED', 'EDIT', 'DELETE'));

-- Verify the changes
SELECT 'Resources columns' AS verification,
  column_name, data_type
FROM information_schema.columns
WHERE table_name = 'resources'
  AND table_schema = 'public'
  AND column_name IN ('deleted_at')
UNION ALL
SELECT 'Bookings columns' AS verification,
  column_name, data_type
FROM information_schema.columns
WHERE table_name = 'bookings'
  AND table_schema = 'public'
  AND column_name IN ('deleted_at');
