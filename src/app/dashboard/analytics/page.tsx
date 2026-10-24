"use client";

import { useMemo, useState } from "react";
import { BarChart3, CalendarDays, Clock3, UsersRound } from "lucide-react";
import { MetricCard, PageIntro, PanelHeading } from "@/components/dashboard/primitives";
import { useLocale, useTranslations } from "next-intl";

type Period = "2026-10" | "2026-09" | "2026-08";
const datasets: Record<Period, { reservations: number; guests: number; average: number; noShows: number; rate: number; times: number[]; sources: ["online" | "telephone" | "walkIn", number][] }> = {
  "2026-10": { reservations: 428, guests: 912, average: 2.1, noShows: 9, rate: 2.1, times: [18, 31, 45, 56, 62, 49, 34, 22], sources: [["online", 68], ["telephone", 23], ["walkIn", 9]] },
  "2026-09": { reservations: 392, guests: 835, average: 2.1, noShows: 11, rate: 2.8, times: [16, 28, 41, 53, 58, 46, 31, 20], sources: [["online", 64], ["telephone", 27], ["walkIn", 9]] },
  "2026-08": { reservations: 361, guests: 784, average: 2.2, noShows: 8, rate: 2.2, times: [14, 25, 38, 49, 56, 45, 32, 18], sources: [["online", 61], ["telephone", 29], ["walkIn", 10]] },
};
const periods: Period[] = ["2026-10", "2026-09", "2026-08"];
const hours = ["09", "10", "11", "12", "13", "14", "15", "16"];

export default function AnalyticsPage() {
  const t = useTranslations("Analytics");
  const locale = useLocale();
  const [period, setPeriod] = useState<Period>("2026-10");
  const data = datasets[period];
  const month = (value: Period) => new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(new Date(`${value}-01T12:00:00`));
  const number = new Intl.NumberFormat(locale);
  const percent = (value: number) => new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }).format(value / 100);
  const peakIndex = useMemo(() => data.times.indexOf(Math.max(...data.times)), [data]);
  const peak = hours[peakIndex];
  return <>
    <PageIntro eyebrow={t("eyebrow")} title={t("title")} description={t("description")} action={<label className="period-select-wrap"><CalendarDays size={14} /><select className="select-control period-select" aria-label={t("period")} value={period} onChange={(event) => setPeriod(event.target.value as Period)}>{periods.map((value) => <option key={value} value={value}>{month(value)}</option>)}</select></label>} />
    <section className="metric-grid analytics-metrics" aria-label={t("metrics", {period: month(period)})}>
      <MetricCard label={t("reservations")} value={number.format(data.reservations)} detail={t("thisMonth", {period: month(period)})} change={`+${percent(9.4)}`} icon={<CalendarDays size={15} />} />
      <MetricCard label={t("guests")} value={number.format(data.guests)} detail={t("allBookings")} change={`+${percent(7.8)}`} icon={<UsersRound size={15} />} tone="sage" />
      <MetricCard label={t("avg")} value={number.format(data.average)} detail={t("people")} icon={<BarChart3 size={15} />} tone="gold" />
      <MetricCard label={t("noShowRate")} value={percent(data.rate)} detail={t("reservationCount", {count: number.format(data.noShows)})} icon={<Clock3 size={15} />} tone="stone" />
    </section>
    <section className="analytics-grid">
      <article className="panel chart-panel">
        <PanelHeading title={t("popular")} detail={t("mockDetail")} />
        <div className="chart-body"><div className="chart-axis-note"><span>{t("moreBookings")}</span><span>{t("peak", {time: peak})}</span></div><div className="bar-chart" role="img" aria-label={t("chartLabel", {time: peak})}>
          {data.times.map((value, index) => <div className="bar-group" key={hours[index]}><span className="bar-value">{number.format(value)}</span><div className={`bar${index === peakIndex ? " is-highlight" : ""}`} style={{ height: `${(value / 65) * 100}%` }} /><span className="bar-label">{hours[index]}</span></div>)}
        </div><div className="chart-legend"><span><i className="legend-dot" />{t("reservationLegend")}</span><span><i className="legend-dot dark" />{t("peakLegend")}</span></div></div>
      </article>
      <article className="panel">
        <PanelHeading title={t("sources")} detail={t("sourceShare")} />
        <div className="source-list">{data.sources.map(([key, value]) => <div className="source-item" key={key}><span>{t(key)}</span><div className="source-track"><div className="source-fill" style={{ width: `${value}%` }} /></div><span className="source-value">{percent(value)}</span></div>)}<p className="source-caption">{t("sourceCaption")}</p></div>
      </article>
      <article className="panel noshow-panel">
        <PanelHeading title={t("noShows")} detail={t("withoutArrival")} />
        <div className="noshow-grid"><div className="noshow-stat"><strong>{number.format(data.noShows)}</strong><span>{t("monthlyNoShows")}</span></div><div className="noshow-stat"><strong>{percent(data.rate)}</strong><span>{t("shareReservations")}</span></div></div>
        <p className="noshow-caption">{t("exampleCaption")}</p>
      </article>
      <aside className="analytics-note"><span className="analytics-note-mark">i</span><p><strong>{t("quietHeading")}</strong><br />{t("quietText")}</p></aside>
    </section>
  </>;
}
