export type ReservationStatus = "confirmed" | "arrived" | "seated" | "completed" | "cancelled" | "no-show";
export type BookingSource = "Online" | "Telefon" | "Walk-in";

export type Reservation = {
  id: string;
  guest: string;
  email: string;
  phone: string;
  date: string;
  time: string;
  guests: number;
  status: ReservationStatus;
  source: BookingSource;
  note?: string;
};

export const mockReservations: Reservation[] = [
  { id: "AL-2410-01", guest: "Mila Hartmann", email: "mila.hartmann@example.com", phone: "+49 451 204 18 36", date: "2026-10-24", time: "09:00", guests: 2, status: "seated", source: "Online", note: "Fensterplatz, wenn möglich" },
  { id: "AL-2410-02", guest: "Jonas Petersen", email: "jonas.petersen@example.com", phone: "+49 451 702 91 40", date: "2026-10-24", time: "09:30", guests: 3, status: "arrived", source: "Telefon" },
  { id: "AL-2410-03", guest: "Clara & Felix Brandt", email: "clara.brandt@example.com", phone: "+49 176 445 91 203", date: "2026-10-24", time: "10:00", guests: 2, status: "confirmed", source: "Online", note: "Kinderwagen dabei" },
  { id: "AL-2410-04", guest: "Nele Schubert", email: "nele.schubert@example.com", phone: "+49 451 819 22 05", date: "2026-10-24", time: "10:30", guests: 4, status: "seated", source: "Online" },
  { id: "AL-2410-05", guest: "Mats Jürgens", email: "mats.juergens@example.com", phone: "+49 171 933 02 88", date: "2026-10-24", time: "11:00", guests: 2, status: "confirmed", source: "Telefon", note: "Laktosefreie Milch" },
  { id: "AL-2410-06", guest: "Amelie Krüger", email: "amelie.krueger@example.com", phone: "+49 451 330 73 61", date: "2026-10-24", time: "11:30", guests: 5, status: "seated", source: "Online" },
  { id: "AL-2410-07", guest: "Luca & Marie Lorenzen", email: "marie.lorenzen@example.com", phone: "+49 152 028 61 775", date: "2026-10-24", time: "12:00", guests: 2, status: "confirmed", source: "Online" },
  { id: "AL-2410-08", guest: "Frieda Thomsen", email: "frieda.thomsen@example.com", phone: "+49 451 202 85 19", date: "2026-10-24", time: "12:30", guests: 3, status: "confirmed", source: "Walk-in", note: "Ruhiger Platz" },
  { id: "AL-2410-09", guest: "Leonie Wagner", email: "leonie.wagner@example.com", phone: "+49 160 528 74 91", date: "2026-10-24", time: "13:00", guests: 2, status: "confirmed", source: "Online" },
  { id: "AL-2410-10", guest: "Benedikt Faber", email: "benedikt.faber@example.com", phone: "+49 451 716 04 52", date: "2026-10-24", time: "14:00", guests: 4, status: "confirmed", source: "Telefon" },
  { id: "AL-2510-01", guest: "Lina & Moritz Ehlers", email: "lina.ehlers@example.com", phone: "+49 170 508 26 90", date: "2026-10-25", time: "10:00", guests: 2, status: "confirmed", source: "Online" },
  { id: "AL-2510-02", guest: "Emma Hansen", email: "emma.hansen@example.com", phone: "+49 451 776 28 51", date: "2026-10-25", time: "11:30", guests: 3, status: "confirmed", source: "Online", note: "Geburtstag" },
  { id: "AL-2610-01", guest: "Henrik Clausen", email: "henrik.clausen@example.com", phone: "+49 172 114 66 32", date: "2026-10-26", time: "09:30", guests: 2, status: "confirmed", source: "Telefon" },
  { id: "AL-2710-01", guest: "Sophie Martens", email: "sophie.martens@example.com", phone: "+49 451 520 18 44", date: "2026-10-27", time: "12:00", guests: 6, status: "confirmed", source: "Online" },
];

export type Guest = {
  name: string;
  email: string;
  phone: string;
  visits: number;
  lastVisit: string;
  note: string;
  favorite: string;
};

export const mockGuests: Guest[] = [
  { name: "Mila Hartmann", email: "mila.hartmann@example.com", phone: "+49 451 204 18 36", visits: 12, lastVisit: "Heute", note: "Fensterplatz, wenn möglich", favorite: "Flat White" },
  { name: "Jonas Petersen", email: "jonas.petersen@example.com", phone: "+49 451 702 91 40", visits: 8, lastVisit: "Heute", note: "Kommt gelegentlich mit Hund", favorite: "Filterkaffee" },
  { name: "Clara Brandt", email: "clara.brandt@example.com", phone: "+49 176 445 91 203", visits: 6, lastVisit: "Heute", note: "Kinderwagen dabei", favorite: "Hafer-Cappuccino" },
  { name: "Nele Schubert", email: "nele.schubert@example.com", phone: "+49 451 819 22 05", visits: 4, lastVisit: "Heute", note: "Vegetarisch", favorite: "Matcha Latte" },
  { name: "Mats Jürgens", email: "mats.juergens@example.com", phone: "+49 171 933 02 88", visits: 10, lastVisit: "Heute", note: "Laktosefreie Milch", favorite: "Espresso doppio" },
  { name: "Amelie Krüger", email: "amelie.krueger@example.com", phone: "+49 451 330 73 61", visits: 3, lastVisit: "Heute", note: "Süßes zum Kaffee", favorite: "Zimtschnecke" },
  { name: "Frieda Thomsen", email: "frieda.thomsen@example.com", phone: "+49 451 202 85 19", visits: 9, lastVisit: "Heute", note: "Ruhiger Platz", favorite: "Chai Latte" },
  { name: "Lina Ehlers", email: "lina.ehlers@example.com", phone: "+49 170 508 26 90", visits: 5, lastVisit: "2026-10-18", note: "Nussallergie", favorite: "Cortado" },
  { name: "Emma Hansen", email: "emma.hansen@example.com", phone: "+49 451 776 28 51", visits: 2, lastVisit: "2026-10-11", note: "Geburtstag im Oktober", favorite: "Heiße Schokolade" },
  { name: "Sophie Martens", email: "sophie.martens@example.com", phone: "+49 451 520 18 44", visits: 14, lastVisit: "2026-10-05", note: "Feiertagsreservierung", favorite: "Flat White" },
];

export const statusLabels: Record<ReservationStatus, string> = {
  confirmed: "Bestätigt",
  arrived: "Eingetroffen",
  seated: "Am Tisch",
  completed: "Abgeschlossen",
  cancelled: "Storniert",
  "no-show": "Nicht erschienen",
};
