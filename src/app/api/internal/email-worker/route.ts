import { NextRequest, NextResponse } from "next/server";
import { processReservationConfirmationEmails } from "@/lib/email/reservation-confirmation-worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function run(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const result = await processReservationConfirmationEmails();
    return NextResponse.json({ ok: true, ...result });
  } catch {
    return NextResponse.json({ ok: false, code: "EMAIL_WORKER_UNAVAILABLE" }, { status: 503 });
  }
}

// Vercel Cron invokes the route with GET. POST is retained for authenticated
// manual smoke tests and for schedulers that use POST.
export async function GET(request: NextRequest) {
  return run(request);
}

export async function POST(request: NextRequest) {
  return run(request);
}
