import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export async function checkStaffMembership(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const { data, error } = await supabase
    .from("staff_members")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  return { isStaff: Boolean(data) && !error, error };
}

export const getAuthenticatedContext = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims?.sub) return null;

  return {
    supabase,
    user: {
      id: data.claims.sub,
      email: typeof data.claims.email === "string" ? data.claims.email : null,
    },
  };
});

export const getStaffContext = cache(async () => {
  const authenticated = await getAuthenticatedContext();
  if (!authenticated) return null;

  const { isStaff } = await checkStaffMembership(authenticated.supabase, authenticated.user.id);
  if (!isStaff) return null;

  return authenticated;
});

export async function getStaffUser() {
  return (await getStaffContext())?.user ?? null;
}

export async function requireStaff() {
  const user = await getStaffUser();

  if (!user) {
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  return user;
}
