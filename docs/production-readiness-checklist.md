# Altstadtliebe Staff Dashboard production checklist

This checklist separates checks completed locally from checks that require the
deployed Supabase project and a real staff account.

## Completed locally

- Authentication and staff authorization paths reviewed in `src/lib/auth/staff.ts`,
  `proxy.ts`, and dashboard server actions.
- Dashboard writes use the authorized `manageReservation` server action and
  existing Supabase RPCs; no client-side table writes or service-role secret was
  found in the repository.
- Reservation input date range and login payload limits are validated before
  server work.
- Cancelled bookings are hidden from dashboard views while remaining available
  to Supabase audit/history queries.
- Bulk selection and audited cancellation are available on Overview and
  Reservations.
- Realtime reservation refresh was added with a 250 ms coalescing debounce.
  Existing focus, visibility, and 10-second polling refreshes remain as a
  fallback.
- `npm audit --omit=dev --audit-level=high` reports no high-severity production
  dependency vulnerabilities.

## Run before release

```bash
npm run lint
npm run typecheck
npm run build
npm audit --omit=dev --audit-level=high
git diff --check
```

## Required deployed-environment checks

1. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the
   dashboard deployment. The anon key is intended for browser use; never put a
   service-role key in either variable.
2. In Supabase, confirm Realtime is enabled for `public.reservations` and that
   the existing RLS policy permits the authenticated staff role to receive the
   rows it already can read. Do not broaden public access.
3. With two staff browser sessions, create, edit, cancel, arrive, seat, depart,
   and delete a reservation. Confirm the other session updates automatically;
   then test again with the browser offline or Realtime disabled to confirm the
   polling fallback still refreshes within 10 seconds.
4. Verify public booking rules separately: six guests per booking and the
   configured simultaneous capacity remain enforced, while authorized staff
   overrides continue to be audited.
5. Verify RLS and RPC permissions using a non-staff authenticated account and
   an anonymous session. Both must be unable to call staff mutation paths.
6. Confirm backups, alerting, error tracking, and deployment rollback settings
   in the hosting and Supabase consoles.

## Critical smoke flows

- Desktop and mobile: login, navigate Overview/Reservations/Analytics, switch
  day/week/month, change dates, search/filter, open/close details.
- Create and edit a 1-person and 30-person staff reservation; verify normal
  validation, capacity warning/override, audit entry, and immediate list update.
- Exercise pending, confirmed, arrived, completed, cancelled, and no-show
  actions, including the arrival timer and actual arrival/departure timeline.
- Select all visible rows, bulk-delete, reload, and confirm the rows stay hidden
  while Supabase history remains intact.
- Switch English/German and test long names, long email addresses, empty states,
  errors, and narrow viewports (320px, 390px, 768px, 1024px, 1440px).

