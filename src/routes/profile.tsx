import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronRight, FileText, ShieldCheck, Sparkles } from "lucide-react";
import { PageShell, SiteHeader } from "@/components/aplica";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getMasterProfile } from "@/lib/master-profile.functions";

export const Route = createFileRoute("/profile")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
    return { user: data.user };
  },
  head: () => ({
    meta: [
      { title: "Tu perfil — aplica" },
      { name: "description", content: "Mantené actualizada la información usada en tus aplicaciones." },
      { property: "og:title", content: "Tu perfil — aplica" },
      { property: "og:description", content: "Tu experiencia y preferencias en un solo lugar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Profile,
});

function Profile() {
  const fetchProfile = useServerFn(getMasterProfile);
  const { data, isLoading, error } = useQuery({
    queryKey: ["master-profile"],
    queryFn: () => fetchProfile(),
  });

  if (isLoading) {
    return <div className="min-h-screen"><SiteHeader /><PageShell className="max-w-[900px]"><p className="text-sm text-muted-foreground">Cargando tu perfil…</p></PageShell></div>;
  }

  if (error || !data) {
    return <div className="min-h-screen"><SiteHeader /><PageShell className="max-w-[900px]"><p className="text-sm text-destructive">No pudimos cargar tu perfil.</p></PageShell></div>;
  }

  const name = [data.identity.firstName, data.identity.lastName].filter(Boolean).join(" ") || "Tu perfil";
  const initials = [data.identity.firstName, data.identity.lastName]
    .filter(Boolean)
    .slice(0, 2)
    .map((value) => value[0]?.toUpperCase())
    .join("") || "A";

  const authorizationAnswers = data.verifiedApplicationAnswers.filter((answer) =>
    ["work_authorization", "sponsorship"].includes(answer.canonicalKey),
  ).length;

  const preferenceText = [
    data.preferences.targetRoles.slice(0, 2).join(", "),
    [
      data.preferences.remoteAllowed ? "Remoto" : null,
      data.preferences.hybridAllowed ? "Híbrido" : null,
      data.preferences.onsiteAllowed ? "Presencial" : null,
    ].filter(Boolean).join(" / "),
  ].filter(Boolean).join(" · ");

  const salaryText = data.preferences.minimumSalary
    ? `Desde ${data.preferences.salaryCurrency ?? ""} ${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(data.preferences.minimumSalary)}${data.preferences.salaryPeriod ? ` / ${data.preferences.salaryPeriod.toLowerCase()}` : ""}`
    : "Sin filtro de salario";

  const resumeFactCount = data.facts.length;
  const resultCount = data.careerContext.results.length;
  const toolCount = data.careerContext.tools.length;
  const preferenceSignalCount =
    data.careerContext.preferredTasks.length +
    data.careerContext.avoidTasks.length;
  const voice = {
    direct: "Directo",
    ambitious: "Ambicioso",
    technical: "Técnico",
    balanced: "Equilibrado",
  }[data.writingPreferences.voice] ?? "Equilibrado";

  const sections = [
    ["Datos personales", [data.identity.email, data.identity.phone, [data.identity.city, data.identity.country].filter(Boolean).join(", ")].filter(Boolean).join(" · ") || "Incompleto"],
    ["CV base", data.baseResumePath ? filename(data.baseResumePath) : "No cargado"],
    ["Experiencia", `${data.experience.length} ${data.experience.length === 1 ? "puesto" : "puestos"}`],
    ["Estudios", `${data.education.length} ${data.education.length === 1 ? "estudio" : "estudios"}`],
    ["Habilidades", data.skills.length ? data.skills.slice(0, 5).map((skill) => skill.name).join(", ") + (data.skills.length > 5 ? ` y ${data.skills.length - 5} más` : "") : "Sin habilidades guardadas"],
    ["Idiomas", data.languages.length ? data.languages.map((language) => `${language.language} · ${language.level}`).join(" · ") : "Sin idiomas guardados"],
    ["Preferencias laborales", preferenceText || "Incompletas"],
    ["Salario", salaryText],
    ["Career Profile", `${resumeFactCount} hechos utilizables en CV · ${resultCount} resultados · ${toolCount} herramientas`],
    ["Qué querés hacer más", data.careerContext.preferredTasks.length ? data.careerContext.preferredTasks.slice(0, 4).join(", ") : "Todavía no definido"],
    ["Qué preferís evitar", data.careerContext.avoidTasks.length ? data.careerContext.avoidTasks.slice(0, 4).join(", ") : "Todavía no definido"],
    ["Cómo te presenta la IA", [voice, ...data.writingPreferences.emphasis.slice(0, 3)].filter(Boolean).join(" · ")],
    ["Autorización laboral", `${authorizationAnswers} de 2 respuestas guardadas`],
  ] as const;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <PageShell className="max-w-[900px]">
        <div className="flex items-center justify-between gap-6">
          <div>
            <p className="text-sm text-muted-foreground">Perfil de</p>
            <h1 className="mt-1 text-3xl font-medium tracking-normal">{name}</h1>
          </div>
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-foreground font-medium text-background">{initials}</div>
        </div>

        <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4">
          <ProfileStat label="Hechos confirmados" value={String(resumeFactCount)} />
          <ProfileStat label="Resultados" value={String(resultCount)} />
          <ProfileStat label="Herramientas" value={String(toolCount)} />
          <ProfileStat label="Señales de preferencia" value={String(preferenceSignalCount)} />
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-border bg-surface p-5">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="h-4 w-4 text-primary" />
              Contexto para adaptar cada CV
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Aplica puede cambiar redacción, orden y énfasis según la vacante usando este Career Profile.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-5">
            <p className="flex items-center gap-2 text-sm font-medium">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Sin inventar experiencia
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Los bullets generados sólo se aceptan cuando están respaldados por hechos confirmados de tu perfil.
            </p>
          </div>
        </div>

        <div className="mt-8 border-t border-border">
          {sections.map(([title, value]) => (
            <Link
              key={title}
              to="/onboarding"
              className="flex w-full items-center justify-between border-b border-border py-5 text-left"
            >
              <span>
                <span className="block text-sm font-medium">{title}</span>
                <span className="mt-1 block text-sm text-muted-foreground">{value}</span>
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          ))}
        </div>

        <div className="mt-8 flex items-center gap-3 rounded-lg bg-surface p-4">
          <FileText className="text-primary" />
          <p className="flex-1 text-sm">
            Aplica sólo usa datos confirmados de este perfil para adaptar CVs y completar postulaciones.
          </p>
          <Button asChild size="sm" variant="outline">
            <Link to="/onboarding">Editar</Link>
          </Button>
        </div>

        <Button asChild variant="outline" className="mt-8">
          <Link to="/settings">Privacidad y configuración</Link>
        </Button>
      </PageShell>
    </div>
  );
}

function ProfileStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-background p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-medium">{value}</p>
    </div>
  );
}

function filename(path: string) {
  const raw = path.split("/").pop() ?? path;
  return raw.replace(/^[0-9a-f-]{20,}-/i, "");
}
