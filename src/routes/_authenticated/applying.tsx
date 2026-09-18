import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { PageShell, SiteHeader } from "@/components/aplica";
import { supabase } from "@/integrations/supabase/client";
import { getBatchProgress } from "@/lib/auto-apply.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/applying")({
  validateSearch: (search: Record<string, unknown>) => ({ batch: typeof search.batch === "string" ? search.batch : "" }),
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

const statusLabel: Record<string, string> = {
  queued: "En cola",
  preparing: "Preparando",
  resume_generating: "Generando CV",
  ready: "Listo para enviar",
  submitting: "Enviando",
  submitted_unverified: "Enviado, verificando",
  verified: "Enviada",
  failed_retryable: "Reintentando",
  failed_permanent: "No se pudo enviar",
  expired: "Vacante expirada",
  duplicate: "Ya aplicaste",
  unsupported: "No soportado",
};

function ApplyingPage() {
  const { batch } = Route.useSearch();
  const fetchProgress = useServerFn(getBatchProgress);
  const { data, refetch } = useQuery({
    queryKey: ["batch-progress", batch],
    queryFn: () => fetchProgress({ data: { batchId: batch } }),
    enabled: Boolean(batch),
  });

  useEffect(() => {
    if (!batch) return;
    const channel = supabase
      .channel(`batch-${batch}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "application_attempts" }, () => void refetch())
      .on("postgres_changes", { event: "*", schema: "public", table: "application_batches" }, () => void refetch())
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

        <div className="mt-8 border-t border-border">
          {attempts.map((attempt) => (
            <div key={attempt.id} className="grid gap-2 border-b border-border py-4 md:grid-cols-[1fr_180px] md:items-center">
              <div>
                <p className="font-medium">{attempt.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{attempt.company}</p>
              </div>
              <span className={cn("text-sm", attempt.status === "verified" ? "text-primary" : attempt.status.startsWith("failed") ? "text-caution" : "text-muted-foreground")}>
                {statusLabel[attempt.status] ?? attempt.status}
              </span>
            </div>
          ))}
          {!attempts.length && <p className="py-16 text-center text-sm text-muted-foreground">Todavía no hay postulaciones en esta tanda.</p>}
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
