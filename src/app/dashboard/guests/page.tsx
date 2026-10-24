"use client";

import { useMemo, useState } from "react";
import { Coffee, Mail, Phone, Search, Star, UsersRound } from "lucide-react";
import { PageIntro, PanelHeading } from "@/components/dashboard/primitives";
import { mockGuests, type Guest } from "@/lib/dashboard/mock-data";
import { useLocale, useTranslations } from "next-intl";
import { sampleContentKey } from "@/lib/dashboard/sample-content";

function initials(name: string) { return name.split(/[ &]/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }
const history = [
  { date: "2026-10-24", time: "09:00", guests: 2 },
  { date: "2026-10-11", time: "10:30", guests: 3 },
  { date: "2026-09-27", time: "11:00", guests: 2 },
];

export default function GuestsPage() {
  const t = useTranslations("Guests");
  const c = useTranslations("Common");
  const sample = useTranslations("SampleContent");
  const locale = useLocale();
  const formatDate = (date: string) => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${date}T12:00:00`));
  const lastVisit = (value: string) => value === "Heute" ? t("today") : formatDate(value);
  const sampleText = (value: string) => { const key = sampleContentKey(value); return key ? sample(key) : value; };
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Guest>(mockGuests[0]);
  const guests = useMemo(() => mockGuests.filter((guest) => `${guest.name} ${guest.email} ${guest.phone}`.toLowerCase().includes(query.toLowerCase().trim())), [query]);

  return <>
    <PageIntro eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
    <div className="guests-toolbar"><label className="search-field"><Search size={14} /><input aria-label={t("search")} placeholder={t("searchPlaceholder")} value={query} onChange={(event) => setQuery(event.target.value)} /></label><span className="result-count">{t("visitsResult", {count: new Intl.NumberFormat(locale).format(guests.length)})}</span></div>
    <section className="guests-layout">
      <article className="panel guest-list-panel">
        <PanelHeading title={t("directory")} detail={t("recentFirst")} action={<UsersRound size={15} color="#9a8c7b" />} />
        <div className="table-wrap"><table className="data-table guest-directory-table"><thead><tr><th>{t("guest")}</th><th>{t("visitCount")}</th><th>{t("lastHere")}</th><th>{t("favoriteOrder")}</th></tr></thead><tbody>
          {guests.map((guest) => <tr key={guest.email} onClick={() => setSelected(guest)} className={`guest-table-row${guest.email === selected.email ? " is-selected" : ""}`}>
            <td><span className="guest-directory-name"><span className="avatar">{initials(guest.name)}</span><span><span className="guest-primary">{guest.name}</span><span className="guest-secondary">{guest.email}</span></span></span></td>
            <td>{new Intl.NumberFormat(locale).format(guest.visits)} <span className="source-tag">{t("visits")}</span></td><td>{lastVisit(guest.lastVisit)}</td><td><span className="favorite-cell"><Coffee size={12} />{sampleText(guest.favorite)}</span></td>
          </tr>)}
        </tbody></table>{!guests.length ? <div className="empty-search">{t("empty")}</div> : null}</div>
      </article>

      <aside className="panel guest-profile" aria-live="polite">
        <div className="profile-header"><span className="avatar-large">{initials(selected.name)}</span><div><h2 className="profile-name">{selected.name}</h2><p className="profile-subtitle">{t("since")}</p></div><span className="guest-star"><Star size={15} /></span></div>
        <div className="profile-stats"><div className="profile-stat"><strong>{new Intl.NumberFormat(locale).format(selected.visits)}</strong><span>{t("visitsTotal")}</span></div><div className="profile-stat"><strong>{lastVisit(selected.lastVisit)}</strong><span>{t("lastVisitLabel")}</span></div></div>
        <section className="profile-section"><h3 className="profile-section-title">{t("contact")}</h3><a className="contact-line" href={`mailto:${selected.email}`}><Mail size={14} />{selected.email}</a><a className="contact-line" href={`tel:${selected.phone.replaceAll(" ", "")}`}><Phone size={14} />{selected.phone}</a></section>
        <section className="profile-section"><h3 className="profile-section-title">{t("requests")}</h3><div className="profile-note">{sampleText(selected.note)}</div><div className="favorite-note"><Coffee size={13} /> {t("mostOrdered")} <strong>{sampleText(selected.favorite)}</strong></div></section>
        <section className="profile-section"><h3 className="profile-section-title">{t("history")}</h3><div className="visit-history">{history.map((visit) => <div className="visit-item" key={`${selected.email}-${visit.date}`}><div><div className="visit-date">{formatDate(visit.date)}</div><div className="visit-time">{visit.time} {c("hours")} · {t("table")} 04</div></div><span className="visit-guests">{visit.guests} {c("personShort")}</span></div>)}</div><p className="history-caption">{t("historyNote")}</p></section>
      </aside>
    </section>
    <div className="mock-data-notice">{t("notice")}</div>
  </>;
}
