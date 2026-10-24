"use server";

import { redirect } from "next/navigation";
import { getStaffUser } from "@/lib/auth/staff";
import { createClient } from "@/lib/supabase/server";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) redirect("/login?error=Bitte%20E-Mail%20und%20Passwort%20eingeben.");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) redirect("/login?error=Anmeldung%20nicht%20m%C3%B6glich.%20Bitte%20Zugangsdaten%20pr%C3%BCfen.");
  const staffUser = await getStaffUser();
  if (!staffUser) {
    await supabase.auth.signOut();
    redirect("/login?error=Dieses%20Konto%20hat%20keinen%20Teamzugang.");
  }
  redirect("/dashboard");
}
