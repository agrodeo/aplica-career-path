import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdapterTestConsole } from "@/components/adapter-test-console";
import { PageShell, SiteHeader } from "@/components/aplica";
import { getAdminDashboard } from "@/lib/admin.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Panel interno — aplica" },
      { name: "description", content: "Estado de descubrimiento, elegibilidad y envíos verificados." },
      { property: "og:title", content: "Panel interno — aplica" },
      { property: "og:description", content: "Métricas internas de Auto Apply." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const fetchDashboard = useServerFn(getAdminDashboard);
  const { data, isLoading, error } = useQuery({ queryKey: ["admin-dashboard"], queryFn: () => fetchDashboard(), refetchInterval: 30000 });

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <PageShell>
        <h1 className="text-3xl font-medium tracking-normal md:text-[40px]">Panel interno</h1>
        <p className="mt-3 text-sm text-muted-foreground">Sólo datos reales de la base. Los adaptadores sin integración autorizada aparecen como no conectados.</p>

        {isLoading && <p className="mt-10 text-sm text-muted-foreground">Cargando métricas…</p>}
        {error && <p className="mt-10 text-sm text-caution">No tenés acceso a este panel.</p>}

        {data && (
          <>
            <div className="mt-10 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="Trabajos descubiertos" value={data.jobsDiscovered} />
              <Metric label="Trabajos activos" value={data.activeJobs} />
              <Metric label="Elegibles para Auto Apply" value={data.autoApplyEligible} />
              <Metric label="Tasa de elegibilidad" value={`${data.eligibilityRate}%`} />
              <Metric label="Aplicaciones (24 h)" value={data.applicationsToday} />
              <Metric label="Envíos verificados" value={data.verifiedSubmissions} />
              <Metric label="Envíos fallidos" value={data.failedSubmissions} />
              <Metric label="Tasa de éxito" value={`${data.successRate}%`} />
              <Metric label="Duplicados" value={`${data.duplicateRate}%`} />
              <Metric label="Expirados" value={`${data.expiredRate}%`} />
            </div>

            <h2 className="mt-12 text-xl font-medium">Salud de adaptadores</h2>
            <div className="mt-4 border-t border-border">
              {data.adapters.map((adapter) => (
                <div key={adapter.adapter} className="grid gap-2 border-b border-border py-4 md:grid-cols-[1fr_130px_150px_1fr] md:items-center">
                  <p className="font-medium">{adapter.label}</p>
                  <span
                    className={cn(
                      "text-xs font-medium",
                      adapter.health === "healthy" ? "text-primary" : adapter.health === "degraded" ? "text-caution" : "text-muted-foreground",
                    )}
                  >
                    {adapter.health === "healthy" ? "healthy" : adapter.health === "degraded" ? "degraded" : "down"}
                  </span>
                  <span className="text-xs text-muted-foreground">{adapter.connectionStatus}</span>
                  <span className="text-xs text-muted-foreground">
                    {adapter.submission && adapter.verification ? "envío + verificación" : "sólo descubrimiento"}
                    {adapter.lastError ? ` · ${adapter.lastError}` : ""}
                  </span>
                </div>
              ))}
            </div>

            <h2 className="mt-12 text-xl font-medium">Trabajos por ATS</h2>
            <div className="mt-4 border-t border-border">
              {Object.entries(data.jobsByAts).map(([ats, count]) => (
                <div key={ats} className="flex justify-between border-b border-border py-3 text-sm">
                  <span>{ats}</span>
                  <span className="text-muted-foreground">{count}</span>
                </div>
              ))}
            </div>

            <AdapterTestConsole />
          </>
        )}
      </PageShell>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-background p-5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-medium">{value}</p>
    </div>
  );
}
