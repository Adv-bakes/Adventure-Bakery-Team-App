
-- Allow staff/admin to upload files to product-spec-sheets bucket on behalf of clients
CREATE POLICY "Staff can upload to product-spec-sheets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'product-spec-sheets'
    AND is_staff_or_admin(auth.uid())
  );

-- Allow staff/admin to read files from product-spec-sheets bucket
CREATE POLICY "Staff can read product-spec-sheets"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'product-spec-sheets'
    AND is_staff_or_admin(auth.uid())
  );

-- Allow staff/admin to update files in product-spec-sheets bucket
CREATE POLICY "Staff can update product-spec-sheets"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'product-spec-sheets'
    AND is_staff_or_admin(auth.uid())
  );

-- Allow staff/admin to delete files from product-spec-sheets bucket
CREATE POLICY "Staff can delete product-spec-sheets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'product-spec-sheets'
    AND is_staff_or_admin(auth.uid())
  );
