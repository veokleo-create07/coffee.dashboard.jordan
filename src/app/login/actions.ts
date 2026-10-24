"use server";

import { redirect } from "next/navigation";
import { checkStaffMembership } from "@/lib/auth/staff";
import { createClient } from "@/lib/supabase/server";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) redirect("/login?error=Bitte%20E-Mail%20und%20Passwort%20eingeben.");

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
    const message = error?.message === "Invalid API key"
      ? "Anmeldung momentan nicht möglich. Bitte die Supabase-Konfiguration prüfen."
      : error?.code === "email_not_confirmed"
        ? "Bitte bestätige zuerst deine E-Mail-Adresse."
        : "Anmeldung nicht möglich. Bitte E-Mail und Passwort prüfen.";
    redirect(`/login?error=${encodeURIComponent(message)}`);
  }

  const { isStaff, error: membershipError } = await checkStaffMembership(supabase, data.user.id);
  if (membershipError) {
    console.error("Staff login: membership check failed", {
      code: membershipError.code,
      message: membershipError.message,
    });
    await supabase.auth.signOut();
    redirect("/login?error=Teamzugang konnte nicht geprüft werden. Bitte die Dashboard-Konfiguration prüfen.");
  }

  if (!isStaff) {
    await supabase.auth.signOut();
    redirect("/login?error=Dieses%20Konto%20hat%20keinen%20Teamzugang.");
  }

  redirect("/dashboard");
}
