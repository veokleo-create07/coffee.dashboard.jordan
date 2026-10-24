"use server";

import { redirect } from "next/navigation";
import { checkStaffMembership } from "@/lib/auth/staff";
import { createClient } from "@/lib/supabase/server";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) redirect("/login?error=missing");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    if (error) {
      console.error("Staff login: Supabase sign-in failed", {
        status: error.status,
        code: error.code ?? null,
        message: error.message,
      });
    }
    const code = error?.message === "Invalid API key" ? "config" : error?.code === "email_not_confirmed" ? "unconfirmed" : "badCredentials";
    redirect(`/login?error=${code}`);
  }

  const { isStaff, error: membershipError } = await checkStaffMembership(supabase, data.user.id);
  if (membershipError) {
    console.error("Staff login: membership check failed", {
      code: membershipError.code,
      message: membershipError.message,
    });
    await supabase.auth.signOut();
    redirect("/login?error=membership");
  }

  if (!isStaff) {
    await supabase.auth.signOut();
    redirect("/login?error=noStaff");
  }

  redirect("/dashboard");
}
