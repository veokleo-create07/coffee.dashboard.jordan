import type { ReactNode } from "react";
import Link from "next/link";
import { ChartNoAxesColumn, Coffee, LayoutDashboard, LogOut, UsersRound, Utensils } from "lucide-react";
import { requireStaff } from "@/lib/auth/staff";
import { signOut } from "@/app/dashboard/actions";

const navigation = [
  { label: "Übersicht", href: "/dashboard", icon: LayoutDashboard },
  { label: "Reservierungen", href: "/dashboard/reservations", icon: Utensils },
  { label: "Gäste", href: "/dashboard/guests", icon: UsersRound },
  { label: "Analysen", href: "/dashboard/analytics", icon: ChartNoAxesColumn },
];

export default async function DashboardLayout({ children }: Readonly<{ children: ReactNode }>) {
  const user = await requireStaff();

  return (
    <div className="min-h-screen md:grid md:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="border-b border-[var(--line)] bg-[#f2efe8] px-5 py-4 md:flex md:min-h-screen md:flex-col md:border-b-0 md:border-r md:px-5 md:py-7">
        <Link href="/dashboard" className="flex items-center gap-2.5 text-[15px] font-semibold tracking-[-0.04em]"><span className="grid size-9 place-items-center rounded-full bg-[#392d24] text-[#f8f4ed]"><Coffee size={17} strokeWidth={1.8} /></span><span>altstadtliebe<span className="font-normal text-[var(--accent)]">.</span></span></Link>
        <div className="mt-8 flex gap-1 overflow-x-auto pb-1 md:mt-12 md:flex-col md:overflow-visible">
          <p className="mb-2 hidden px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9a9387] md:block">Arbeitsbereich</p>
          {navigation.map(({ label, href, icon: Icon }, index) => index === 0 ? <Link key={href} href={href} aria-current="page" className="flex shrink-0 items-center gap-3 rounded-xl bg-white px-3 py-2.5 text-[13px] text-[#392d24] shadow-[0_1px_2px_rgba(57,45,36,0.06)]"><Icon size={17} strokeWidth={1.7} />{label}</Link> : <div key={href} aria-disabled="true" className="flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] text-[#8e887e]"><Icon size={17} strokeWidth={1.7} />{label}<span className="ml-auto hidden rounded-full bg-[#e9e5dc] px-2 py-0.5 text-[9px] text-[#8a8378] md:inline">In Kürze</span></div>)}
        </div>
        <div className="mt-auto hidden border-t border-[#e2ded5] pt-5 md:block"><p className="truncate px-3 text-xs text-[#777165]">{user.email}</p><form action={signOut} className="mt-3"><button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] text-[#847e73] hover:bg-white/60"><LogOut size={16} /> Abmelden</button></form></div>
      </aside>
      <div className="min-w-0"><header className="flex h-[62px] items-center justify-between border-b border-[var(--line)] bg-[#faf9f5] px-5 sm:px-8"><p className="text-xs text-[#827b70]">Altstadtliebe <span className="px-1.5 text-[#c1bbb0]">/</span> Team</p><form action={signOut} className="md:hidden"><button aria-label="Abmelden" className="rounded-lg p-2 text-[#827b70] hover:bg-[#efebe3]"><LogOut size={17} /></button></form><p className="hidden text-xs text-[#827b70] md:block">{user.email}</p></header><main className="mx-auto w-full max-w-[1180px] px-5 py-8 sm:px-8 sm:py-10">{children}</main></div>
    </div>
  );
}
