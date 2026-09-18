import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUpDown, BriefcaseBusiness, Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { MatchInfo, PageShell, SiteHeader } from "@/components/aplica";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import {
  getAutoApplyOverview,
  listAutoApplyJobs,
  startAutoApplyBatch,
} from "@/lib/auto-apply.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/jobs")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
    return { user: data.user };
  },
  head: () => ({
    meta: [
      { title: "Trabajos para vos — aplica" },
      { name: "description", content: "Oportunidades ordenadas según tu experiencia y preferencias." },
      { property: "og:title", content: "Trabajos para vos — aplica" },
      { property: "og:description", content: "Encontrá oportunidades que encajan con tu perfil." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: JobsPage,
});

function JobsPage() {
  const navigate = useNavigate();
  const fetchJobs = useServerFn(listAutoApplyJobs);
  const fetchOverview = useServerFn(getAutoApplyOverview);
  const startBatch = useServerFn(startAutoApplyBatch);

  const jobsQuery = useQuery({
    queryKey: ["auto-apply-jobs"],
    queryFn: () => fetchJobs(),
  });
  const overviewQuery = useQuery({
    queryKey: ["auto-apply-overview"],
    queryFn: () => fetchOverview(),
  });

  const jobs = jobsQuery.data?.jobs ?? [];
  const subscribed = overviewQuery.data?.subscriptionStatus === "active";
  const [query, setQuery] = useState("");
  const [min, setMin] = useState(70);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobs.length) return;
    setSelected((current) => {
      if (current.size) return current;
      return new Set(jobs.map((job) => job.id));
    });
  }, [jobs]);

  const filtered = useMemo(
    () =>
      jobs
        .filter(
          (job) =>
            (job.matchScore ?? 0) >= min &&
            `${job.title} ${job.company} ${job.location ?? ""}`
              .toLowerCase()
              .includes(query.toLowerCase()),
        )
        .sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0)),
    [jobs, query, min],
  );

  const selectedIds = jobs
    .filter((job) => selected.has(job.id))
    .map((job) => job.id);

  const mutation = useMutation({
    mutationFn: () => startBatch({ data: { jobIds: selectedIds } }),
    onSuccess: async (result) => {
      setActionError(null);
      if (result.status === "subscription_required") {
        await navigate({ to: "/upgrade" });
        return;
      }
      if (result.status === "consent_required") {
        setActionError("Necesitamos tu autorización de Auto Apply. Revisá el último paso de tu perfil.");
        return;
      }
      if (result.batchId) {
        await navigate({ to: "/applying", search: { batch: result.batchId } });
      }
    },
    onError: (error: Error) => setActionError(error.message),
  });

  const toggle = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectVisible = () => {
    setSelected((current) => {
      const next = new Set(current);
      for (const job of filtered) next.add(job.id);
      return next;
    });
  };

  const loading = jobsQuery.isLoading || overviewQuery.isLoading;
  const serverMinimum = jobsQuery.data?.minimumMatchScore ?? 70;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <PageShell className="pb-32">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-medium text-primary">Selección calculada con tu perfil real</p>
            <h1 className="mt-2 text-3xl font-medium tracking-normal md:text-[40px]">
              {loading ? "Buscando trabajos…" : `${jobs.length} trabajos listos para aplicar`}
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Sólo mostramos vacantes Auto Apply con match ≥ {serverMinimum}%. El porcentaje compara perfil y vacante; no estima tus chances de contratación.
            </p>
          </div>
          <MatchInfo />
        </div>

        <div className="mt-9 flex flex-col gap-3 border-y border-border py-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-10"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Puesto, empresa o ubicación"
            />
          </div>
          <Button variant="outline" onClick={() => setMin(min === 70 ? 80 : 70)}>
            <SlidersHorizontal />
            Match mínimo: {min}%
          </Button>
          <Button variant="outline" disabled>
            <ArrowUpDown />
            Mejor match
          </Button>
        </div>

        {subscribed && jobs.length > 0 && (
          <div className="mt-7 flex items-center justify-between gap-4 rounded-lg bg-surface p-4">
            <div>
              <p className="text-sm font-medium">Elegí dónde querés aplicar</p>
              <p className="mt-1 text-xs text-muted-foreground">Aplica sólo enviará las vacantes que queden seleccionadas.</p>
            </div>
            <Button variant="outline" size="sm" onClick={selectVisible}>Seleccionar visibles</Button>
          </div>
        )}

        {actionError && <p className="mt-5 rounded-lg border border-destructive/20 p-4 text-sm text-destructive">{actionError}</p>}
        {jobsQuery.error && <p className="mt-5 rounded-lg border border-destructive/20 p-4 text-sm text-destructive">No pudimos cargar tus trabajos: {jobsQuery.error.message}</p>}

        <div className="mt-4">
          {loading ? (
            <div className="py-24 text-center text-sm text-muted-foreground">Calculando tu selección…</div>
          ) : filtered.length ? (
            filtered.map((job) => (
              <RealJobRow
                key={job.id}
                job={job}
                selectable={subscribed}
                selected={selected.has(job.id)}
                onToggle={() => toggle(job.id)}
              />
            ))
          ) : (
            <div className="py-24 text-center">
              <BriefcaseBusiness className="mx-auto h-8 w-8 text-muted-foreground" />
              <h2 className="mt-5 text-xl font-medium">Todavía no hay suficientes trabajos que encajen con tus criterios.</h2>
              <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
                Puede ser porque el inventario Auto Apply todavía es chico o porque tus filtros son estrictos. Nunca inventamos un número de oportunidades.
              </p>
              <Button className="mt-6" variant="outline" onClick={() => { setMin(70); setQuery(""); }}>
                Mostrar todos los matches disponibles
              </Button>
            </div>
          )}
        </div>
      </PageShell>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-5 py-3 md:px-8">
          <div>
            <p className="text-sm font-medium">
              {subscribed ? selectedIds.length : jobs.length} trabajos {subscribed ? "seleccionados" : "listos para aplicar"}
            </p>
            <p className="hidden text-xs text-muted-foreground sm:block">
              CV específico por puesto · respuestas verificadas
            </p>
          </div>
          <Button
            disabled={loading || (subscribed && selectedIds.length === 0) || mutation.isPending}
            onClick={() => {
              if (!subscribed) {
                void navigate({ to: "/upgrade" });
                return;
              }
              mutation.mutate();
            }}
          >
            {mutation.isPending
              ? "Preparando tanda…"
              : subscribed
                ? `Aplicar a ${selectedIds.length}`
                : `Aplicar a ${jobs.length} trabajos`}
          </Button>
        </div>
      </div>
    </div>
  );
}

type RealJob = NonNullable<Awaited<ReturnType<ReturnType<typeof useServerFn<typeof listAutoApplyJobs>>>>["jobs"]>[number];

function RealJobRow({
  job,
  selectable,
  selected,
  onToggle,
}: {
  job: RealJob;
  selectable: boolean;
  selected: boolean;
  onToggle: () => void;
}) {
  const explanation = (job.explanation ?? {}) as { matchedSkills?: unknown; note?: unknown };
  const matchedSkills = Array.isArray(explanation.matchedSkills)
    ? explanation.matchedSkills.filter((skill): skill is string => typeof skill === "string")
    : [];

  return (
    <article className={cn("grid gap-4 border-t border-border py-6 first:border-t-0 md:grid-cols-[1fr_auto] md:gap-8", selectable && selected && "bg-selected -mx-3 rounded-lg px-3")}>
      <div className="flex min-w-0 gap-4">
        {selectable ? (
          <Checkbox checked={selected} onCheckedChange={onToggle} aria-label={`Seleccionar ${job.title} en ${job.company}`} className="mt-2 h-5 w-5" />
        ) : (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-xs font-semibold">
            {initials(job.company)}
          </div>
        )}
        <div className="min-w-0">
          <h2 className="text-lg font-medium">{job.title}</h2>
          <p className="mt-0.5 text-sm text-foreground">{job.company}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {[job.location, job.remoteType, job.employmentType].filter(Boolean).join(" · ") || "Ubicación no informada"}
          </p>
          {formatSalary(job) && <p className="mt-1 text-xs text-muted-foreground">{formatSalary(job)}</p>}
          {matchedSkills.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
              {matchedSkills.slice(0, 5).map((skill) => (
                <span key={skill} className="text-xs text-muted-foreground">
                  <span className="mr-1 text-success">✓</span>{skill}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 pl-9 md:w-40 md:flex-col md:items-end md:justify-start md:pl-0">
        <div className="text-right">
          <div className="text-xl font-semibold text-primary">{Math.round(job.matchScore ?? 0)}% <span className="text-sm font-medium">match</span></div>
          <div className="mt-0.5 text-xs text-muted-foreground">perfil ↔ vacante</div>
        </div>
      </div>
    </article>
  );
}

function initials(company: string) {
  return company
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "A";
}

function formatSalary(job: { salaryMin: number | null; salaryMax: number | null; salaryCurrency: string | null }) {
  if (job.salaryMin == null && job.salaryMax == null) return null;
  const range = [job.salaryMin, job.salaryMax]
    .filter((value): value is number => value != null)
    .map((value) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(value))
    .join("–");
  return `${job.salaryCurrency ?? ""} ${range}`.trim();
}
