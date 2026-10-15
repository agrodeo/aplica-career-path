import { supabase } from "@/integrations/supabase/client";

async function adminUserId() {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error("Sesión no válida.");
  const { data: role } = await supabase.from("user_roles").select("role").eq("user_id", auth.user.id).eq("role", "admin").maybeSingle();
  if (!role) throw new Error("Forbidden");
  return auth.user.id;
}

export async function requestInspection({ data }: { data: { url: string; mode: "inspect" | "dry_run" } }) {
  const userId = await adminUserId();
  const parsed = new URL(data.url);
  if (!["http:","https:"].includes(parsed.protocol)) throw new Error("La URL debe ser http o https.");
  const { data: row, error } = await supabase.from("adapter_inspections")
    .insert({ requested_by: userId, url: parsed.toString(), mode: data.mode })
    .select("id").single();
  if (error) throw new Error(error.message);
  return { id: row.id };
}

export async function listInspections() {
  await adminUserId();
  const { data, error } = await supabase.from("adapter_inspections").select("*").order("created_at",{ascending:false}).limit(15);
  if (error) throw new Error(error.message);
  return data ?? [];
}
