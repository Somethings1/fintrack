-- Apply through a reviewed database migration, before the matching browser release.
-- This does not modify Storage object data or migrate historical public avatars.
begin;
alter table public.profiles add column if not exists avatar_path text;
alter table public.profiles drop constraint if exists profiles_avatar_owner;
alter table public.profiles add constraint profiles_avatar_owner check (
  avatar_path is null or avatar_path = '' or
  (split_part(avatar_path, '/', 1) = id::text and
   avatar_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$')
);
alter table public.profiles enable row level security;
revoke all on public.profiles from anon;
grant select, insert, update on public.profiles to authenticated;
-- Restrictive policies intersect all permissive policies, including legacy ones.
drop policy if exists fintrack_profile_boundary on public.profiles;
create policy fintrack_profile_boundary on public.profiles as restrictive for all to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
drop policy if exists fintrack_profile_select on public.profiles;
create policy fintrack_profile_select on public.profiles for select to authenticated using ((select auth.uid()) = id);
drop policy if exists fintrack_profile_insert on public.profiles;
create policy fintrack_profile_insert on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
drop policy if exists fintrack_profile_update on public.profiles;
create policy fintrack_profile_update on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, left(coalesce(new.raw_user_meta_data->>'name', ''), 120))
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
commit;
