"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getStaffContext } from "@/lib/auth/staff";

export type ReservationStatus = "pending" | "confirmed" | "arrived" | "completed" | "cancelled" | "no_show";
export type BookingSource = "website" | "phone" | "walk_in";
export type LiveReservation = {
  id: string; reference: string; guest: string; email: string | null; phone: string | null;
  date: string; time: string; startsAt: string; arrivedAt: string | null; departedAt: string | null;
  guests: number; status: ReservationStatus; source: BookingSource; note: string | null;
};
export type ReservationLoadResult =
  | { ok: true; reservations: LiveReservation[] }
  | { ok: false; reason: "unauthorized" | "permission" | "unavailable" };
export type ReservationActionResult = { ok: true; reservation?: LiveReservation } | { ok: false; code: string };
export type AvailabilityResult = { ok: true; available: boolean; reason: string; canOverride: boolean; duration: number } | { ok: false; code: string };
export type OccupancyResult =
  | { ok: true; guests: number; visits: Array<{ id: string; guests: number; arrivedAt: string | null }> }
  | { ok: false; reason: "unauthorized" | "permission" | "unavailable" };
export type ReservationMutation = {
  action: "create" | "edit" | "status"; id?: string; guest?: string; email?: string; phone?: string;
  guests?: number; date?: string; time?: string; note?: string; source?: "phone" | "walk_in";
  status?: "confirmed" | "arrived" | "completed" | "cancelled" | "no_show";
  exceptionReason?: string;
};

type ReservationRow = {
  id: string; reservation_reference: string; customer_name: string; customer_email: string | null;
  customer_phone: string | null; booking_source: BookingSource; guest_count: number; starts_at: string;
  arrived_at: string | null; departed_at: string | null; special_requests: string | null; status: ReservationStatus;
};

function berlinDateToday() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${value("year")}-${value("month")}-${value("day")}`;
}
function zonedMidnightUtc(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const target = Date.UTC(year, month - 1, day); let guess = target;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(guess));
    const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
    guess += target - Date.UTC(value("year"), value("month") - 1, value("day"), value("hour"), value("minute"), value("second"));
  }
  return new Date(guess).toISOString();
}
async function verifiedStaff() {
  return (await getStaffContext())?.supabase ?? null;
}
function mapRow(row: ReservationRow): LiveReservation {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(row.starts_at));
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return { id: row.id, reference: row.reservation_reference, guest: row.customer_name, email: row.customer_email,
    phone: row.customer_phone, source: row.booking_source, date: `${value("year")}-${value("month")}-${value("day")}`,
    time: new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(row.starts_at)),
    startsAt: row.starts_at, arrivedAt: row.arrived_at, departedAt: row.departed_at,
    guests: row.guest_count, status: row.status, note: row.special_requests };
}
export async function loadReservations(startDate: string, endDate: string): Promise<ReservationLoadResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || startDate > endDate) return { ok: false, reason: "unavailable" };
  try {
    const supabase = await verifiedStaff(); if (!supabase) return { ok: false, reason: "unauthorized" };
    const exclusive = new Date(`${endDate}T12:00:00Z`); exclusive.setUTCDate(exclusive.getUTCDate() + 1);
    const rows: ReservationRow[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabase.from("reservations").select("id,reservation_reference,customer_name,customer_email,customer_phone,booking_source,guest_count,starts_at,arrived_at,departed_at,special_requests,status")
        .gte("starts_at", zonedMidnightUtc(startDate)).lt("starts_at", zonedMidnightUtc(exclusive.toISOString().slice(0, 10))).order("starts_at", { ascending: true }).range(offset, offset + 999);
      if (error) return { ok: false, reason: error.code === "42501" ? "permission" : "unavailable" };
      rows.push(...((data ?? []) as ReservationRow[])); if ((data?.length ?? 0) < 1000) break;
    }
    return { ok: true, reservations: rows.map(mapRow) };
  } catch { return { ok: false, reason: "unavailable" }; }
}
export async function getOverviewReservations() {
  const today = berlinDateToday(); const end = new Date(`${today}T12:00:00Z`); end.setUTCDate(end.getUTCDate() + 6);
  const [result, occupancy] = await Promise.all([
    loadReservations(today, end.toISOString().slice(0, 10)),
    loadCurrentOccupancy(),
  ]);
  return { today, result, occupancy };
}

export async function loadCurrentOccupancy(): Promise<OccupancyResult> {
  try {
    const supabase = await verifiedStaff();
    if (!supabase) return { ok: false, reason: "unauthorized" };
    const { data, error } = await supabase.from("reservations")
      .select("id,guest_count,arrived_at")
      .eq("status", "arrived")
      .is("departed_at", null);
    if (error) return { ok: false, reason: error.code === "42501" ? "permission" : "unavailable" };
    const visits = (data ?? []).map((row) => ({ id: row.id, guests: row.guest_count, arrivedAt: row.arrived_at }));
    return { ok: true, guests: visits.reduce((sum, visit) => sum + visit.guests, 0), visits };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
const knownErrors = new Set(["NOT_STAFF", "INVALID_INPUT", "CAPACITY_CONFIG", "PAST", "BOOKING_WINDOW", "GUEST_LIMIT", "CLOSED", "OUTSIDE_HOURS", "INVALID_SLOT", "RESERVATION_FULL", "ABSOLUTE_CAPACITY", "RULE_EXCEPTION_REQUIRED", "RULE_EXCEPTION_FORBIDDEN", "NOT_FOUND", "INVALID_TRANSITION", "NO_SHOW_TOO_EARLY", "VISIT_STILL_ACTIVE", "OCCUPANCY_TIMESTAMP_FORBIDDEN"]);
function getErrorCode(error: { message?: string; code?: string }) {
  const first = error.message?.split(":")[0]?.trim() ?? "";
  if (knownErrors.has(first)) return first;
  if (error.code === "42501") return "NOT_STAFF";
  return "UNAVAILABLE";
}
export async function checkReservationAvailability(input: { date: string; time: string; guests: number; source: BookingSource; excludeId?: string }): Promise<AvailabilityResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !/^\d{2}:\d{2}$/.test(input.time) || !Number.isInteger(input.guests) || input.guests < 1 || input.guests > 30) return { ok: false, code: "INVALID_INPUT" };
  try {
    const supabase = await verifiedStaff(); if (!supabase) return { ok: false, code: "NOT_STAFF" };
    const { data, error } = await supabase.rpc("staff_check_reservation_availability", { p_date: input.date, p_time: input.time, p_guest_count: input.guests, p_booking_source: input.source, p_exclude_reservation_id: input.excludeId ?? null });
    if (error) return { ok: false, code: getErrorCode(error) };
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return { ok: false, code: "UNAVAILABLE" };
    return { ok: true, available: Boolean(row.available), reason: String(row.reason), canOverride: Boolean(row.can_override), duration: Number(row.duration_minutes) || 90 };
  } catch { return { ok: false, code: "UNAVAILABLE" }; }
}
export async function manageReservation(input: ReservationMutation): Promise<ReservationActionResult> {
  if (!input || !["create", "edit", "status"].includes(input.action)) return { ok: false, code: "INVALID_INPUT" };
  try {
    const supabase = await verifiedStaff(); if (!supabase) return { ok: false, code: "NOT_STAFF" };
    const locale = (await cookies()).get("AL_LOCALE")?.value === "en" ? "en" : "de";
    const { data, error } = await supabase.rpc("staff_manage_reservation", {
      p_action: input.action, p_reservation_id: input.id ?? null,
      p_customer_name: input.guest?.trim() ?? null, p_customer_email: input.email?.trim() || null, p_customer_phone: input.phone?.trim() || null,
      p_guest_count: input.guests ?? null, p_date: input.date ?? null, p_time: input.time ?? null, p_special_requests: input.note?.trim() || "",
      p_booking_source: input.source ?? null, p_target_status: input.status ?? null,
      p_exception_reason: input.exceptionReason?.trim() || null, p_language: locale,
    });
    if (error) return { ok: false, code: getErrorCode(error) };
    revalidatePath("/dashboard"); revalidatePath("/dashboard/reservations");
    const row = data && typeof data === "object" ? data as ReservationRow : null;
    return { ok: true, reservation: row ? mapRow(row) : undefined };
  } catch { return { ok: false, code: "UNAVAILABLE" }; }
}
export async function signOut() { const supabase = await createClient(); await supabase.auth.signOut(); redirect("/login"); }
