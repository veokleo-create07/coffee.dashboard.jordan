import { Coffee } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/dashboard/language-switcher";
import { LoginForm } from "@/components/login-form";

type LoginPageProps = { searchParams: Promise<{ error?: string }> };

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams;
  const t = await getTranslations("Login");
  const errorMessage = error && ["missing", "badCredentials", "noStaff", "config", "unconfirmed", "membership"].includes(error) ? t(error as "missing" | "badCredentials" | "noStaff" | "config" | "unconfirmed" | "membership") : null;
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <section className="w-full max-w-[420px]">
        <div className="mb-7 flex justify-center"><LanguageSwitcher /></div>
        <a href="/login" aria-label={t("brandLabel")} className="mx-auto flex w-fit items-center gap-2.5 text-[15px] font-semibold tracking-[-0.04em]">
          <span className="grid size-9 place-items-center rounded-full bg-[#392d24] text-[#f8f4ed]"><Coffee size={17} strokeWidth={1.8} /></span>
          <span>altstadtliebe<span className="font-normal text-[#8b6249]">.</span></span>
        </a>
        <div className="mt-12 rounded-[24px] border border-[var(--line)] bg-[var(--surface)] px-7 py-8 shadow-[0_14px_40px_rgba(57,45,36,0.04)] sm:px-9 sm:py-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.17em] text-[var(--accent)]">{t("internal")}</p>
          <h1 className="mt-3 text-[30px] font-medium leading-tight tracking-[-0.055em]">{t("title")}</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{t("subtitle")}</p>
          <LoginForm labels={{email: t("email"), password: t("password"), emailPlaceholder: t("emailPlaceholder"), passwordPlaceholder: t("passwordPlaceholder"), emailRequired: t("emailRequired"), passwordRequired: t("passwordRequired"), submit: t("submit")}} error={errorMessage} />
          <p className="mt-6 text-center text-xs text-[var(--muted)]">{t("unauthorized")}</p>
        </div>
        <p className="mt-6 text-center text-[11px] tracking-wide text-[#a09a8e]">LÜBECK · ALTSTADTLIEBE CAFÉ</p>
      </section>
    </main>
  );
}
