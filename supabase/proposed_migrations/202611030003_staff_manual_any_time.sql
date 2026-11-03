-- PROPOSAL ONLY. Review and apply to the shared Supabase project.
-- Manual staff reservations may be recorded at any time. Public website
-- reservations continue to use the existing booking window, opening-hours,
-- interval, and online guest-limit rules.

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
  if p_starts_at is null or p_guest_count is null or p_guest_count < 1 then
    return 'INVALID_INPUT';
  end if;

  -- Phone and walk-in rows are staff-entered records. Staff may record them
  -- before opening, after closing, outside the public booking window, or in a
  -- past time slot. Capacity protection remains enforced by the caller and
  -- the reservation trigger.
  if p_booking_source in ('phone', 'walk_in') then
    return null;
  end if;

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
