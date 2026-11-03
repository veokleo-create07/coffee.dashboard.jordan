"use client";
import { useEffect, useState } from "react";
import { Clock3, Grid2X2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { loadTableBoard, type TableBoardItem } from "@/app/dashboard/actions";
import { PageIntro } from "@/components/dashboard/primitives";
const duration = 90 * 60_000;
function remaining(arrivedAt: string | null, now: number) { return arrivedAt ? Math.max(0, Date.parse(arrivedAt) + duration - now) : 0; }
function clock(value: number) { const seconds = Math.floor(value / 1000); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`; }
export default function TablesLive({ initial }: { initial: { ok: true; tables: TableBoardItem[]; setupRequired?: boolean } | { ok: false; reason: string } }) {
  const t = useTranslations("Tables"); const [data, setData] = useState(initial); const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); const refresh = () => void loadTableBoard().then(setData); const poll = window.setInterval(refresh, 5000); return () => { window.clearInterval(timer); window.clearInterval(poll); }; }, []);
  return <><PageIntro eyebrow="" title={t("title")} description={t("description")} />{!data.ok ? <section className="panel tables-empty">{t("unavailable")}</section> : <>{data.setupRequired ? <div className="tables-setup-note" role="status">{t("setupRequired")}</div> : null}<section className="tables-grid" aria-label={t("title")}>{data.tables.map((item) => { const active = item.reservation; const left = active ? remaining(active.arrivedAt, now) : 0; const nearEnd = active && left < 15 * 60_000; return <article className={`table-card${active ? " is-occupied" : ""}${nearEnd ? " is-near-end" : ""}`} key={item.tableNumber}><div className="table-card-number"><Grid2X2 size={17} />{item.tableNumber}</div>{active ? <><strong>{active.guest}</strong><span>{active.guests} {t("guests")}</span><span className="table-card-timer"><Clock3 size={13} />{clock(left)} {t("remaining")}</span></> : <span className="table-card-available">{t("available")}</span>}</article>; })}</section>{data.tables.every((item) => !item.reservation) ? <p className="tables-empty-note">{t("empty")}</p> : null}</>}</>;
}
