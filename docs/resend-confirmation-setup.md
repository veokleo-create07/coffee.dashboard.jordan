# Resend confirmation email setup

Review and apply `supabase/proposed_migrations/202611030002_reservation_confirmation_outbox.sql` to the shared Supabase project. This repository does not apply production SQL.

Add these server-side Vercel variables: `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `CRON_SECRET`, `ALTSTADTLIEBE_CONTACT_EMAIL`, `ALTSTADTLIEBE_CONTACT_PHONE`, and `ALTSTADTLIEBE_CONTACT_ADDRESS`. Keep the service key, Resend key, and cron secret server-only; `SUPABASE_ANON_KEY` remains the browser key.

`vercel.json` schedules `GET /api/internal/email-worker` every minute. The worker claims rows with database locks, retries with backoff, and uses the deterministic Resend idempotency key `reservation-confirmation:<reservation-id>`. It sends only new `website` reservations with a customer email. Staff phone/walk-in rows, historical rows, cancellations, and edits are excluded.

The separate public website needs no email code if it continues using the existing reservation function and writes `booking_source = 'website'`, the customer email, and `language = 'de'` or `language = 'en'`. It must not call the outbox functions or expose worker secrets.

Before production, validate in a non-production project: create German and English test bookings, run the authenticated worker, verify one sent row each and no duplicate on a second run, then verify rejected and staff bookings create no outbox rows.
