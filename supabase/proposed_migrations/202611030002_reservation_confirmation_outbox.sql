-- PROPOSAL ONLY. Apply to the shared Supabase project after review.
-- Queues only new public website reservations that have a customer email.
-- Staff bookings, historical rows, reminders, cancellations, and edits are excluded.

create table if not exists public.reservation_confirmation_outbox (
  reservation_id uuid primary key references public.reservations(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed', 'skipped')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  provider_message_id text,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists reservation_confirmation_outbox_pending_idx
  on public.reservation_confirmation_outbox (next_attempt_at, created_at)
  where status in ('pending', 'failed');

alter table public.reservation_confirmation_outbox enable row level security;
revoke all on table public.reservation_confirmation_outbox from public, anon, authenticated;

create or replace function public.enqueue_reservation_confirmation_email()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.booking_source = 'website'
     and nullif(btrim(new.customer_email), '') is not null
     and new.status in ('pending', 'confirmed') then
    insert into public.reservation_confirmation_outbox (reservation_id)
    values (new.id)
    on conflict (reservation_id) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.enqueue_reservation_confirmation_email() from public, anon, authenticated;

drop trigger if exists enqueue_reservation_confirmation_email on public.reservations;
create trigger enqueue_reservation_confirmation_email
  after insert on public.reservations
  for each row execute function public.enqueue_reservation_confirmation_email();

create or replace function public.claim_reservation_confirmation_emails(p_limit integer default 10)
returns table (
  id uuid,
  customer_email text,
  customer_name text,
  starts_at timestamptz,
  guest_count integer,
  language text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if p_limit is null or p_limit < 1 or p_limit > 50 then
    raise exception using errcode = '22023', message = 'INVALID_LIMIT';
  end if;

  update public.reservation_confirmation_outbox
  set status = 'pending', locked_at = null
  where status = 'processing'
    and locked_at < now() - interval '10 minutes';

  update public.reservation_confirmation_outbox o
  set status = 'skipped', locked_at = null, last_error = 'RESERVATION_NOT_ELIGIBLE'
  from public.reservations r
  where o.reservation_id = r.id
    and o.status in ('pending', 'failed')
    and (
      r.booking_source <> 'website'
      or nullif(btrim(r.customer_email), '') is null
      or r.status not in ('pending', 'confirmed')
    );

  return query
  with picked as (
    select o.reservation_id
    from public.reservation_confirmation_outbox o
    where o.status in ('pending', 'failed')
      and o.next_attempt_at <= now()
    order by o.created_at
    for update skip locked
    limit p_limit
  ), claimed as (
    update public.reservation_confirmation_outbox o
    set status = 'processing', locked_at = now(), attempt_count = o.attempt_count + 1
    from picked
    where o.reservation_id = picked.reservation_id
    returning o.reservation_id
  )
  select r.id, r.customer_email, r.customer_name, r.starts_at, r.guest_count,
         case when r.language = 'en' then 'en' else 'de' end
  from claimed c
  join public.reservations r on r.id = c.reservation_id
  where r.booking_source = 'website'
    and nullif(btrim(r.customer_email), '') is not null
    and r.status in ('pending', 'confirmed');
end;
$$;
revoke all on function public.claim_reservation_confirmation_emails(integer) from public, anon, authenticated;
grant execute on function public.claim_reservation_confirmation_emails(integer) to service_role;

create or replace function public.complete_reservation_confirmation_email(
  p_reservation_id uuid,
  p_success boolean,
  p_provider_id text default null,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_attempt_count integer;
begin
  select attempt_count into v_attempt_count
  from public.reservation_confirmation_outbox
  where reservation_id = p_reservation_id
  for update;

  if not found then return; end if;

  if p_success then
    update public.reservation_confirmation_outbox
    set status = 'sent', locked_at = null, provider_message_id = left(p_provider_id, 200),
        last_error = null, sent_at = now()
    where reservation_id = p_reservation_id;
  elsif v_attempt_count >= 10 then
    update public.reservation_confirmation_outbox
    set status = 'failed', locked_at = null, last_error = left(coalesce(p_error, 'EMAIL_DELIVERY_FAILED'), 120),
        next_attempt_at = now() + interval '24 hours'
    where reservation_id = p_reservation_id;
  else
    update public.reservation_confirmation_outbox
    set status = case when v_attempt_count >= 10 then 'failed' else 'pending' end,
        locked_at = null, last_error = left(coalesce(p_error, 'EMAIL_DELIVERY_FAILED'), 120),
        next_attempt_at = case when v_attempt_count >= 10
          then now() + interval '24 hours'
          else now()
        end
    where reservation_id = p_reservation_id;
  end if;
end;
$$;
revoke all on function public.complete_reservation_confirmation_email(uuid, boolean, text, text) from public, anon, authenticated;
grant execute on function public.complete_reservation_confirmation_email(uuid, boolean, text, text) to service_role;
