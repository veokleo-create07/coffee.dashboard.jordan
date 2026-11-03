"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { BarChart3, CalendarDays, CheckCircle2, Clock3, UserRoundCheck, UsersRound, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { loadAnalytics, type AnalyticsPeriod, type AnalyticsResult } from "@/app/dashboard/actions";
import { MetricCard, PageIntro, PanelHeading } from "@/components/dashboard/primitives";

function today() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date()); }
function labelSource(source: string, t: (key: string) => string) { return source === "website" ? t("website") : source === "phone" ? t("telephone") : t("walkIn"); }

export default function AnalyticsLive({ initial }: { initial: AnalyticsResult }) {
  const t = useTranslations("Analytics");
  const [period, setPeriod] = useState<AnalyticsPeriod>(initial.ok ? initial.period : "month");
  const [anchor, setAnchor] = useState(initial.ok ? initial.startDate : today());
  const [result, setResult] = useState<AnalyticsResult>(initial);
  const [pending, startTransition] = useTransition();
  useEffect(() => { if (!initial.ok) return; }, [initial]);
  const refresh = (nextPeriod: AnalyticsPeriod, nextDate: string) => startTransition(async () => setResult(await loadAnalytics(nextPeriod, nextDate)));
  const setPeriodAndRefresh = (value: AnalyticsPeriod) => { setPeriod(value); refresh(value, anchor); };
  const setDateAndRefresh = (value: string) => { setAnchor(value); refresh(period, value); };
  const data = result.ok ? result : null;
  const maxTrend = Math.max(1, ...(data?.trend.map((item) => item.reservations) ?? [0]));
  const maxHour = Math.max(1, ...(data?.hours.map((item) => item.reservations) ?? [0]));
  const peak = data?.hours.reduce((best, item) => item.reservations > (best?.reservations ?? 0) ? item : best, data.hours[0]);
  const rangeLabel = useMemo(() => data ? `${data.startDate} – ${data.endDate}` : "", [data]);
  return <>
    <PageIntro eyebrow="" title={t("title")} description={t("description")} />
    <div className="analytics-live-toolbar" aria-label={t("period")}>
      <label>{t("period")}<select value={period} onChange={(event) => setPeriodAndRefresh(event.target.value as AnalyticsPeriod)}><option value="day">{t("day")}</option><option value="week">{t("week")}</option><option value="month">{t("month")}</option></select></label>
      <label>{t("chooseDate")}<input type="date" value={anchor} onChange={(event) => setDateAndRefresh(event.target.value)} /></label>
      {data ? <span className="analytics-live-range">{rangeLabel}</span> : null}
    </div>
    {pending ? <div className="analytics-live-status" aria-live="polite">{t("loading")}</div> : null}
    {!data ? <section className="panel analytics-live-empty" aria-live="polite"><BarChart3 size={20} /><p>{result.ok ? t("empty") : t("unavailable")}</p></section> : <>
      <section className="analytics-live-metrics" aria-label={t("metrics", { period: rangeLabel })}>
        <MetricCard label={t("totalReservations")} value={data.totals.reservations} detail={t("liveData")} icon={<CalendarDays size={16} />} />
        <MetricCard label={t("totalGuests")} value={data.totals.guests} detail={t("liveData")} icon={<UsersRound size={16} />} tone="sage" />
        <MetricCard label={t("arrivals")} value={data.totals.arrivals} detail={t("liveData")} icon={<UserRoundCheck size={16} />} tone="gold" />
        <MetricCard label={t("completed")} value={data.totals.completed} detail={t("liveData")} icon={<CheckCircle2 size={16} />} tone="stone" />
        <MetricCard label={t("cancellations")} value={data.totals.cancellations} detail={t("liveData")} icon={<XCircle size={16} />} tone="clay" />
        <MetricCard label={t("noShows")} value={data.totals.noShows} detail={t("liveData")} icon={<Clock3 size={16} />} tone="stone" />
      </section>
      <div className="analytics-live-grid">
        <section className="panel chart-panel analytics-live-panel"><PanelHeading title={t("bookingTrend")} detail={rangeLabel} /><div className="analytics-live-bars" role="img" aria-label={t("bookingTrend")}>{data.trend.map((item) => <div className="analytics-live-bar-group" key={item.date}><span>{item.reservations}</span><i style={{ height: `${(item.reservations / maxTrend) * 100}%` }} /><small>{item.date.slice(5)}</small></div>)}</div>{data.trend.every((item) => item.reservations === 0) ? <p className="analytics-live-no-data">{t("noData")}</p> : null}</section>
        <section className="panel chart-panel analytics-live-panel"><PanelHeading title={t("busiestHours")} detail={peak ? `${String(peak.hour).padStart(2, "0")}:00` : t("noData")} /><div className="analytics-live-hours">{data.hours.map((item) => <div className="analytics-live-hour" key={item.hour}><span>{String(item.hour).padStart(2, "0")}:00</span><div><i style={{ width: `${(item.reservations / maxHour) * 100}%` }} /></div><b>{item.reservations}</b></div>)}</div>{data.hours.length === 0 ? <p className="analytics-live-no-data">{t("noData")}</p> : null}</section>
      </div>
      <section className="panel analytics-live-panel"><PanelHeading title={t("bookingSources")} detail={t("sourceShare")} /><div className="analytics-live-sources">{data.sources.map((item) => <div className="analytics-live-source" key={item.source}><span>{labelSource(item.source, t)}</span><div><i style={{ width: `${data.totals.reservations ? (item.reservations / data.totals.reservations) * 100 : 0}%` }} /></div><b>{item.reservations}</b></div>)}</div></section>
      <p className="analytics-live-note">{t("historicalNote")}</p>
    </>}
  </>;
}
