"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkStaffMembership } from "@/lib/auth/staff";

export type LiveReservation = {
  id: string;
  reference: string;
  guest: string;
  email: string;
  date: string;
  time: string;
  guests: number;
  status: "pending" | "confirmed" | "cancelled" | "completed";
  note: string | null;
};

export type ReservationLoadResult =
  | { ok: true; reservations: LiveReservation[] }
  | { ok: false; reason: "unauthorized" | "permission" | "unavailable" };

type ReservationRow = {
  id: string;
  reservation_reference: string;
  customer_name: string;
  customer_email: string;
  guest_count: number;
  starts_at: string;
  special_requests: string | null;
  status: LiveReservation["status"];
};

function zonedMidnightUtc(date: string) {
  // Convert midnight in the cafe's Europe/Berlin timezone to a UTC instant,
  // accounting for CET/CEST without relying on the server's local timezone.
  const [year, month, day] = date.split("-").map(Number);
  const target = Date.UTC(year, month - 1, day);
  let guess = target;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date(guess));
    const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
    const represented = Date.UTC(value("year"), value("month") - 1, value("day"), value("hour"), value("minute"), value("second"));
    guess += target - represented;
  }
  return new Date(guess).toISOString();
}

function berlinDateToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export async function loadReservations(startDate: string, endDate: string): Promise<ReservationLoadResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || startDate > endDate) {
    return { ok: false, reason: "unavailable" };
  }

  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { ok: false, reason: "unauthorized" };
    const { isStaff, error: membershipError } = await checkStaffMembership(supabase, user.id);
    if (membershipError || !isStaff) return { ok: false, reason: "unauthorized" };

    const endExclusive = new Date(`${endDate}T12:00:00Z`);
    endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
    const rows: ReservationRow[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabase
        .from("reservations")
        .select("id,reservation_reference,customer_name,customer_email,guest_count,starts_at,special_requests,status")
        .gte("starts_at", zonedMidnightUtc(startDate))
        .lt("starts_at", zonedMidnightUtc(endExclusive.toISOString().slice(0, 10)))
        .order("starts_at", { ascending: true })
        .range(offset, offset + 999);
      if (error) return { ok: false, reason: error.code === "42501" ? "permission" : "unavailable" };
      rows.push(...((data ?? []) as ReservationRow[]));
      if ((data?.length ?? 0) < 1000) break;
    }

    const reservations: LiveReservation[] = rows.map((row) => {
      const localParts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit",
      }).formatToParts(new Date(row.starts_at));
      const value = (type: string) => localParts.find((part) => part.type === type)?.value ?? "00";
      return {
        id: row.id,
        reference: row.reservation_reference,
        guest: row.customer_name,
        email: row.customer_email,
        date: `${value("year")}-${value("month")}-${value("day")}`,
        time: new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(row.starts_at)),
        guests: row.guest_count,
        status: row.status,
        note: row.special_requests,
      };
    });
    return { ok: true, reservations };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

export async function getOverviewReservations() {
  const today = berlinDateToday();
  const end = new Date(`${today}T12:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 6);
  const endDate = end.toISOString().slice(0, 10);
  return { today, result: await loadReservations(today, endDate) };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
