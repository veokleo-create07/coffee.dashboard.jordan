"use client";
import { useCallback, useEffect, useState } from "react";
import { Clock3, Grid2X2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { loadTableBoard, type TableBoardItem } from "@/app/dashboard/actions";
import { PageIntro } from "@/components/dashboard/primitives";
import { useTableRealtime } from "@/lib/dashboard/use-reservation-realtime";
const duration = 90 * 60_000;
function remaining(arrivedAt: string | null, now: number) { return arrivedAt ? Math.max(0, Date.parse(arrivedAt) + duration - now) : 0; }
function clock(value: number) { const seconds = Math.floor(value / 1000); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`; }
export default function TablesLive({ initial }: { initial: { ok: true; tables: TableBoardItem[]; setupRequired?: boolean } | { ok: false; reason: string } }) {
  const t = useTranslations("Tables"); const [data, setData] = useState(initial); const [now, setNow] = useState(() => Date.now());
  const refresh = useCallback(() => { void loadTableBoard().then(setData); }, []);
  const realtimeAvailable = useTableRealtime(refresh);
  const hasOccupiedTables = data.ok && data.tables.some((item) => item.reservation);
  useEffect(() => { if (!hasOccupiedTables) return; const timer = window.setInterval(() => setNow(Date.now()), 1_000); return () => window.clearInterval(timer); }, [hasOccupiedTables]);
  useEffect(() => { const poll = window.setInterval(refresh, realtimeAvailable ? 60_000 : 30_000); const onFocus = () => { if (document.visibilityState === "visible") refresh(); }; window.addEventListener("focus", onFocus); document.addEventListener("visibilitychange", onFocus); return () => { window.clearInterval(poll); window.removeEventListener("focus", onFocus); document.removeEventListener("visibilitychange", onFocus); }; }, [realtimeAvailable, refresh]);
  return <><PageIntro eyebrow="" title={t("title")} description={t("description")} />{!data.ok ? <section className="panel tables-empty">{t("unavailable")}</section> : <>{data.setupRequired ? <div className="tables-setup-note" role="status">{t("setupRequired")}</div> : null}<section className="tables-grid" aria-label={t("title")}>{data.tables.map((item) => { const active = item.reservation; const left = active ? remaining(active.arrivedAt, now) : 0; const nearEnd = Boolean(active && left < 15 * 60_000); const progress = active ? Math.min(100, Math.max(0, (left / duration) * 100)) : 0; return <article className={`table-card${active ? " is-occupied" : ""}${nearEnd ? " is-near-end" : ""}`} key={item.tableNumber}><div className="table-card-top"><div className="table-card-number"><span className="table-card-icon"><Grid2X2 size={16} /></span><span>{item.tableNumber}</span></div><span className={`table-card-status${active ? " is-occupied" : ""}`}><i aria-hidden="true" />{active ? t("occupied") : t("available")}</span></div>{active ? <div className="table-card-guest"><strong title={active.guest}>{active.guest}</strong><span>{active.guests} {t("guests")}</span><div className="table-card-progress" aria-hidden="true"><i style={{ width: `${progress}%` }} /></div><span className="table-card-timer"><Clock3 size={13} />{clock(left)} <em>{t("remaining")}</em></span></div> : null}</article>; })}</section>{data.tables.every((item) => !item.reservation) ? <p className="tables-empty-note">{t("empty")}</p> : null}</>}</>;
}
