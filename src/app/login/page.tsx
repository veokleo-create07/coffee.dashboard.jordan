import { Coffee, MoveRight } from "lucide-react";
import { signIn } from "@/app/login/actions";

type LoginPageProps = { searchParams: Promise<{ error?: string }> };

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <section className="w-full max-w-[420px]">
        <a href="/login" aria-label="Altstadtliebe Team Startseite" className="mx-auto flex w-fit items-center gap-2.5 text-[15px] font-semibold tracking-[-0.04em]">
          <span className="grid size-9 place-items-center rounded-full bg-[#392d24] text-[#f8f4ed]"><Coffee size={17} strokeWidth={1.8} /></span>
          <span>altstadtliebe<span className="font-normal text-[#8b6249]">.</span></span>
        </a>
        <div className="mt-12 rounded-[24px] border border-[var(--line)] bg-[var(--surface)] px-7 py-8 shadow-[0_14px_40px_rgba(57,45,36,0.04)] sm:px-9 sm:py-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.17em] text-[var(--accent)]">Interner Bereich</p>
          <h1 className="mt-3 text-[30px] font-medium leading-tight tracking-[-0.055em]">Schön, dass du da bist.</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Melde dich mit deinem Teamkonto an.</p>
          <form action={signIn} className="mt-8 space-y-5">
            <label className="block"><span className="mb-2 block text-[13px] font-medium">E-Mail-Adresse</span><input name="email" type="email" autoComplete="username" required className="h-12 w-full rounded-xl border border-[var(--line)] bg-white px-3.5 text-sm outline-none transition placeholder:text-[#aaa397] focus:border-[var(--accent)] focus:ring-2 focus:ring-[#8b62491a]" placeholder="name@altstadtliebe.de" /></label>
            <label className="block"><span className="mb-2 block text-[13px] font-medium">Passwort</span><input name="password" type="password" autoComplete="current-password" required className="h-12 w-full rounded-xl border border-[var(--line)] bg-white px-3.5 text-sm outline-none transition placeholder:text-[#aaa397] focus:border-[var(--accent)] focus:ring-2 focus:ring-[#8b62491a]" placeholder="Dein Passwort" /></label>
            {error ? <p role="alert" className="rounded-lg bg-[#f8eeea] px-3 py-2.5 text-sm text-[#8a4435]">{error}</p> : null}
            <button type="submit" className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#392d24] px-4 text-sm font-medium text-white transition hover:bg-[#4b3b30] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]">Anmelden <MoveRight size={16} /></button>
          </form>
          <p className="mt-6 text-center text-xs text-[var(--muted)]">Nur für autorisierte Mitarbeitende.</p>
        </div>
        <p className="mt-6 text-center text-[11px] tracking-wide text-[#a09a8e]">LÜBECK · ALTSTADTLIEBE CAFÉ</p>
      </section>
    </main>
  );
}
