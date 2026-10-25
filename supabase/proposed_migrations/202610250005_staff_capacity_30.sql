-- PROPOSAL ONLY. Apply only after reviewing against the live shared project.
-- Staff capacity extension: normal online capacity remains unchanged; authorized staff
-- may override it up to an absolute 30 guest overlapping peak.
-- All checks use the existing reservation advisory lock and 90-minute windows.

create or replace function public.staff_reservation_peak_guests(
  p_starts_at timestamptz, p_ends_at timestamptz, p_guest_count integer,
  p_exclude_reservation_id uuid default null
) returns integer
language sql stable security definer
set search_path = pg_catalog, public
as $$
  with overlapping as (
    select r.starts_at, r.ends_at, r.guest_count
    from public.reservations r
    where r.id is distinct from p_exclude_reservation_id
      and r.status in ('pending','confirmed','arrived','completed')
      and r.starts_at < p_ends_at and r.ends_at > p_starts_at
  ), boundaries as (
    select p_starts_at as instant
    union
    select o.starts_at from overlapping o where o.starts_at > p_starts_at and o.starts_at < p_ends_at
  ), loads as (
    select b.instant, p_guest_count + coalesce(sum(o.guest_count), 0) as guests
    from boundaries b left join overlapping o on o.starts_at <= b.instant and o.ends_at > b.instant
    group by b.instant
  )
  select coalesce(max(guests), p_guest_count) from loads;
$$;
revoke all on function public.staff_reservation_peak_guests(timestamptz,timestamptz,integer,uuid) from public, anon, authenticated;

create or replace function public.enforce_reservation_simultaneous_capacity()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_capacity integer; v_override boolean; v_exceeded boolean;
begin
  perform pg_advisory_xact_lock(hashtextextended('altstadtliebe-reservation-booking', 0));
  if new.status not in ('pending','confirmed','arrived','completed') then return new; end if;
  v_override := current_setting('app.staff_rule_override', true) = 'true' and public.staff_reservation_access(true);
  select case when v_override then 30 else least(total_reservable_capacity, 26) end into v_capacity
    from public.booking_settings where id = 'default';
  if v_capacity is null or v_capacity < 1 then raise exception using errcode='P0001', message='CAPACITY_CONFIG: reservation capacity is unavailable'; end if;
  v_exceeded := public.staff_reservation_peak_guests(new.starts_at, new.ends_at, new.guest_count, new.id) > v_capacity;
  if v_exceeded then raise exception using errcode='P0001', message=case when v_override then 'ABSOLUTE_CAPACITY' else 'RESERVATION_FULL: simultaneous guest capacity exceeded' end; end if;
  return new;
end; $$;
revoke all on function public.enforce_reservation_simultaneous_capacity() from public, anon, authenticated;
drop trigger if exists enforce_reservation_simultaneous_capacity on public.reservations;
create trigger enforce_reservation_simultaneous_capacity before insert or update on public.reservations for each row execute function public.enforce_reservation_simultaneous_capacity();

create or replace function public.staff_check_reservation_availability(
  p_date date, p_time time, p_guest_count integer, p_booking_source text, p_exclude_reservation_id uuid default null
) returns table(available boolean, reason text, can_override boolean, duration_minutes integer)
language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_settings public.booking_settings%rowtype; v_start timestamptz; v_end timestamptz; v_violation text; v_peak integer; v_online integer;
begin
  if auth.uid() is null or not public.staff_reservation_access(false) then raise exception using errcode='42501', message='NOT_STAFF'; end if;
  if p_date is null or p_time is null or p_guest_count is null or p_guest_count < 1 or p_guest_count > 30 or coalesce(p_booking_source,'') not in ('website','phone','walk_in') then return query select false,'INVALID_INPUT'::text,false,90; return; end if;
  select * into v_settings from public.booking_settings where id='default';
  if not found then return query select false,'CAPACITY_CONFIG'::text,false,90; return; end if;
  v_start := (p_date + p_time) at time zone v_settings.time_zone; v_end := v_start + make_interval(mins=>v_settings.reservation_duration_minutes);
  v_violation := public.staff_reservation_rule_violation(v_start,p_guest_count,p_booking_source);
  if v_violation is not null then return query select false,v_violation,(v_violation <> 'PAST' and public.staff_reservation_access(true)),v_settings.reservation_duration_minutes; return; end if;
  v_peak := public.staff_reservation_peak_guests(v_start,v_end,p_guest_count,p_exclude_reservation_id); v_online := least(v_settings.total_reservable_capacity,26);
  if v_peak > 30 then return query select false,'ABSOLUTE_CAPACITY'::text,false,v_settings.reservation_duration_minutes;
  elsif v_peak > v_online then return query select false,'RESERVATION_FULL'::text,public.staff_reservation_access(true),v_settings.reservation_duration_minutes;
  end if;
  return query select true,'AVAILABLE'::text,false,v_settings.reservation_duration_minutes;
end; $$;
revoke all on function public.staff_check_reservation_availability(date,time,integer,text,uuid) from public, anon;
grant execute on function public.staff_check_reservation_availability(date,time,integer,text,uuid) to authenticated;

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
  v_peak integer;
  v_online_capacity integer;
  v_capacity_exception boolean;
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
    v_peak := public.staff_reservation_peak_guests(v_start, v_end, p_guest_count, null);
    v_online_capacity := least(v_settings.total_reservable_capacity, 26);
    if v_peak > 30 then raise exception using errcode = 'P0001', message = 'ABSOLUTE_CAPACITY'; end if;
    v_capacity_exception := v_peak > v_online_capacity;
    v_violation := public.staff_reservation_rule_violation(v_start, p_guest_count, p_booking_source);
    if v_violation = 'PAST' or v_violation = 'INVALID_INPUT' then
      raise exception using errcode = 'P0001', message = v_violation;
    elsif v_violation is not null or v_capacity_exception then
      if v_reason is null then raise exception using errcode = 'P0001', message = 'RULE_EXCEPTION_REQUIRED'; end if;
      if char_length(v_reason) < 10 or char_length(v_reason) > 1000 or not public.staff_reservation_access(true) then
        raise exception using errcode = '42501', message = 'RULE_EXCEPTION_FORBIDDEN';
      end if;
    elsif v_reason is not null and (char_length(v_reason) < 10 or char_length(v_reason) > 1000 or not public.staff_reservation_access(true)) then
      raise exception using errcode = '42501', message = 'RULE_EXCEPTION_FORBIDDEN';
    end if;
    if v_violation is not null or v_capacity_exception then perform set_config('app.staff_rule_override', 'true', true); end if;
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
    v_peak := public.staff_reservation_peak_guests(v_start, v_end, p_guest_count, p_reservation_id);
    v_online_capacity := least(v_settings.total_reservable_capacity, 26);
    if v_peak > 30 then raise exception using errcode = 'P0001', message = 'ABSOLUTE_CAPACITY'; end if;
    v_capacity_exception := v_peak > v_online_capacity;
    v_violation := public.staff_reservation_rule_violation(v_start, p_guest_count, v_before.booking_source);
    if v_violation = 'PAST' or v_violation = 'INVALID_INPUT' then
      raise exception using errcode = 'P0001', message = v_violation;
    elsif v_violation is not null or v_capacity_exception then
      if v_reason is null then raise exception using errcode = 'P0001', message = 'RULE_EXCEPTION_REQUIRED'; end if;
      if char_length(v_reason) < 10 or char_length(v_reason) > 1000 or not public.staff_reservation_access(true) then
        raise exception using errcode = '42501', message = 'RULE_EXCEPTION_FORBIDDEN';
      end if;
    elsif v_reason is not null and (char_length(v_reason) < 10 or char_length(v_reason) > 1000 or not public.staff_reservation_access(true)) then
      raise exception using errcode = '42501', message = 'RULE_EXCEPTION_FORBIDDEN';
    end if;
    if v_violation is not null or v_capacity_exception then perform set_config('app.staff_rule_override', 'true', true); end if;
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
