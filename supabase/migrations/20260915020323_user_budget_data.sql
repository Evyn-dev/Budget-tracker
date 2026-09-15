-- One versioned document per account. No anonymous budgets or demo rows.
create table public.user_budget_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object' and (data ->> 'schemaVersion') is not distinct from '1'),
  revision integer not null default 0 check (revision >= 0),
  last_write_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint budget_document_size check (octet_length(data::text) <= 5242880)
);

alter table public.user_budget_data enable row level security;
alter table public.user_budget_data force row level security;
revoke all on public.user_budget_data from public, anon, authenticated;
grant usage on schema public to authenticated;
grant select, insert, update on public.user_budget_data to authenticated;

create policy budget_select_own on public.user_budget_data for select to authenticated
  using ((select auth.uid()) = user_id);
create policy budget_insert_own on public.user_budget_data for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy budget_update_own on public.user_budget_data for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Stamp and increment revisions even if a client writes directly to the table.
create function public.budget_revision_stamp() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.revision := 1;
    new.created_at := now();
  else
    if new.user_id <> old.user_id then raise exception 'Budget owner cannot change'; end if;
    new.revision := old.revision + 1;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.budget_revision_stamp() from public, anon, authenticated;
create trigger budget_revision before insert or update on public.user_budget_data
  for each row execute function public.budget_revision_stamp();

-- Compare-and-swap: a stale writer receives zero rows instead of overwriting.
-- The write ID makes retries safe if the server saved but its response was lost.
-- SECURITY INVOKER preserves RLS, and there is deliberately no user_id argument.
create function public.save_budget(p_data jsonb, p_expected_revision integer, p_write_id uuid)
returns setof public.user_budget_data
language plpgsql security invoker set search_path = '' as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_write_id is null or p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'Invalid save request' using errcode = '22023';
  end if;
  -- Per-account transaction lock also serializes concurrent retries of the same ID.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(caller::text, 0));
  return query select * from public.user_budget_data
    where user_id = caller and last_write_id = p_write_id;
  if found then return; end if;
  if p_expected_revision = 0 then
    return query insert into public.user_budget_data (user_id, data, last_write_id)
      values (caller, p_data, p_write_id) on conflict (user_id) do nothing returning *;
  else
    return query update public.user_budget_data set data = p_data, last_write_id = p_write_id
      where user_id = caller and revision = p_expected_revision returning *;
  end if;
end;
$$;
revoke all on function public.save_budget(jsonb, integer, uuid) from public, anon;
grant execute on function public.save_budget(jsonb, integer, uuid) to authenticated;
