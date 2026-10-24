"use client";

import { BarChart3 } from "lucide-react";
import { PageIntro } from "@/components/dashboard/primitives";
import { useTranslations } from "next-intl";

export default function AnalyticsPage() {
  const t = useTranslations("Analytics");
  return <>
    <PageIntro eyebrow="" title={t("title")} description={t("description")} />
    <section className="panel analytics-unavailable" aria-live="polite">
      <span className="analytics-placeholder-icon"><BarChart3 size={18} /></span>
      <h2>{t("liveSetupTitle")}</h2>
      <p>{t("liveSetupDescription")}</p>
    </section>
  </>;
}
