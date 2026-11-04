# Altstadtliebe Staff Dashboard

Private staff dashboard foundation for Altstadtliebe Café in Lübeck. This app connects to the **existing shared Supabase project** used by the public website and reservation engine.

## Local setup

1. Install Node.js 20.9 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local` and add the existing project's Supabase project URL and anon/publishable key.
4. Run `npm run dev` and open `http://localhost:3000`.

The required server-only values are `SUPABASE_URL` and `SUPABASE_ANON_KEY`. Realtime also requires the matching `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` values for the browser client. Never add a service-role key to this application. Database access must be governed by Supabase RLS.

## Staff access

Login uses Supabase Auth email/password. There is no public registration flow. A valid authenticated user must also have a row in `public.staff_members` before the server renders `/dashboard`. Overview and Reservations now read real reservation rows on the server through that staff session. The query uses only the anon key and requests only the fields needed by the dashboard; no service-role key is used.

The proposed migrations are not executed by this repository. Apply `202610240001_staff_members.sql` first if it has not already been applied, then review and apply `202610240002_staff_reservation_read_access.sql` to grant staff read-only access through RLS. The latter adds no reservation write permissions. If the read policy is not applied, the app displays a localized permission message and does not fall back to mock reservation data.

The dashboard reads the shared reservation schema through RLS and the existing staff RPCs. It preserves stored phone, source, arrival, departure, no-show, and status data, and calculates Analytics from live reservation rows. Table assignments are optional and require their proposed Supabase migration before the Tables page can show live occupancy.

## Commands

- `npm run dev` — local development
- `npm run lint` — ESLint
- `npm run typecheck` — TypeScript checks
- `npm run build` — production build

The deployment and Supabase project are managed separately. No credentials, staff accounts, migrations, or deployment settings are stored here.
