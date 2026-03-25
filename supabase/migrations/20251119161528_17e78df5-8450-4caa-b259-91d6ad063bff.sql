-- Add target_market column to profiles table
ALTER TABLE public.profiles
ADD COLUMN target_market TEXT;