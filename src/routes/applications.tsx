import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, CheckCircle2, FileText, Image as ImageIcon } from "lucide-react";
import { useState } from "react";
import { PageShell, SiteHeader } from "@/components/aplica";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { listMyApplications } from "@/lib/auto-apply.functions";
import { getApplicationSnapshot } from "@/lib/inspections.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/applications")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
    return { user: data.user };
  },
  head: () => ({
    meta: [
      { title: "Tus aplicaciones — aplica" },
      { name: "description", content: "Seguimiento claro de todas tus postulaciones." },
      { property: "og:title", content: "Tus aplicaciones — aplica" },
      { property: "og:description", content: "Revisá el estado real de cada postulación." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Applications,
});

const filters = ["Todas", "Enviadas", "Procesando", "Necesitan atención", "Sin enviar"] as const;

function Applications() {
  const [filter, setFilter] = useState<(typeof filters)[number]>("Todas");
  const fetchApplications = useServerFn(listMyApplications);
  const { data = [], isLoading, error } = useQuery({
    queryKey: ["my-applications"],
    queryFn: () => fetchApplications(),
  });

  const filtered = data.filter((application) => {
    if (filter === "Todas") return true;
    if (filter === "Enviadas") return application.status === "verified";
    if (filter === "Procesando") {
      return ["queued", "preparing", "resume_generating", "ready", "submitting", "submitted_unverified", "failed_retryable"].includes(application.status);
    }
    if (filter === "Necesitan atención") return application.status === "failed_permanent";
    return ["expired", "duplicate", "unsupported"].includes(application.status);
  });

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <PageShell>
        <h1 className="text-3xl font-medium tracking-normal md:text-[40px]">Tus aplicaciones</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Cada estado refleja lo que realmente pasó. “Enviada” sólo aparece después de verificar el envío.
        </p>

        <div className="mt-8 flex gap-2 overflow-x-auto border-b border-border pb-3">
          {filters.map((value) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={cn(
                "whitespace-nowrap rounded-full px-3 py-2 text-sm",
                filter === value
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {value}
            </button>
          ))}
        </div>

        {isLoading && <p className="py-16 text-center text-sm text-muted-foreground">Cargando tus postulaciones…</p>}
        {error && <p className="mt-6 rounded-lg border border-destructive/20 p-4 text-sm text-destructive">No pudimos cargar tus aplicaciones: {error.message}</p>}

        <div>
          {filtered.map((application) => (
            <ApplicationRow key={application.id} application={application} />
          ))}
          {!isLoading && !error && !filtered.length && (
            <p className="py-16 text-center text-sm text-muted-foreground">
              No hay postulaciones en esta categoría.
            </p>
          )}
        </div>
      </PageShell>
    </div>
  );
}

type ApplicationItem = Awaited<ReturnType<ReturnType<typeof useServerFn<typeof listMyApplications>>>>[number];

function ApplicationRow({ application }: { application: ApplicationItem }) {
  const [open, setOpen] = useState(false);
  const fetchSnapshot = useServerFn(getApplicationSnapshot);
  const snapshotQuery = useQuery({
    queryKey: ["application-snapshot", application.id],
    queryFn: () => fetchSnapshot({ data: { attemptId: application.id } }),
    enabled: open && application.status === "verified",
  });

  return (
    <article className="border-b border-border py-5">
      <div className="grid gap-4 md:grid-cols-[1fr_190px_150px] md:items-center">
        <div className="flex gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-xs font-semibold">
            {initials(application.company)}
          </div>
          <div>
            <h2 className="font-medium">{application.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {application.company}{application.adapter ? ` · ${application.adapter}` : ""}
            </p>
          </div>
        </div>

        <Status value={application.status} />

        <div className="md:text-right">
          {application.status === "verified" ? (
            <Button size="sm" variant="outline" onClick={() => setOpen((value) => !value)}>
              {open ? "Ocultar" : "Ver lo enviado"}
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">
              {application.submittedAt ? new Date(application.submittedAt).toLocaleDateString("es-AR") : "—"}
            </span>
          )}
        </div>
      </div>

      {open && application.status === "verified" && (
        <div className="mt-4 ml-14 rounded-lg border border-border bg-surface p-4">
          {snapshotQuery.isLoading && <p className="text-sm text-muted-foreground">Cargando evidencia…</p>}
          {snapshotQuery.error && <p className="text-sm text-destructive">{snapshotQuery.error.message}</p>}
          {snapshotQuery.data && (
            <div className="space-y-3">
              <p className="text-sm font-medium">Lo que Aplica envió</p>
              <div className="flex flex-wrap gap-2">
                {snapshotQuery.data.resumeUrl && (
                  <Button asChild size="sm" variant="outline">
                    <a href={snapshotQuery.data.resumeUrl} target="_blank" rel="noreferrer">
                      <FileText /> CV enviado
                    </a>
                  </Button>
                )}
                {snapshotQuery.data.evidenceUrl && (
                  <Button asChild size="sm" variant="outline">
                    <a href={snapshotQuery.data.evidenceUrl} target="_blank" rel="noreferrer">
                      <ImageIcon /> Evidencia
                    </a>
                  </Button>
                )}
              </div>
              {Array.isArray(snapshotQuery.data.snapshot.answers) && (
                <div className="border-t border-border pt-3">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Respuestas</p>
                  <div className="space-y-2">
                    {(snapshotQuery.data.snapshot.answers as Array<Record<string, unknown>>)
                      .filter((answer) => answer["type"] !== "file")
                      .slice(0, 20)
                      .map((answer, index) => (
                        <div key={index} className="grid gap-1 text-xs sm:grid-cols-[220px_1fr]">
                          <span className="text-muted-foreground">{String(answer["label"] ?? answer["canonicalKey"] ?? "Pregunta")}</span>
                          <span>{String(answer["value"] ?? "—")}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function Status({ value }: { value: string }) {
  const labels: Record<string, string> = {
    queued: "En cola",
    preparing: "Preparando",
    resume_generating: "Generando CV",
    ready: "Lista",
    submitting: "Enviando",
    submitted_unverified: "Verificando envío",
    verified: "Enviada",
    failed_retryable: "Reintentando",
    failed_permanent: "Necesita atención",
    expired: "Vacante expirada",
    duplicate: "Ya aplicada",
    unsupported: "No soportada",
  };
  const attention = ["failed_permanent", "expired", "unsupported"].includes(value);
  const success = value === "verified";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-sm font-medium",
        attention ? "text-caution" : success ? "text-primary" : "text-muted-foreground",
      )}
    >
      {attention ? <AlertCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
      {labels[value] ?? value}
    </span>
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
