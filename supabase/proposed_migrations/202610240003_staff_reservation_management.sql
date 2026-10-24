-- PROPOSAL ONLY. Do not apply until reviewed against the live shared project.
-- Additive staff reservation management for the existing reservations table.
-- Preserves the public create_reservation_atomic signature. A capacity trigger
-- uses its existing advisory lock key, so public and staff writes serialize.

alter table public.staff_members
  add column if not exists can_override_reservation_rules boolean not null default false;

alter table public.reservations
  add column if not exists customer_phone text,
  add column if not exists booking_source text not null default 'website';

-- Staff phone bookings may have no email; the public booking route still
-- validates and supplies an email before calling the existing RPC.
alter table public.reservations alter column customer_email drop not null;

alter table public.reservations drop constraint if exists reservations_booking_source_check;
alter table public.reservations add constraint reservations_booking_source_check
  check (booking_source in ('website', 'phone', 'walk_in'));

-- Replace the existing status constraint regardless of its generated name.
do $$
declare
  v_constraint record;
begin
  for v_constraint in
    select conname from pg_constraint
    where conrelid = 'public.reservations'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.reservations drop constraint %I', v_constraint.conname);
  end loop;
end;
$$;
alter table public.reservations add constraint reservations_status_check
  check (status in ('pending', 'confirmed', 'arrived', 'completed', 'cancelled', 'no_show'));

create table if not exists public.staff_reservation_audit (
  id bigint generated always as identity primary key,
  reservation_id uuid not null,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (action in ('created', 'edited', 'status_changed')),
  exception_reason text,
  old_values jsonb,
  new_values jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.staff_reservation_audit enable row level security;
revoke all on table public.staff_reservation_audit from public, anon, authenticated;

create or replace function public.staff_reservation_access(p_override boolean default false)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.staff_members sm
    where sm.user_id = auth.uid()
      and (not p_override or sm.can_override_reservation_rules)
  );
$$;
revoke all on function public.staff_reservation_access(boolean) from public, anon, authenticated;

-- Keep the existing website per-booking limit for website-originated rows.
-- Staff manual bookings are instead bounded by the shared simultaneous cap.
create or replace function public.validate_reservation_guest_count()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  configured_max integer;
begin
  if new.booking_source = 'website' and current_setting('app.staff_rule_override', true) is distinct from 'true' then
    select max_online_guests into configured_max
    from public.booking_settings where id = 'default';
    if configured_max is null or new.guest_count > configured_max then
      raise exception using errcode = 'P0001', message = 'GUEST_LIMIT: guest count exceeds the online reservation limit';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.validate_reservation_guest_count() from public, anon, authenticated;
drop trigger if exists validate_reservation_guest_count on public.reservations;
create trigger validate_reservation_guest_count
  before insert or update on public.reservations
  for each row execute function public.validate_reservation_guest_count();

-- This trigger protects every insert/update path, including the existing
-- service-role public RPC. It serializes with the RPC's existing advisory key.
create or replace function public.enforce_reservation_simultaneous_capacity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_capacity integer;
  v_exceeded boolean;
begin
  perform pg_advisory_xact_lock(hashtextextended('altstadtliebe-reservation-booking', 0));

  if new.status not in ('pending', 'confirmed', 'arrived') then
    return new;
  end if;

  select least(total_reservable_capacity, 26)
  into v_capacity
  from public.booking_settings
  where id = 'default';
  if v_capacity is null or v_capacity < 1 then
    raise exception using errcode = 'P0001', message = 'CAPACITY_CONFIG: reservation capacity is unavailable';
  end if;

  with overlapping as (
    select r.starts_at, r.ends_at, r.guest_count
    from public.reservations r
    where r.id is distinct from new.id
      and r.status in ('pending', 'confirmed', 'arrived')
      and r.starts_at < new.ends_at
      and r.ends_at > new.starts_at
  ), boundaries as (
    select new.starts_at as instant
    union
    select o.starts_at from overlapping o
    where o.starts_at > new.starts_at and o.starts_at < new.ends_at
  ), loads as (
    select b.instant,
      new.guest_count + coalesce(sum(o.guest_count), 0) as guests
    from boundaries b
    left join overlapping o on o.starts_at <= b.instant and o.ends_at > b.instant
    group by b.instant
  )
  select exists (select 1 from loads where guests > v_capacity)
  into v_exceeded;

  if v_exceeded then
    raise exception using errcode = 'P0001', message = 'RESERVATION_FULL: simultaneous guest capacity exceeded';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_reservation_simultaneous_capacity() from public, anon, authenticated;

drop trigger if exists enforce_reservation_simultaneous_capacity on public.reservations;
create trigger enforce_reservation_simultaneous_capacity
  before insert or update
  on public.reservations
  for each row execute function public.enforce_reservation_simultaneous_capacity();

create or replace function public.staff_reservation_rule_violation(
  p_starts_at timestamptz,
  p_guest_count integer,
  p_booking_source text
)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_settings public.booking_settings%rowtype;
  v_hours public.opening_hours%rowtype;
  v_exception public.opening_exceptions%rowtype;
  v_local_start timestamp;
  v_local_end timestamp;
  v_start_minutes integer;
  v_first_minutes integer;
  v_last_minutes integer;
  v_open_minutes integer;
  v_close_minutes integer;
begin
  if p_starts_at is null or p_guest_count is null or p_guest_count < 1 then return 'INVALID_INPUT'; end if;
  if p_starts_at <= now() then return 'PAST'; end if;

  select * into v_settings from public.booking_settings where id = 'default';
  if not found then return 'CAPACITY_CONFIG'; end if;

  v_local_start := p_starts_at at time zone v_settings.time_zone;
  if extract(second from v_local_start) <> 0 then return 'INVALID_SLOT'; end if;
  v_local_end := (p_starts_at + make_interval(mins => v_settings.reservation_duration_minutes)) at time zone v_settings.time_zone;
  if v_local_start::date < (now() at time zone v_settings.time_zone)::date
    or v_local_start::date > ((now() at time zone v_settings.time_zone)::date + make_interval(months => v_settings.advance_booking_months))::date then
    return 'BOOKING_WINDOW';
  end if;

  if p_booking_source = 'website' and p_guest_count > v_settings.max_online_guests then
    return 'GUEST_LIMIT';
  end if;

  select * into v_hours from public.opening_hours
  where weekday = extract(isodow from v_local_start::date)::smallint;
  if not found then return 'CLOSED'; end if;
  select * into v_exception from public.opening_exceptions where exception_date = v_local_start::date;
  if found then
    if v_exception.is_closed then return 'CLOSED'; end if;
    v_open_minutes := extract(hour from v_exception.opens_at)::integer * 60 + extract(minute from v_exception.opens_at)::integer;
    v_close_minutes := extract(hour from v_exception.closes_at)::integer * 60 + extract(minute from v_exception.closes_at)::integer;
  else
    if v_hours.is_closed then return 'CLOSED'; end if;
    v_open_minutes := extract(hour from v_hours.opens_at)::integer * 60 + extract(minute from v_hours.opens_at)::integer;
    v_close_minutes := extract(hour from v_hours.closes_at)::integer * 60 + extract(minute from v_hours.closes_at)::integer;
  end if;

  v_start_minutes := extract(hour from v_local_start)::integer * 60 + extract(minute from v_local_start)::integer;
  v_first_minutes := extract(hour from v_settings.first_reservation_time)::integer * 60 + extract(minute from v_settings.first_reservation_time)::integer;
  v_last_minutes := extract(hour from v_settings.last_reservation_time)::integer * 60 + extract(minute from v_settings.last_reservation_time)::integer;
  if v_start_minutes < v_open_minutes
    or (extract(hour from v_local_end)::integer * 60 + extract(minute from v_local_end)::integer) > v_close_minutes then
    return 'OUTSIDE_HOURS';
  end if;
  if v_start_minutes < v_first_minutes or v_start_minutes > v_last_minutes
    or mod(v_start_minutes - v_first_minutes, v_settings.booking_interval_minutes) <> 0 then
    return 'INVALID_SLOT';
  end if;
  return null;
end;
$$;
revoke all on function public.staff_reservation_rule_violation(timestamptz, integer, text) from public, anon, authenticated;

create or replace function public.staff_reservation_capacity_available(
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_guest_count integer,
  p_exclude_reservation_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with settings as (
    select least(total_reservable_capacity, 26)::integer as capacity
    from public.booking_settings where id = 'default'
  ), overlapping as (
    select r.starts_at, r.ends_at, r.guest_count
    from public.reservations r
    where r.id is distinct from p_exclude_reservation_id
      and r.status in ('pending', 'confirmed', 'arrived')
      and r.starts_at < p_ends_at and r.ends_at > p_starts_at
  ), boundaries as (
    select p_starts_at as instant
    union
    select o.starts_at from overlapping o where o.starts_at > p_starts_at and o.starts_at < p_ends_at
  ), loads as (
    select b.instant, p_guest_count + coalesce(sum(o.guest_count), 0) as guests
    from boundaries b
    left join overlapping o on o.starts_at <= b.instant and o.ends_at > b.instant
    group by b.instant
  )
  select exists (select 1 from settings s where s.capacity > 0)
    and not exists (select 1 from settings s cross join loads l where l.guests > s.capacity);
$$;
revoke all on function public.staff_reservation_capacity_available(timestamptz, timestamptz, integer, uuid) from public, anon, authenticated;

create or replace function public.staff_check_reservation_availability(
  p_date date,
  p_time time,
  p_guest_count integer,
  p_booking_source text,
  p_exclude_reservation_id uuid default null
)
returns table(available boolean, reason text, can_override boolean, duration_minutes integer)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_settings public.booking_settings%rowtype;
  v_start timestamptz;
  v_end timestamptz;
  v_violation text;
begin
  if auth.uid() is null or not public.staff_reservation_access(false) then
    raise exception using errcode = '42501', message = 'NOT_STAFF';
  end if;
  if p_date is null or p_time is null or p_guest_count is null or p_guest_count < 1
    or coalesce(p_booking_source, '') not in ('website', 'phone', 'walk_in') then
    return query select false, 'INVALID_INPUT'::text, false, 90;
    return;
  end if;
  select * into v_settings from public.booking_settings where id = 'default';
  if not found then
    return query select false, 'CAPACITY_CONFIG'::text, false, 90;
    return;
  end if;
  v_start := (p_date + p_time) at time zone v_settings.time_zone;
  v_end := v_start + make_interval(mins => v_settings.reservation_duration_minutes);
  v_violation := public.staff_reservation_rule_violation(v_start, p_guest_count, p_booking_source);
  if v_violation is not null then
    return query select false, v_violation, (v_violation <> 'PAST' and public.staff_reservation_access(true)), v_settings.reservation_duration_minutes;
    return;
  end if;
  if not public.staff_reservation_capacity_available(v_start, v_end, p_guest_count, p_exclude_reservation_id) then
    return query select false, 'RESERVATION_FULL'::text, false, v_settings.reservation_duration_minutes;
    return;
  end if;
  return query select true, 'AVAILABLE'::text, false, v_settings.reservation_duration_minutes;
end;
$$;
revoke all on function public.staff_check_reservation_availability(date, time, integer, text, uuid) from public, anon;
grant execute on function public.staff_check_reservation_availability(date, time, integer, text, uuid) to authenticated;

create or replace function public.staff_manage_reservation(
  p_action text,
  p_reservation_id uuid default null,
  p_customer_name text default null,
  p_customer_email text default null,
  p_customer_phone text default null,
  p_guest_count integer default null,
  p_date date default null,
  p_time time default null,
  p_special_requests text default null,
  p_booking_source text default null,
  p_target_status text default null,
  p_exception_reason text default null,
  p_language text default 'de'
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_before public.reservations%rowtype;
  v_after public.reservations%rowtype;
  v_settings public.booking_settings%rowtype;
  v_source text;
  v_violation text;
  v_start timestamptz;
  v_end timestamptz;
  v_reason text := nullif(btrim(p_exception_reason), '');
begin
  if v_actor is null or not public.staff_reservation_access(false) then
    raise exception using errcode = '42501', message = 'NOT_STAFF';
  end if;

  -- Acquire the shared lock before each DML statement so READ COMMITTED takes
  -- a fresh snapshot after any concurrent booking transaction has committed.
  perform pg_advisory_xact_lock(hashtextextended('altstadtliebe-reservation-booking', 0));

  if p_action = 'create' then
    if btrim(coalesce(p_customer_name, '')) = '' or char_length(btrim(p_customer_name)) > 160
      or char_length(coalesce(p_customer_email, '')) > 320 or (nullif(btrim(p_customer_email), '') is not null and (position('@' in p_customer_email) = 0 or p_customer_email ~ '[[:space:]]')) or char_length(coalesce(p_customer_phone, '')) > 40
      or (nullif(btrim(p_customer_email), '') is null and nullif(btrim(p_customer_phone), '') is null)
      or p_guest_count is null or p_guest_count < 1
      or coalesce(p_special_requests, '') <> coalesce(btrim(p_special_requests), '')
      or char_length(coalesce(p_special_requests, '')) > 2000
      or coalesce(p_booking_source, '') not in ('phone', 'walk_in')
      or coalesce(p_language, '') not in ('de', 'en') then
      raise exception using errcode = 'P0001', message = 'INVALID_INPUT';
    end if;
    select * into v_settings from public.booking_settings where id = 'default';
    if not found then raise exception using errcode = 'P0001', message = 'CAPACITY_CONFIG'; end if;
    v_start := (p_date + p_time) at time zone v_settings.time_zone;
    v_end := v_start + make_interval(mins => v_settings.reservation_duration_minutes);
    v_violation := public.staff_reservation_rule_violation(v_start, p_guest_count, p_booking_source);
    if v_violation = 'PAST' or v_violation = 'INVALID_INPUT' then
      raise exception using errcode = 'P0001', message = v_violation;
    elsif v_violation is not null then
      if v_reason is null then raise exception using errcode = 'P0001', message = 'RULE_EXCEPTION_REQUIRED'; end if;
      if char_length(v_reason) < 10 or char_length(v_reason) > 1000 or not public.staff_reservation_access(true) then
        raise exception using errcode = '42501', message = 'RULE_EXCEPTION_FORBIDDEN';
      end if;
    elsif v_reason is not null and (char_length(v_reason) < 10 or char_length(v_reason) > 1000 or not public.staff_reservation_access(true)) then
      raise exception using errcode = '42501', message = 'RULE_EXCEPTION_FORBIDDEN';
    end if;
    if v_violation is not null then perform set_config('app.staff_rule_override', 'true', true); end if;
    insert into public.reservations(customer_name, customer_email, customer_phone, guest_count, starts_at, ends_at, special_requests, language, status, booking_source)
    values (btrim(p_customer_name), nullif(lower(btrim(p_customer_email)), ''), nullif(btrim(p_customer_phone), ''), p_guest_count, v_start, v_end, nullif(btrim(p_special_requests), ''), p_language, 'confirmed', p_booking_source)
    returning * into v_after;
    insert into public.staff_reservation_audit(reservation_id, actor_user_id, action, exception_reason, old_values, new_values)
    values (v_after.id, v_actor, 'created', v_reason, null, to_jsonb(v_after));
    return to_jsonb(v_after);
  elsif p_action = 'edit' then
    select * into v_before from public.reservations where id = p_reservation_id for update;
    if not found then raise exception using errcode = 'P0001', message = 'NOT_FOUND'; end if;
    if v_before.status in ('cancelled', 'completed', 'no_show') then raise exception using errcode = 'P0001', message = 'INVALID_TRANSITION'; end if;
    if p_guest_count is null or p_guest_count < 1 or p_date is null or p_time is null
      or char_length(coalesce(p_special_requests, '')) > 2000
      or coalesce(p_special_requests, '') <> coalesce(btrim(p_special_requests), '') then
      raise exception using errcode = 'P0001', message = 'INVALID_INPUT';
    end if;
    select * into v_settings from public.booking_settings where id = 'default';
    if not found then raise exception using errcode = 'P0001', message = 'CAPACITY_CONFIG'; end if;
    v_start := (p_date + p_time) at time zone v_settings.time_zone;
    v_end := v_start + make_interval(mins => v_settings.reservation_duration_minutes);
    v_violation := public.staff_reservation_rule_violation(v_start, p_guest_count, v_before.booking_source);
    if v_violation = 'PAST' or v_violation = 'INVALID_INPUT' then
      raise exception using errcode = 'P0001', message = v_violation;
    elsif v_violation is not null then
      if v_reason is null then raise exception using errcode = 'P0001', message = 'RULE_EXCEPTION_REQUIRED'; end if;
      if char_length(v_reason) < 10 or char_length(v_reason) > 1000 or not public.staff_reservation_access(true) then
        raise exception using errcode = '42501', message = 'RULE_EXCEPTION_FORBIDDEN';
      end if;
    elsif v_reason is not null and (char_length(v_reason) < 10 or char_length(v_reason) > 1000 or not public.staff_reservation_access(true)) then
      raise exception using errcode = '42501', message = 'RULE_EXCEPTION_FORBIDDEN';
    end if;
    if v_violation is not null then perform set_config('app.staff_rule_override', 'true', true); end if;
    update public.reservations set guest_count = p_guest_count, starts_at = v_start, ends_at = v_end, special_requests = nullif(btrim(p_special_requests), ''), updated_at = now()
      where id = p_reservation_id returning * into v_after;
    insert into public.staff_reservation_audit(reservation_id, actor_user_id, action, exception_reason, old_values, new_values)
    values (v_after.id, v_actor, 'edited', v_reason, to_jsonb(v_before), to_jsonb(v_after));
    return to_jsonb(v_after);
  elsif p_action = 'status' then
    select * into v_before from public.reservations where id = p_reservation_id for update;
    if not found then raise exception using errcode = 'P0001', message = 'NOT_FOUND'; end if;
    if not (
      (v_before.status = 'pending' and p_target_status in ('confirmed', 'arrived', 'cancelled', 'no_show'))
      or (v_before.status = 'confirmed' and p_target_status in ('arrived', 'completed', 'cancelled', 'no_show'))
      or (v_before.status = 'arrived' and p_target_status in ('completed', 'cancelled'))
    ) then raise exception using errcode = 'P0001', message = 'INVALID_TRANSITION'; end if;
    if p_target_status = 'no_show' and v_before.starts_at > now() then raise exception using errcode = 'P0001', message = 'NO_SHOW_TOO_EARLY'; end if;
    update public.reservations set status = p_target_status, updated_at = now() where id = p_reservation_id returning * into v_after;
    insert into public.staff_reservation_audit(reservation_id, actor_user_id, action, old_values, new_values)
    values (v_after.id, v_actor, 'status_changed', to_jsonb(v_before), to_jsonb(v_after));
    return to_jsonb(v_after);
  else
    raise exception using errcode = 'P0001', message = 'INVALID_INPUT';
  end if;
end;
$$;

revoke all on function public.staff_manage_reservation(text, uuid, text, text, text, integer, date, time, text, text, text, text, text) from public, anon;
grant execute on function public.staff_manage_reservation(text, uuid, text, text, text, integer, date, time, text, text, text, text, text) to authenticated;

-- Direct authenticated writes remain denied by table grants and RLS. All staff
-- mutations go through the authorization, audit, and capacity RPC/trigger.
-- After applying, grant an exception capability only to specifically approved
-- staff, for example: UPDATE public.staff_members SET can_override_reservation_rules = true WHERE user_id = '<approved-auth-user-uuid>';
-- Do not grant this capability to every staff member by default.
