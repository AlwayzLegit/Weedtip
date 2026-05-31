-- ════════════════════════════════════════════════════════════════════════════
-- 20260531000010_storage_policies
-- RLS for Storage object uploads. Buckets (avatars, dispensary-media,
-- product-images) are declared public in config.toml (public READ via public URL),
-- but uploads through the API still need policies on storage.objects.
--
-- Model: any authenticated user may write objects under a TOP-LEVEL FOLDER named
-- after their own uid (e.g. "<uid>/cover-123.jpg"). Reads are public.
-- ════════════════════════════════════════════════════════════════════════════

create policy "weedtip media public read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id in ('avatars', 'dispensary-media', 'product-images'));

create policy "weedtip media upload to own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id in ('avatars', 'dispensary-media', 'product-images')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "weedtip media update own"
  on storage.objects for update
  to authenticated
  using (owner = auth.uid())
  with check (owner = auth.uid());

create policy "weedtip media delete own"
  on storage.objects for delete
  to authenticated
  using (owner = auth.uid());
