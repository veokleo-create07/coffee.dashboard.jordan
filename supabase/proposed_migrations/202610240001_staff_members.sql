-- PROPOSAL ONLY. Review against the existing production schema before applying.
-- Adds staff authorization to the EXISTING shared Supabase project; does not
-- alter reservations, booking settings, opening hours, or booking functions.

create table if not exists public.staff_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

alter table public.staff_members enable row level security;
revoke all privileges on table public.staff_members from public, anon, authenticated;
grant select on public.staff_members to authenticated;
drop policy if exists "Staff can read their own membership" on public.staff_members;
create policy "Staff can read their own membership"
  on public.staff_members for select to authenticated
  using (auth.uid() = user_id);

-- Authenticated members can only read their own row. No insert, update, or
-- delete grants are issued; add members only through a trusted admin workflow.

-- Reservation policies are intentionally untouched. Review and add staff
-- membership predicates to the existing reservations policy separately. A
-- vetted staff-membership helper may be needed for those policies.
