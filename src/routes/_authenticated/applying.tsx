import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { PageShell, SiteHeader } from "@/components/aplica";
import { supabase } from "@/integrations/supabase/client";
import { getBatchProgress } from "@/lib/auto-apply.supabase";
import { applicationAction, applicationStatusLabel } from "@/lib/auto-apply/application-status";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/applying")({
  validateSearch: (search: Record<string, unknown>) => ({ batch: typeof search["batch"] === "string" ? (search["batch"] as string) : "" }),
  head: () => ({
    meta: [
      { title: "Aplicando por vos — aplica" },
      { name: "description", content: "Seguimiento en vivo de cada postulación enviada por Aplica." },
      { property: "og:title", content: "Aplicando por vos — aplica" },
      { property: "og:description", content: "Progreso en vivo de tus postulaciones automáticas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ApplyingPage,
});

function ApplyingPage() {
  const { batch } = Route.useSearch();
  const { data, error, refetch } = useQuery({
    queryKey: ["batch-progress", batch],
    queryFn: () => getBatchProgress({ data: { batchId: batch } }),
    enabled: Boolean(batch),
    refetchInterval: 10000,
  });

  useEffect(() => {
    if (!batch) return;
    const channel = supabase
      .channel(`batch-${batch}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "application_attempts", filter: `batch_id=eq.${batch}` }, () => void refetch())
      .on("postgres_changes", { event: "*", schema: "public", table: "application_batches", filter: `id=eq.${batch}` }, () => void refetch())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [batch, refetch]);

  const attempts = data?.attempts ?? [];
  const counts = {
    verified: attempts.filter((a) => a.status === "verified").length,
    processing: attempts.filter((a) => ["preparing", "resume_generating", "ready", "submitting", "submitted_unverified"].includes(a.status)).length,
    queued: attempts.filter((a) => a.status === "queued").length,
    failed: attempts.filter((a) => a.status.startsWith("failed") || a.status === "expired" || a.status === "unsupported").length,
  };

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <PageShell>
        {data === undefined && batch && !error && <p role="status">Cargando la tanda…</p>}
        {error && <p role="alert">No pudimos cargar la tanda: {error.message}</p>}
        {data && !data.batch && <p role="alert">No encontramos esta tanda en tu cuenta.</p>}
        {!batch && <p className="mb-5">Elegí una tanda desde <Link to="/applications" className="underline">tus postulaciones</Link>.</p>}
        <h1 className="text-3xl font-medium tracking-normal md:text-[40px]">Aplicando por vos</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {data?.batch?.total_selected ?? 0} trabajos seleccionados · una postulación se marca como enviada sólo cuando se verifica el envío.
        </p>

        <div className="mt-8 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4">
          <Stat label="Enviadas" value={counts.verified} />
          <Stat label="Procesando" value={counts.processing} />
          <Stat label="En cola" value={counts.queued} />
          <Stat label="Sin enviar" value={counts.failed} />
        </div>

        <Link to="/applications" className="mt-6 inline-block text-sm underline">Ver todas mis postulaciones</Link>
        <div className="mt-8 border-t border-border">
          {attempts.map((attempt) => (
            <div key={attempt.id} className="grid gap-2 border-b border-border py-4 md:grid-cols-[1fr_180px] md:items-center">
              <div>
                <p className="font-medium">{attempt.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{attempt.company}</p>
                {applicationAction(attempt.errorCode, attempt.status) && <p className="mt-2 text-sm text-muted-foreground">{applicationAction(attempt.errorCode, attempt.status)}</p>}
              </div>
              <span className={cn("text-sm", attempt.status === "verified" ? "text-primary" : attempt.status.startsWith("failed") ? "text-caution" : "text-muted-foreground")}>
                {applicationStatusLabel(attempt.status)}
              </span>
            </div>
          ))}
          {!attempts.length && data?.batch && <p className="py-16 text-center text-sm text-muted-foreground">Todavía no hay postulaciones en esta tanda.</p>}
        </div>
      </PageShell>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-background p-5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-medium">{value}</p>
    </div>
  );
}
