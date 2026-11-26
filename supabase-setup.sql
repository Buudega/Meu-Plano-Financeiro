-- Execute este arquivo uma vez no Supabase > SQL Editor.
create schema if not exists private;

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  invite_code text not null unique default upper(replace(gen_random_uuid()::text, '-', '')),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index if not exists household_members_user_id_idx on public.household_members(user_id);

create table if not exists public.app_data (
  household_id uuid primary key references public.households(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create or replace function private.is_household_member(p_household_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = p_household_id and m.user_id = (select auth.uid())
  );
$$;
revoke all on function private.is_household_member(uuid) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_household_member(uuid) to authenticated;

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.app_data enable row level security;
revoke all on public.households, public.household_members, public.app_data from anon, authenticated;
grant select on public.households, public.household_members to authenticated;
grant select, insert, update on public.app_data to authenticated;

create policy household_read_member on public.households for select to authenticated using ((select private.is_household_member(id)));
create policy members_read_household on public.household_members for select to authenticated using ((select private.is_household_member(household_id)));
create policy app_data_read_member on public.app_data for select to authenticated using ((select private.is_household_member(household_id)));
create policy app_data_insert_member on public.app_data for insert to authenticated with check ((select private.is_household_member(household_id)));
create policy app_data_update_member on public.app_data for update to authenticated using ((select private.is_household_member(household_id))) with check ((select private.is_household_member(household_id)));

create or replace function public.create_household()
returns table(household_id uuid, invite_code text)
language plpgsql security definer set search_path = '' as $$
declare new_id uuid; new_code text;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  new_code := upper(replace(gen_random_uuid()::text, '-', ''));
  insert into public.households(created_by, invite_code) values ((select auth.uid()), new_code) returning id into new_id;
  insert into public.household_members(household_id, user_id) values (new_id, (select auth.uid()));
  return query select new_id, new_code;
end;
$$;

create or replace function public.join_household(p_code text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare target_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  select h.id into target_id from public.households h where h.invite_code = upper(trim(p_code));
  if target_id is null then raise exception 'Invalid invite code'; end if;
  if exists (select 1 from public.household_members m where m.user_id = (select auth.uid())) then raise exception 'Account already belongs to a household'; end if;
  insert into public.household_members(household_id, user_id) values (target_id, (select auth.uid()));
  return target_id;
end;
$$;
revoke all on function public.create_household() from public, anon;
revoke all on function public.join_household(text) from public, anon;
grant execute on function public.create_household() to authenticated;
grant execute on function public.join_household(text) to authenticated;

-- Supabase Realtime: enable app_data in Database > Publications if needed.

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'app_data') then
    alter publication supabase_realtime add table public.app_data;
  end if;
end $$;
