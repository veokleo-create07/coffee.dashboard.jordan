import { createClient } from "@supabase/supabase-js";
import {
  buildReservationConfirmationEmail,
  getEmailConfiguration,
  type ReservationConfirmation,
} from "@/lib/email/reservation-confirmation";

type ClaimedEmail = ReservationConfirmation & { id: string };

function requiredEnvironment(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing email configuration: ${name}`);
  return value;
}

function adminClient() {
  return createClient(
    requiredEnvironment("SUPABASE_URL"),
    requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

async function sendWithResend(email: ClaimedEmail) {
  const configuration = getEmailConfiguration();
  const message = buildReservationConfirmationEmail(email, configuration);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requiredEnvironment("RESEND_API_KEY")}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `reservation-confirmation:${email.id}`,
    },
    body: JSON.stringify({
      from: configuration.from,
      to: [email.customerEmail],
      subject: message.subject,
      html: message.html,
      text: message.text,
    }),
  });

  if (!response.ok) {
    throw new Error(`RESEND_HTTP_${response.status}`);
  }

  const result = await response.json() as { id?: string };
  return result.id ?? null;
}

export async function processReservationConfirmationEmails(limit = 10) {
  const supabase = adminClient();
  const { data, error } = await supabase.rpc("claim_reservation_confirmation_emails", { p_limit: limit });
  if (error) throw new Error("EMAIL_QUEUE_CLAIM_FAILED");

  const claimed = (Array.isArray(data) ? data : []) as ClaimedEmail[];
  let sent = 0;
  let failed = 0;
  for (const email of claimed) {
    try {
      const providerId = await sendWithResend(email);
      const { error: completeError } = await supabase.rpc("complete_reservation_confirmation_email", {
        p_reservation_id: email.id,
        p_success: true,
        p_provider_id: providerId,
        p_error: null,
      });
      if (completeError) throw new Error("EMAIL_QUEUE_COMPLETE_FAILED");
      sent += 1;
    } catch (error) {
      const safeError = error instanceof Error && /^RESEND_HTTP_[0-9]{3}$/.test(error.message)
        ? error.message
        : "EMAIL_DELIVERY_FAILED";
      await supabase.rpc("complete_reservation_confirmation_email", {
        p_reservation_id: email.id,
        p_success: false,
        p_provider_id: null,
        p_error: safeError,
      });
      failed += 1;
    }
  }

  return { claimed: claimed.length, sent, failed };
}
