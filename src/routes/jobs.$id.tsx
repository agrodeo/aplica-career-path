import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Check, MapPin } from "lucide-react";
import { MatchInfo, SiteHeader } from "@/components/aplica";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  getAutoApplyJob,
  getAutoApplyOverview,
  startAutoApplyBatch,
} from "@/lib/auto-apply.functions";

export const Route = createFileRoute("/jobs/$id")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
    return { user: data.user };
  },
  head: () => ({
    meta: [
      { title: "Trabajo — aplica" },
      {
        name: "description",
        content: "Detalle de una oportunidad Auto Apply compatible con tu perfil.",
      },
      { property: "og:title", content: "Oportunidad — aplica" },
      {
        property: "og:description",
        content: "Revisá el puesto, tu match y el estado real de la postulación.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: JobDetail,
});

function JobDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const fetchJob = useServerFn(getAutoApplyJob);
  const fetchOverview = useServerFn(getAutoApplyOverview);
  const startBatch = useServerFn(startAutoApplyBatch);

  const jobQuery = useQuery({
    queryKey: ["auto-apply-job", id],
    queryFn: () => fetchJob({ data: { jobId: id } }),
  });
  const overviewQuery = useQuery({
    queryKey: ["auto-apply-overview"],
    queryFn: () => fetchOverview(),
  });

  const mutation = useMutation({
    mutationFn: () => startBatch({ data: { jobIds: [id] } }),
    onSuccess: async (result) => {
      if (result.status === "subscription_required") {
        await navigate({ to: "/upgrade" });
        return;
      }
      if (result.status === "answers_required") {
        await navigate({ to: "/jobs" });
        return;
      }
      if (result.batchId) {
        await navigate({ to: "/applying", search: { batch: result.batchId } });
      } else {
        await jobQuery.refetch();
      }
    },
  });

  if (jobQuery.isLoading) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-[900px] px-5 py-16">
          <p className="text-sm text-muted-foreground">Cargando oportunidad…</p>
        </main>
      </div>
    );
  }

  const job = jobQuery.data;
  if (!job) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-[700px] px-5 py-20 text-center">
          <h1 className="text-2xl font-medium">
            Este trabajo ya no está disponible para Auto Apply.
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Puede haber expirado o el formulario dejó de ser compatible.
          </p>
          <Button asChild className="mt-6">
            <Link to="/jobs">Volver a trabajos</Link>
          </Button>
        </main>
      </div>
    );
  }

  const explanation = (job.explanation ?? {}) as {
    matchedSkills?: unknown;
    targetRole?: unknown;
    note?: unknown;
  };
  const matchedSkills = Array.isArray(explanation.matchedSkills)
    ? explanation.matchedSkills.filter(
        (skill): skill is string => typeof skill === "string",
      )
    : [];

  const status = job.applicationStatus;
  const alreadyVerified = status === "verified";
  const inProgress = [
    "queued",
    "preparing",
    "resume_generating",
    "ready",
    "submitting",
    "submitted_unverified",
    "failed_retryable",
    "processing",
  ].includes(status ?? "");
  const subscribed = overviewQuery.data?.subscriptionStatus === "active";
  const missingUserQuestions = job.missingQuestions.filter(
    (question) => !question.answerKey.startsWith("system:"),
  );

  const apply = async () => {
    if (alreadyVerified || inProgress) return;
    if (!job.readyForUser) {
      await navigate({ to: "/jobs" });
      return;
    }
    if (!subscribed) {
      await navigate({ to: "/upgrade" });
      return;
    }
    mutation.mutate();
  };

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-[900px] px-5 py-10 md:py-16">
        <Link
          to="/jobs"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a trabajos
        </Link>

        <div className="mt-10 flex flex-col justify-between gap-7 border-b border-border pb-9 md:flex-row">
          <div className="flex gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-sm font-semibold">
              {initials(job.company)}
            </div>
            <div>
              <h1 className="text-3xl font-medium tracking-normal">{job.title}</h1>
              <p className="mt-1 text-lg">{job.company}</p>
              <p className="mt-2 flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                {[job.location, job.remoteType, job.employmentType]
                  .filter(Boolean)
                  .join(" · ") || "Ubicación no informada"}
              </p>
              {formatSalary(job) && (
                <p className="mt-2 text-sm text-muted-foreground">
                  {formatSalary(job)}
                </p>
              )}
            </div>
          </div>

          <div className="text-left md:text-right">
            <p className="text-3xl font-semibold text-primary">
              {Math.round(job.matchScore ?? 0)}% match
            </p>
            <MatchInfo />
          </div>
        </div>

        <section className="grid gap-10 py-10 md:grid-cols-[1fr_280px]">
          <div>
            <h2 className="text-lg font-medium">Sobre el puesto</h2>
            <div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
              {job.description || "La empresa no publicó una descripción detallada."}
            </div>
          </div>

          <aside>
            <div className="rounded-xl border border-border p-5">
              <h2 className="font-medium">Por qué aparece para vos</h2>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                El match compara tu perfil y esta vacante. No es una probabilidad
                de contratación.
              </p>

              {matchedSkills.length > 0 && (
                <ul className="mt-4 space-y-3">
                  {matchedSkills.slice(0, 8).map((skill) => (
                    <li
                      key={skill}
                      className="flex gap-2 text-sm text-muted-foreground"
                    >
                      <Check className="h-4 w-4 shrink-0 text-success" />
                      {skill}
                    </li>
                  ))}
                </ul>
              )}

              {!job.readyForUser && missingUserQuestions.length > 0 && (
                <p className="mt-5 border-t border-border pt-4 text-xs leading-5 text-caution">
                  Faltan {missingUserQuestions.length}{" "}
                  {missingUserQuestions.length === 1 ? "respuesta" : "respuestas"}{" "}
                  obligatorias. Las podés completar desde la lista de trabajos.
                </p>
              )}

              {alreadyVerified && (
                <p className="mt-5 border-t border-border pt-4 text-xs leading-5 text-success">
                  Esta postulación ya fue enviada y verificada.
                </p>
              )}

              {inProgress && !alreadyVerified && (
                <p className="mt-5 border-t border-border pt-4 text-xs leading-5 text-primary">
                  Esta postulación ya está en proceso.
                </p>
              )}
            </div>

            <Button
              className="mt-4 w-full"
              disabled={mutation.isPending || alreadyVerified || inProgress}
              onClick={() => void apply()}
            >
              {mutation.isPending
                ? "Preparando…"
                : alreadyVerified
                  ? "Ya aplicaste"
                  : inProgress
                    ? "Postulación en curso"
                    : !job.readyForUser
                      ? "Completar respuestas"
                      : subscribed
                        ? "Aplicar a este trabajo"
                        : "Elegir plan para aplicar"}
            </Button>

            {mutation.error && (
              <p className="mt-3 text-xs leading-5 text-destructive">
                {mutation.error.message}
              </p>
            )}
          </aside>
        </section>
      </main>
    </div>
  );
}

function initials(company: string) {
  return (
    company
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "A"
  );
}

function formatSalary(job: {
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
}) {
  if (job.salaryMin == null && job.salaryMax == null) return null;
  const range = [job.salaryMin, job.salaryMax]
    .filter((value): value is number => value != null)
    .map((value) =>
      new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(value),
    )
    .join("–");
  return `${job.salaryCurrency ?? ""} ${range}`.trim();
}
