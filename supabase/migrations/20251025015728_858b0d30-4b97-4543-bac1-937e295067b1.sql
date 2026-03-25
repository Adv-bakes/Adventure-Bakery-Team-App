-- Add key_qualities column to concepts table
ALTER TABLE public.concepts
ADD COLUMN IF NOT EXISTS key_qualities text;