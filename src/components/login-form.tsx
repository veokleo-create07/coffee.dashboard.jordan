"use client";

import { MoveRight } from "lucide-react";
import { signIn } from "@/app/login/actions";

export function LoginForm({ labels, error }: { labels: { email: string; password: string; emailPlaceholder: string; passwordPlaceholder: string; emailRequired: string; passwordRequired: string; submit: string }; error?: string | null }) {
  return <form action={signIn} className="mt-8 space-y-5">
    <label className="block"><span className="mb-2 block text-[13px] font-medium">{labels.email}</span><input name="email" type="email" autoComplete="username" required onInvalid={(event) => event.currentTarget.setCustomValidity(labels.emailRequired)} onInput={(event) => event.currentTarget.setCustomValidity("")} className="h-12 w-full rounded-xl border border-[var(--line)] bg-white px-3.5 text-sm outline-none transition placeholder:text-[#aaa397] focus:border-[var(--accent)] focus:ring-2 focus:ring-[#8b62491a]" placeholder={labels.emailPlaceholder} /></label>
    <label className="block"><span className="mb-2 block text-[13px] font-medium">{labels.password}</span><input name="password" type="password" autoComplete="current-password" required onInvalid={(event) => event.currentTarget.setCustomValidity(labels.passwordRequired)} onInput={(event) => event.currentTarget.setCustomValidity("")} className="h-12 w-full rounded-xl border border-[var(--line)] bg-white px-3.5 text-sm outline-none transition placeholder:text-[#aaa397] focus:border-[var(--accent)] focus:ring-2 focus:ring-[#8b62491a]" placeholder={labels.passwordPlaceholder} /></label>
    {error ? <p role="alert" className="rounded-lg bg-[#f8eeea] px-3 py-2.5 text-sm text-[#8a4435]">{error}</p> : null}
    <button type="submit" className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#392d24] px-4 text-sm font-medium text-white transition hover:bg-[#4b3b30] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]">{labels.submit} <MoveRight size={16} /></button>
  </form>;
}
