-- Disposable CI harness only: emulates Supabase role/claim interfaces, NOT its HTTP service.
create role anon nologin;
create role authenticated nologin;
create schema auth;
create function auth.uid() returns uuid language sql stable as
  $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
grant usage on schema auth to anon, authenticated;
create table auth.users (id uuid primary key, raw_user_meta_data jsonb default '{}');
create schema storage;
create table storage.objects (id bigint generated always as identity primary key, bucket_id text not null, name text not null);
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated;
grant select, insert, update, delete on storage.objects to anon, authenticated;
grant usage on all sequences in schema storage to anon, authenticated;
-- Simulate dangerous old permissive policies: the new restrictive boundaries must still win.
create policy legacy_open_storage on storage.objects for all to anon, authenticated using (true) with check (true);
