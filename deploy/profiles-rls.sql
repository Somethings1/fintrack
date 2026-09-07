-- Review and apply in a staging Supabase project before production.
-- This hardens the EXISTING public.profiles table; it does not replace customer data.
begin;
alter table public.profiles enable row level security;
revoke all on public.profiles from anon;
grant select, insert, update on public.profiles to authenticated;
-- Restrictive policy combines with any existing permissive policy and prevents
-- a forgotten broad permissive policy from granting cross-owner access.
drop policy if exists profiles_owner_boundary on public.profiles;
create policy profiles_owner_boundary on public.profiles as restrictive for all to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
drop policy if exists profiles_owner_select on public.profiles;
create policy profiles_owner_select on public.profiles for select to authenticated
  using ((select auth.uid()) = id);
drop policy if exists profiles_owner_insert on public.profiles;
create policy profiles_owner_insert on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);
drop policy if exists profiles_owner_update on public.profiles;
create policy profiles_owner_update on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
commit;
-- Also review all existing policies, SECURITY DEFINER functions and storage bucket
-- policies. This migration does not claim to secure unrelated tables or storage.
