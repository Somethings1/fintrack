\set ON_ERROR_STOP on
insert into auth.users (id) values ('11111111-1111-4111-8111-111111111111'), ('22222222-2222-4222-8222-222222222222');
create policy legacy_open_profiles on public.profiles for all to authenticated using (true) with check (true);
insert into storage.objects (bucket_id,name) values
 ('avatar','11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp'),
 ('avatar','22222222-2222-4222-8222-222222222222/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.webp'),
 ('unrelated','retained-policy.txt');
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
do $$declare n int; begin
 if (select count(*) from public.profiles) <> 1 then raise exception 'cross-user profile read'; end if;
 update public.profiles set full_name='owner' where id=auth.uid();
 get diagnostics n = row_count;
 if n <> 1 then raise exception 'own update denied'; end if;
 update public.profiles set full_name='stolen' where id='22222222-2222-4222-8222-222222222222';
 get diagnostics n = row_count;
 if n <> 0 then raise exception 'cross-user update'; end if;
 begin
  update public.profiles set id='33333333-3333-4333-8333-333333333333' where id=auth.uid();
  raise exception 'ownership forgery accepted';
 exception when insufficient_privilege then null; end;
 begin
  update public.profiles set avatar_path='22222222-2222-4222-8222-222222222222/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.webp';
  raise exception 'foreign avatar reference accepted';
 exception when check_violation then null; end;
 if (select count(*) from storage.objects where bucket_id='avatar') <> 1 then raise exception 'cross-user object read'; end if;
 if (select count(*) from storage.objects where bucket_id='unrelated') <> 1 then raise exception 'unrelated policy changed'; end if;
 begin
  insert into storage.objects(bucket_id,name) values ('avatar','22222222-2222-4222-8222-222222222222/cccccccc-cccc-4ccc-8ccc-cccccccccccc.webp');
  raise exception 'foreign upload accepted';
 exception when insufficient_privilege then null; end;
 begin
  update storage.objects set name='22222222-2222-4222-8222-222222222222/cccccccc-cccc-4ccc-8ccc-cccccccccccc.webp' where bucket_id='avatar';
  raise exception 'object ownership change accepted';
 exception when insufficient_privilege then null; end;
 insert into storage.objects(bucket_id,name) values ('avatar','11111111-1111-4111-8111-111111111111/cccccccc-cccc-4ccc-8ccc-cccccccccccc.webp');
 delete from storage.objects where bucket_id='avatar';
 get diagnostics n = row_count;
 if n <> 2 then raise exception 'own delete or foreign isolation failed'; end if;
end$$;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
do $$begin
 if (select count(*) from public.profiles) <> 1 or (select full_name from public.profiles) = 'stolen' then raise exception 'second profile isolation'; end if;
 if (select count(*) from storage.objects where bucket_id='avatar') <> 1 then raise exception 'second user avatar was deleted'; end if;
end$$;
reset role;
set role anon;
select set_config('request.jwt.claim.sub','',false);
do $$begin
 begin perform * from public.profiles; raise exception 'anonymous profiles visible'; exception when insufficient_privilege then null; end;
 if (select count(*) from storage.objects where bucket_id='avatar') <> 0 then raise exception 'anonymous avatars visible'; end if;
end$$;
reset role;
select 'profile and avatar owner-isolation assertions passed' as result;
