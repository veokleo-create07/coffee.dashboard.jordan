import { NextRequest, NextResponse } from "next/server";
import { processReservationConfirmationEmails } from "@/lib/email/reservation-confirmation-worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest) {
  const secret = process.env.EMAIL_WEBHOOK_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get("x-email-webhook-secret") === secret;
}

async function run(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const payload = await request.json() as { type?: string; table?: string; record?: { reservation_id?: string } };
    if (payload.type !== "INSERT" || payload.table !== "reservation_confirmation_outbox" || !payload.record?.reservation_id) {
      return NextResponse.json({ ok: false, code: "INVALID_EMAIL_EVENT" }, { status: 400 });
    }
    const result = await processReservationConfirmationEmails();
    if (result.failed > 0) {
      return NextResponse.json({ ok: false, code: "EMAIL_DELIVERY_RETRYABLE", ...result }, { status: 503 });
    }
    return NextResponse.json({ ok: true, ...result });
  } catch {
    return NextResponse.json({ ok: false, code: "EMAIL_WORKER_UNAVAILABLE" }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  return run(request);
}
