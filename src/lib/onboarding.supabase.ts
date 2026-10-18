import { supabase } from "@/integrations/supabase/client";

export function profileDate(value: string): string | null {
  if (!value.trim() || /^(actualidad|presente|present|current)$/i.test(value.trim())) return null;
  const normalized = /^\d{4}-\d{2}$/.test(value.trim()) ? `${value.trim()}-01` : value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized) || !Number.isFinite(Date.parse(normalized)) || new Date(normalized).toISOString().slice(0,10) !== normalized) {
    throw new Error("Revisá las fechas de experiencia. Usá el formato AAAA-MM-DD o dejalas vacías.");
  }
  return normalized;
}

export async function saveOnboarding(profile: Record<string, string>, selected: Record<string, string[]>, search: { role: string; location: string }, autoApplyAuthorized: boolean) {
  const { data: auth, error } = await supabase.auth.getUser();
  if (error || !auth.user) return { requiresLogin: true };
  if (!profile['firstName']?.trim() || !profile['lastName']?.trim() || !profile['email']?.trim()) throw new Error("Completá nombre, apellido y email en el paso Tus datos.");
  const payload = {
    confirmed: true, autoApplyAuthorized,
    profile: { ...profile, startDate: profileDate(profile['start'] ?? ""), endDate: profileDate(profile['end'] ?? ""),
      isCurrent: /^(actualidad|presente|present|current)$/i.test(profile['end']?.trim() ?? ""),
      achievementList: (profile['achievements'] ?? "").split(/\n/).map((value) => value.trim()).filter(Boolean) },
    selected,
    roles: [...new Set([search.role.trim(), ...(selected['roles'] ?? [])].filter(Boolean))],
    locations: search.location.trim() ? [search.location.trim()] : [],
    employmentTypes: (selected['employment'] ?? []).map((value) => ({ "Full-time": "full_time", "Part-time": "part_time", Contractor: "contract", Freelance: "freelance" })[value as "Full-time"] ?? value.toLowerCase()),
    seniority: (selected['seniority'] ?? []).map((value) => value.toLowerCase().replace(/\s+/g, "_")),
  };
  const result = await supabase.rpc("save_onboarding_profile", { _data: payload });
  if (result.error) throw new Error(result.error.message);
  return { requiresLogin: false };
}

export async function loadOnboarding() {
  const auth = await supabase.auth.getUser();
  if (!auth.data.user) return null;
  const id = auth.data.user.id;
  const [profile, experience, education, skills, languages, preferences] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", id).maybeSingle(),
    supabase.from("experiences").select("*").eq("user_id", id).order("start_date", { ascending: false }).limit(1),
    supabase.from("educations").select("*").eq("user_id", id).limit(1),
    supabase.from("skills").select("name").eq("user_id", id),
    supabase.from("languages").select("language,level").eq("user_id", id).limit(1),
    supabase.from("job_preferences").select("*").eq("user_id", id).maybeSingle(),
  ]);
  for (const response of [profile, experience, education, skills, languages, preferences]) if (response.error) throw new Error(response.error.message);
  if (!profile.data) return null;
  const p = profile.data, e = experience.data?.[0], d = education.data?.[0], l = languages.data?.[0];
  return {
    profile: { firstName: p.first_name ?? "", lastName: p.last_name ?? "", email: p.email ?? "", phone: p.phone ?? "", city: p.city ?? "", country: p.country ?? "",
      company: e?.company ?? "", role: e?.title ?? p.current_title ?? "", start: e?.start_date ?? "", end: e?.is_current ? "Actualidad" : e?.end_date ?? "", description: e?.description ?? "", achievements: Array.isArray(e?.achievements) ? e.achievements.join("\n") : "",
      institution: d?.institution ?? "", degree: d?.degree ?? "", area: d?.field ?? "", studyDates: "", language: l?.language ?? "", level: l?.level ?? "" },
    skills: skills.data?.map((skill) => skill.name) ?? [], preferences: preferences.data,
  };
}
