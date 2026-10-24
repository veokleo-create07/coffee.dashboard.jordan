"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

export function LanguageSwitcher() {
  const locale = useLocale();
  const t = useTranslations("Common");
  const router = useRouter();
  function select(next: "de" | "en") {
    document.cookie = `AL_LOCALE=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    router.refresh();
  }
  return <div className="language-switcher" role="group" aria-label={t("language")}>
    <button type="button" aria-pressed={locale === "de"} className={locale === "de" ? "is-active" : ""} onClick={() => select("de")}>DE</button>
    <span aria-hidden="true" />
    <button type="button" aria-pressed={locale === "en"} className={locale === "en" ? "is-active" : ""} onClick={() => select("en")}>EN</button>
  </div>;
}
