
insert into storage.buckets (id, name, public)
values ('product-spec-sheets', 'product-spec-sheets', false)
on conflict (id) do nothing;

-- Staff/admin full access
create policy "Staff can read PSS files"
  on storage.objects for select
  using (bucket_id = 'product-spec-sheets' and public.is_staff_or_admin(auth.uid()));

create policy "Staff can upload PSS files"
  on storage.objects for insert
  with check (bucket_id = 'product-spec-sheets' and public.is_staff_or_admin(auth.uid()));

create policy "Staff can update PSS files"
  on storage.objects for update
  using (bucket_id = 'product-spec-sheets' and public.is_staff_or_admin(auth.uid()));

create policy "Staff can delete PSS files"
  on storage.objects for delete
  using (bucket_id = 'product-spec-sheets' and public.is_staff_or_admin(auth.uid()));

-- Client own-folder access (first path segment = their auth.uid())
create policy "Clients can read own PSS files"
  on storage.objects for select
  using (
    bucket_id = 'product-spec-sheets'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Clients can upload own PSS files"
  on storage.objects for insert
  with check (
    bucket_id = 'product-spec-sheets'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Clients can delete own PSS files"
  on storage.objects for delete
  using (
    bucket_id = 'product-spec-sheets'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
