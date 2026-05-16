
insert into storage.buckets (id, name, public) values ('prf-uploads', 'prf-uploads', false)
on conflict (id) do nothing;

create policy "Team can read prf-uploads"
on storage.objects for select to authenticated
using (
  bucket_id = 'prf-uploads'
  and (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager') or public.has_role(auth.uid(), 'staff'))
);

create policy "Team can upload prf-uploads"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'prf-uploads'
  and (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager') or public.has_role(auth.uid(), 'staff'))
);

create policy "Team can update prf-uploads"
on storage.objects for update to authenticated
using (
  bucket_id = 'prf-uploads'
  and (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager') or public.has_role(auth.uid(), 'staff'))
);

create policy "Team can delete prf-uploads"
on storage.objects for delete to authenticated
using (
  bucket_id = 'prf-uploads'
  and (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager') or public.has_role(auth.uid(), 'staff'))
);
