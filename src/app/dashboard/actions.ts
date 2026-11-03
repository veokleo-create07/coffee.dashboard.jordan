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
export type TableNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 11 | 22 | 33 | 44 | 55 | 109 | 110 | 111 | 112 | 113;
export type TableAssignment = { reservationId: string; tableNumber: TableNumber; assignedAt: string };
export type TableAssignmentResult = { ok: true; assignments: TableAssignment[]; setupRequired?: boolean } | { ok: false; reason: "unauthorized" | "permission" | "unavailable" };
export type AvailabilityResult = { ok: true; available: boolean; reason: string; canOverride: boolean; duration: number } | { ok: false; code: string };
export type OccupancyResult =
  | { ok: true; guests: number; visits: Array<{ id: string; guests: number; arrivedAt: string | null }> }
  | { ok: false; reason: "unauthorized" | "permission" | "unavailable" };
export type AnalyticsPeriod = "day" | "week" | "month";
export type AnalyticsResult =
  | { ok: true; period: AnalyticsPeriod; startDate: string; endDate: string; totals: { reservations: number; guests: number; cancellations: number; noShows: number; arrivals: number; completed: number }; trend: Array<{ date: string; reservations: number; guests: number }>; hours: Array<{ hour: number; reservations: number }>; sources: Array<{ source: BookingSource; reservations: number; guests: number }> }
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
function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}
function dateRangeDays(startDate: string, endDate: string) {
  return Math.floor((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86_400_000) + 1;
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
function berlinParts(iso: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso));
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return { date: `${value("year")}-${value("month")}-${value("day")}`, hour: Number(value("hour")) };
}
function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10);
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
    guests: row.guest_count, status: row.status === "pending" ? "confirmed" : row.status, note: row.special_requests };
}
export async function loadReservations(startDate: string, endDate: string): Promise<ReservationLoadResult> {
  // Keep the read surface bounded. The dashboard only needs day, week, and
  // month windows; rejecting malformed or multi-year ranges also prevents an
  // authenticated client from accidentally requesting an expensive scan.
  if (!isIsoDate(startDate) || !isIsoDate(endDate) || startDate > endDate || dateRangeDays(startDate, endDate) > 366) return { ok: false, reason: "unavailable" };
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
export async function loadAnalytics(period: AnalyticsPeriod, anchorDate: string): Promise<AnalyticsResult> {
  if (!["day", "week", "month"].includes(period) || !isIsoDate(anchorDate)) return { ok: false, reason: "unavailable" };
  const startDate = period === "month" ? `${anchorDate.slice(0, 7)}-01` : period === "week" ? addDays(anchorDate, -(new Date(`${anchorDate}T12:00:00Z`).getUTCDay() + 6) % 7) : anchorDate;
  const endDate = period === "month" ? addDays(startDate, new Date(Date.UTC(Number(startDate.slice(0, 4)), Number(startDate.slice(5, 7)), 0)).getUTCDate() - 1) : addDays(startDate, period === "week" ? 6 : 0);
  if (dateRangeDays(startDate, endDate) > 366) return { ok: false, reason: "unavailable" };
  try {
    const supabase = await verifiedStaff(); if (!supabase) return { ok: false, reason: "unauthorized" };
    const exclusive = addDays(endDate, 1);
    const rows: Array<{ booking_source: BookingSource; guest_count: number; starts_at: string; arrived_at: string | null; status: ReservationStatus }> = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabase.from("reservations").select("booking_source,guest_count,starts_at,arrived_at,status").gte("starts_at", zonedMidnightUtc(startDate)).lt("starts_at", zonedMidnightUtc(exclusive)).order("starts_at", { ascending: true }).range(offset, offset + 999);
      if (error) return { ok: false, reason: error.code === "42501" ? "permission" : "unavailable" };
      rows.push(...((data ?? []) as typeof rows)); if ((data?.length ?? 0) < 1000) break;
    }
    const trend = new Map<string, { reservations: number; guests: number }>();
    const hours = new Map<number, number>();
    const sourceMap = new Map<BookingSource, { reservations: number; guests: number }>([["website", { reservations: 0, guests: 0 }], ["phone", { reservations: 0, guests: 0 }], ["walk_in", { reservations: 0, guests: 0 }]]);
    let cancellations = 0, noShows = 0, arrivals = 0, completed = 0, guests = 0;
    for (const row of rows) {
      const parts = berlinParts(row.starts_at); const day = trend.get(parts.date) ?? { reservations: 0, guests: 0 }; day.reservations += 1; day.guests += row.guest_count; trend.set(parts.date, day);
      hours.set(parts.hour, (hours.get(parts.hour) ?? 0) + 1);
      const source = sourceMap.get(row.booking_source) ?? { reservations: 0, guests: 0 }; source.reservations += 1; source.guests += row.guest_count; sourceMap.set(row.booking_source, source);
      guests += row.guest_count; if (row.status === "cancelled") cancellations += 1; if (row.status === "no_show") noShows += 1; if (row.arrived_at) arrivals += 1; if (row.status === "completed") completed += 1;
    }
    const trendRows = Array.from({ length: dateRangeDays(startDate, endDate) }, (_, index) => { const date = addDays(startDate, index); return { date, ...(trend.get(date) ?? { reservations: 0, guests: 0 }) }; });
    return { ok: true, period, startDate, endDate, totals: { reservations: rows.length, guests, cancellations, noShows, arrivals, completed }, trend: trendRows, hours: Array.from(hours, ([hour, reservations]) => ({ hour, reservations })).sort((a, b) => a.hour - b.hour), sources: Array.from(sourceMap, ([source, values]) => ({ source, ...values })) };
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
const knownErrors = new Set(["NOT_STAFF", "INVALID_INPUT", "CAPACITY_CONFIG", "PAST", "BOOKING_WINDOW", "GUEST_LIMIT", "CLOSED", "OUTSIDE_HOURS", "INVALID_SLOT", "RESERVATION_FULL", "ABSOLUTE_CAPACITY", "RULE_EXCEPTION_REQUIRED", "RULE_EXCEPTION_FORBIDDEN", "NOT_FOUND", "INVALID_TRANSITION", "NO_SHOW_TOO_EARLY", "VISIT_STILL_ACTIVE", "OCCUPANCY_TIMESTAMP_FORBIDDEN", "INVALID_TABLES", "TABLE_OCCUPIED"]);
function getErrorCode(error: { message?: string; code?: string }) {
  const first = error.message?.split(":")[0]?.trim() ?? "";
  if (knownErrors.has(first)) return first;
  if (error.code === "42501") return "NOT_STAFF";
  return "UNAVAILABLE";
}
const tableNumbers: TableNumber[] = [1, 2, 3, 4, 5, 6, 7, 11, 22, 33, 44, 55, 109, 110, 111, 112, 113];
export async function loadTableAssignments(): Promise<TableAssignmentResult> {
  try {
    const supabase = await verifiedStaff(); if (!supabase) return { ok: false, reason: "unauthorized" };
    const { data, error } = await supabase.from("reservation_table_assignments").select("reservation_id,table_number,assigned_at").order("table_number", { ascending: true });
    if (error) {
      return { ok: true, assignments: [], setupRequired: true };
    }
    return { ok: true, assignments: (data ?? []).map((row) => ({ reservationId: row.reservation_id, tableNumber: row.table_number as TableNumber, assignedAt: row.assigned_at })) };
  } catch { return { ok: true, assignments: [], setupRequired: true }; }
}
export async function arriveWithTables(id: string, tables: TableNumber[]): Promise<ReservationActionResult> {
  try {
    const supabase = await verifiedStaff(); if (!supabase) return { ok: false, code: "NOT_STAFF" };
    const { data, error } = await supabase.rpc("staff_arrive_with_tables", { p_reservation_id: id, p_tables: tables });
    if (error) return { ok: false, code: getErrorCode(error) };
    revalidatePath("/dashboard"); revalidatePath("/dashboard/reservations"); revalidatePath("/dashboard/tables");
    const row = data && typeof data === "object" ? data as ReservationRow : null;
    return { ok: true, reservation: row ? mapRow(row) : undefined };
  } catch { return { ok: false, code: "UNAVAILABLE" }; }
}
export async function assignReservationTables(id: string, tables: TableNumber[]): Promise<{ ok: true } | { ok: false; code: string }> {
  try {
    const supabase = await verifiedStaff(); if (!supabase) return { ok: false, code: "NOT_STAFF" };
    const { error } = await supabase.rpc("staff_assign_reservation_tables", { p_reservation_id: id, p_tables: tables });
    return error ? { ok: false, code: getErrorCode(error) } : { ok: true };
  } catch { return { ok: false, code: "UNAVAILABLE" }; }
}
export type TableBoardItem = { tableNumber: TableNumber; reservation: LiveReservation | null };
export async function loadTableBoard(): Promise<{ ok: true; tables: TableBoardItem[]; setupRequired?: boolean } | { ok: false; reason: "unauthorized" | "permission" | "unavailable" }> {
  const assignments = await loadTableAssignments(); if (!assignments.ok) return assignments;
  try {
    const supabase = await verifiedStaff(); if (!supabase) return { ok: false, reason: "unauthorized" };
    const ids = [...new Set(assignments.assignments.map((item) => item.reservationId))];
    const rows = ids.length ? await supabase.from("reservations").select("id,reservation_reference,customer_name,customer_email,customer_phone,booking_source,guest_count,starts_at,arrived_at,departed_at,special_requests,status").in("id", ids) : { data: [], error: null };
    if (rows.error) return { ok: false, reason: rows.error.code === "42501" ? "permission" : "unavailable" };
    const reservations = new Map(((rows.data ?? []) as ReservationRow[]).map((row) => [row.id, mapRow(row)]));
    return { ok: true, setupRequired: assignments.setupRequired, tables: tableNumbers.map((tableNumber) => ({ tableNumber, reservation: reservations.get(assignments.assignments.find((item) => item.tableNumber === tableNumber)?.reservationId ?? "") ?? null })) };
  } catch { return { ok: false, reason: "unavailable" }; }
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
