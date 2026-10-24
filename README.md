# Altstadtliebe Staff Dashboard

Private staff dashboard foundation for Altstadtliebe Café in Lübeck. This app connects to the **existing shared Supabase project** used by the public website and reservation engine.

## Local setup

1. Install Node.js 20.9 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local` and add the existing project's Supabase project URL and anon/publishable key.
4. Run `npm run dev` and open `http://localhost:3000`.

The required values are `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. The anon key is intended for browser use; database access must be governed by Supabase RLS. Do not add a service-role key to this application.

## Staff access

Login uses Supabase Auth email/password. There is no public registration flow. A valid authenticated user must also have a row in `public.staff_members` before the server renders `/dashboard`. Until the proposed SQL in `supabase/proposed_migrations/202610240001_staff_members.sql` has been reviewed and applied to the existing project, there is no authorized staff user. The dashboard currently reads only the staff membership row and does not query reservation data.

The proposed migration is not executed by this repository. Review its table and policy alongside the existing schema before applying it. Reservation access must be explicitly protected by staff-aware RLS policies before reservation features are implemented. Do not weaken existing public reservation behavior as part of this foundation.

## Commands

- `npm run dev` — local development
- `npm run lint` — ESLint
- `npm run typecheck` — TypeScript checks
- `npm run build` — production build

The deployment and Supabase project are managed separately. No credentials, staff accounts, migrations, or deployment settings are stored here.
