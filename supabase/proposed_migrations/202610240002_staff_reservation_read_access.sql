-- PROPOSAL ONLY. Do not apply until reviewed against the existing shared project.
-- Grants authenticated staff read-only access to reservation fields through RLS.
-- Assumes 202610240001_staff_members.sql has already been applied.

grant select on table public.reservations to authenticated;

drop policy if exists "Staff members can read reservations" on public.reservations;
create policy "Staff members can read reservations"
  on public.reservations
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.staff_members
      where staff_members.user_id = auth.uid()
    )
  );

-- No write grants or insert/update/delete policies are added.
