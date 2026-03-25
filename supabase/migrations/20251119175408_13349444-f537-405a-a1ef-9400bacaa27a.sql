-- Create storage bucket for product spec sheets
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-spec-sheets', 'product-spec-sheets', false);

-- Add RLS policies for product spec sheets bucket
CREATE POLICY "Users can upload their own PSS files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'product-spec-sheets' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own PSS files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'product-spec-sheets' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own PSS files"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'product-spec-sheets' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own PSS files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'product-spec-sheets' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Add pss_file_path column to concepts table to store the uploaded file reference
ALTER TABLE concepts
ADD COLUMN pss_file_path TEXT,
ADD COLUMN pss_file_name TEXT,
ADD COLUMN pss_uploaded_at TIMESTAMP WITH TIME ZONE;