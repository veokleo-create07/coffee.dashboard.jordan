-- Staff device subscriptions for Web Push notifications.
-- Apply only after testing. This migration does not change reservations or capacity rules.

create table if not exists public.staff_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.staff_push_subscriptions enable row level security;
revoke all on table public.staff_push_subscriptions from public, anon, authenticated;
grant select, insert, update, delete on table public.staff_push_subscriptions to authenticated;

drop policy if exists "Staff can manage their push subscriptions" on public.staff_push_subscriptions;
create policy "Staff can manage their push subscriptions"
  on public.staff_push_subscriptions
  for all to authenticated
  using (user_id = auth.uid() and public.staff_reservation_access(false))
  with check (user_id = auth.uid() and public.staff_reservation_access(false));

create index if not exists staff_push_subscriptions_user_id_idx
  on public.staff_push_subscriptions(user_id);
