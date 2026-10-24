import { redirect } from "next/navigation";
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

export async function getStaffUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  const { isStaff } = await checkStaffMembership(supabase, user.id);
  if (!isStaff) return null;

  return user;
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
