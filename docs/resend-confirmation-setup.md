# Resend confirmation email setup

Review and apply `supabase/proposed_migrations/202611030002_reservation_confirmation_outbox.sql` to the shared Supabase project. This repository does not apply production SQL.

Add these server-side Vercel variables: `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `EMAIL_WEBHOOK_SECRET`, `ALTSTADTLIEBE_CONTACT_EMAIL`, `ALTSTADTLIEBE_CONTACT_PHONE`, and `ALTSTADTLIEBE_CONTACT_ADDRESS`. Keep the service key, Resend key, and webhook secret server-only; `SUPABASE_ANON_KEY` remains the browser key.

Configure a Supabase Database Webhook for `INSERT` events on `public.reservation_confirmation_outbox`, targeting `https://<staff-dashboard-domain>/api/internal/email-worker`. Add the header `x-email-webhook-secret` with the same value as `EMAIL_WEBHOOK_SECRET`. The worker claims rows with database locks, returns a retryable response when Resend fails, and uses the deterministic Resend idempotency key `reservation-confirmation:<reservation-id>`. It sends only new `website` reservations with a customer email. Staff phone/walk-in rows, historical rows, cancellations, and edits are excluded.

The separate public website needs no email code if it continues using the existing reservation function and writes `booking_source = 'website'`, the customer email, and `language = 'de'` or `language = 'en'`. It must not call the outbox functions or expose worker secrets.

Before production, validate in a non-production project: create German and English test bookings, invoke the webhook, verify one sent row each and no duplicate on a second event, then verify rejected and staff bookings create no outbox rows. Force a temporary Resend failure and verify the webhook retries while the reservation remains successful.
