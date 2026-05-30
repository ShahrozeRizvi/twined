
-- ============ TABLES ============

create table public.spaces (
  id uuid primary key default gen_random_uuid(),
  invite_code text not null unique,
  created_by uuid not null,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  space_id uuid references public.spaces(id) on delete set null,
  name text not null default '',
  photo_url text,
  timezone text not null default 'UTC',
  avatar_preset smallint not null default 1 check (avatar_preset between 1 and 6),
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null check (char_length(text) between 1 and 280),
  completed boolean not null default false,
  position integer not null default 0,
  task_date date not null default current_date,
  created_at timestamptz not null default now()
);
create index tasks_space_date_idx on public.tasks(space_id, task_date);

create table public.moments (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('text','photo','voice','video')),
  content text,
  media_url text,
  created_at timestamptz not null default now()
);
create index moments_space_created_idx on public.moments(space_id, created_at desc);

create table public.trail_sessions (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  active boolean not null default true
);
create index trail_sessions_space_active_idx on public.trail_sessions(space_id, active);

create table public.trail_points (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.trail_sessions(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  created_at timestamptz not null default now()
);
create index trail_points_session_idx on public.trail_points(session_id, created_at);

create table public.thinking_pings (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  from_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index thinking_pings_space_created_idx on public.thinking_pings(space_id, created_at desc);

-- ============ GRANTS ============
grant select, insert, update, delete on public.spaces to authenticated;
grant all on public.spaces to service_role;
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
grant select, insert, update, delete on public.tasks to authenticated;
grant all on public.tasks to service_role;
grant select, insert, update, delete on public.moments to authenticated;
grant all on public.moments to service_role;
grant select, insert, update, delete on public.trail_sessions to authenticated;
grant all on public.trail_sessions to service_role;
grant select, insert, update, delete on public.trail_points to authenticated;
grant all on public.trail_points to service_role;
grant select, insert, update, delete on public.thinking_pings to authenticated;
grant all on public.thinking_pings to service_role;

-- ============ HELPER FUNCTIONS (SECURITY DEFINER, no recursion) ============

create or replace function public.my_space_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select space_id from public.profiles where id = auth.uid()
$$;

create or replace function public.space_member_count(_space_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from public.profiles where space_id = _space_id
$$;

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ RLS ============

alter table public.spaces enable row level security;
alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.moments enable row level security;
alter table public.trail_sessions enable row level security;
alter table public.trail_points enable row level security;
alter table public.thinking_pings enable row level security;

-- profiles: see self + partner in same space; update self; insert handled by trigger
create policy "profiles_select_self_or_partner" on public.profiles
  for select to authenticated
  using (id = auth.uid() or (space_id is not null and space_id = public.my_space_id()));

create policy "profiles_insert_self" on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

create policy "profiles_update_self" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and (
      space_id is null
      or space_id = public.my_space_id()
      or public.space_member_count(space_id) < 2
    )
  );

-- spaces: see if you belong; insert allowed (creator); lookup by invite code for join is via security-definer fn
create policy "spaces_select_member" on public.spaces
  for select to authenticated
  using (id = public.my_space_id());

create policy "spaces_insert_self" on public.spaces
  for insert to authenticated
  with check (created_by = auth.uid());

-- tasks
create policy "tasks_select_same_space" on public.tasks
  for select to authenticated using (space_id = public.my_space_id());
create policy "tasks_insert_own" on public.tasks
  for insert to authenticated
  with check (user_id = auth.uid() and space_id = public.my_space_id());
create policy "tasks_update_own" on public.tasks
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "tasks_delete_own" on public.tasks
  for delete to authenticated using (user_id = auth.uid());

-- moments
create policy "moments_select_same_space" on public.moments
  for select to authenticated using (space_id = public.my_space_id());
create policy "moments_insert_own" on public.moments
  for insert to authenticated
  with check (user_id = auth.uid() and space_id = public.my_space_id());
create policy "moments_delete_own" on public.moments
  for delete to authenticated using (user_id = auth.uid());

-- trail_sessions
create policy "trail_sessions_select_same_space" on public.trail_sessions
  for select to authenticated using (space_id = public.my_space_id());
create policy "trail_sessions_insert_own" on public.trail_sessions
  for insert to authenticated
  with check (user_id = auth.uid() and space_id = public.my_space_id());
create policy "trail_sessions_update_own" on public.trail_sessions
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- trail_points
create policy "trail_points_select_same_space" on public.trail_points
  for select to authenticated using (space_id = public.my_space_id());
create policy "trail_points_insert_own" on public.trail_points
  for insert to authenticated
  with check (user_id = auth.uid() and space_id = public.my_space_id());

-- thinking_pings
create policy "pings_select_same_space" on public.thinking_pings
  for select to authenticated using (space_id = public.my_space_id());
create policy "pings_insert_own" on public.thinking_pings
  for insert to authenticated
  with check (from_user_id = auth.uid() and space_id = public.my_space_id());

-- ============ JOIN BY INVITE CODE (security definer) ============
create or replace function public.join_space_by_code(_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _space_id uuid;
  _count int;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select id into _space_id from public.spaces where invite_code = upper(_code);
  if _space_id is null then
    raise exception 'invalid invite code';
  end if;

  select count(*) into _count from public.profiles where space_id = _space_id;
  if _count >= 2 then
    -- allow if I'm already a member
    if not exists (select 1 from public.profiles where id = auth.uid() and space_id = _space_id) then
      raise exception 'this space is full';
    end if;
  end if;

  update public.profiles set space_id = _space_id where id = auth.uid();
  return _space_id;
end;
$$;

grant execute on function public.join_space_by_code(text) to authenticated;
grant execute on function public.my_space_id() to authenticated;
grant execute on function public.space_member_count(uuid) to authenticated;

-- ============ REALTIME ============
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.moments;
alter publication supabase_realtime add table public.trail_sessions;
alter publication supabase_realtime add table public.trail_points;
alter publication supabase_realtime add table public.thinking_pings;
alter publication supabase_realtime add table public.profiles;

-- ============ STORAGE BUCKETS ============
insert into storage.buckets (id, name, public) values
  ('profile-photos', 'profile-photos', true),
  ('moments-media', 'moments-media', true)
on conflict (id) do nothing;

create policy "profile_photos_public_read" on storage.objects
  for select to public using (bucket_id = 'profile-photos');
create policy "profile_photos_user_write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "profile_photos_user_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "profile_photos_user_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "moments_media_public_read" on storage.objects
  for select to public using (bucket_id = 'moments-media');
create policy "moments_media_user_write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'moments-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "moments_media_user_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'moments-media' and (storage.foldername(name))[1] = auth.uid()::text);
