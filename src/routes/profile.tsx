import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageShell, SiteHeader } from "@/components/aplica";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAplica } from "@/lib/aplica-store";
export const Route = createFileRoute("/profile")({ component: Profile });
function Profile() {
  const { setOnboardingStep } = useAplica();
  const query = useQuery({ queryKey: ["career-profile"], queryFn: async () => {
    const auth = await supabase.auth.getUser();
    if (auth.error || !auth.data.user) throw new Error("Ingresá para consultar tu perfil.");
    const id = auth.data.user.id;
    const responses = await Promise.all([
      supabase.from("profiles").select("first_name,last_name,email,current_title,city,country").eq("user_id", id).maybeSingle(),
      supabase.from("experiences").select("id", { count: "exact", head: true }).eq("user_id", id),
      supabase.from("educations").select("id", { count: "exact", head: true }).eq("user_id", id),
      supabase.from("skills").select("name").eq("user_id", id),
    ]);
    for (const response of responses) if (response.error) throw new Error(response.error.message);
    return { profile: responses[0].data, experience: responses[1].count, education: responses[2].count, skills: responses[3].data };
  } });
  const profile = query.data?.profile;
  return <div className="min-h-screen"><SiteHeader /><PageShell className="max-w-[900px]">
    <h1 className="text-3xl font-medium">Tu perfil</h1>
    {query.isPending ? <p role="status">Cargando tu información…</p> : query.error ? <p role="alert">{query.error.message}</p> : profile ? <div className="mt-8 space-y-4">
      <p>{[profile.first_name, profile.last_name].filter(Boolean).join(" ")}</p><p>{profile.email}</p><p>{profile.current_title}</p><p>{[profile.city, profile.country].filter(Boolean).join(", ")}</p>
      <p>{query.data?.experience ?? 0} experiencias · {query.data?.education ?? 0} estudios</p>
      <p>{query.data?.skills?.map((skill) => skill.name).join(", ") || "Sin habilidades guardadas"}</p>
    </div> : <p className="mt-6">Completá tu perfil para preparar postulaciones con información real.</p>}
    <Button asChild className="mt-8"><Link to="/onboarding" onClick={() => setOnboardingStep(3)}>Revisar y editar perfil</Link></Button>
  </PageShell></div>;
}
