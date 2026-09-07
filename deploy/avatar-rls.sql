-- First make bucket "avatar" private using scripts/configure-avatar.mjs.
-- Never UPDATE/DELETE Storage object metadata directly in a live project.
begin;
drop policy if exists fintrack_avatar_boundary on storage.objects;
create policy fintrack_avatar_boundary on storage.objects as restrictive for all to authenticated
using (
  bucket_id <> 'avatar' or
  (split_part(name, '/', 1) = (select auth.uid())::text and
   name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$')
)
with check (
  bucket_id <> 'avatar' or
  (split_part(name, '/', 1) = (select auth.uid())::text and
   name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$')
);
drop policy if exists fintrack_avatar_anonymous_boundary on storage.objects;
create policy fintrack_avatar_anonymous_boundary on storage.objects as restrictive for all to anon
  using (bucket_id <> 'avatar') with check (bucket_id <> 'avatar');
drop policy if exists fintrack_avatar_owner on storage.objects;
create policy fintrack_avatar_owner on storage.objects for all to authenticated
using (bucket_id = 'avatar' and split_part(name, '/', 1) = (select auth.uid())::text)
with check (bucket_id = 'avatar' and split_part(name, '/', 1) = (select auth.uid())::text);
commit;
