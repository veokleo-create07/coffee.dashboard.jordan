import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function getStaffUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  const { data: membership, error: membershipError } = await supabase
    .from("staff_members")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError || !membership) return null;

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
