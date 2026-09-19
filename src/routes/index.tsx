import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { DatabaseZap, RefreshCw, ShieldCheck } from "lucide-react";
import { OnboardingShell } from "@/components/onboarding-shell";
import { ProductDemo } from "@/components/product-demo";
import { getPublicInventoryStats } from "@/lib/public-inventory.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title: "aplica — Encontrar trabajo no debería ser un trabajo",
      },
      {
        name: "description",
        content:
          "Subí tu CV. Encontramos trabajos compatibles y preparamos tus postulaciones sin inventar experiencia.",
      },
      {
        property: "og:title",
        content: "aplica — Tu búsqueda laboral, automatizada",
      },
      {
        property: "og:description",
        content:
          "Subí tu CV. Encontramos trabajos compatibles y preparamos tus postulaciones.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const fetchStats = useServerFn(getPublicInventoryStats);
  const statsQuery = useQuery({
    queryKey: ["public-inventory-stats"],
    queryFn: () => fetchStats(),
    refetchInterval: 60_000,
  });

  const stats = statsQuery.data;

  return (
    <div className="home-continuum">
      <OnboardingShell className="onboarding-sheet-demo">
        <ProductDemo />
      </OnboardingShell>

      <section className="inventory-proof" aria-label="Inventario de trabajos">
        <div className="inventory-proof-inner">
          <div>
            <p className="inventory-proof-kicker">Inventario real</p>
            <h2>Vacantes públicas, sincronizadas y verificadas.</h2>
            <p className="inventory-proof-copy">
              No mostramos puestos ficticios en el producto. Una vacante entra
              al inventario sólo si sigue activa y su formulario es compatible
              con Auto Apply.
            </p>
          </div>

          <div className="inventory-proof-grid">
            <ProofCard
              icon={<DatabaseZap />}
              label="Vacantes activas"
              value={statsQuery.isLoading ? "…" : String(stats?.activeJobs ?? 0)}
            />
            <ProofCard
              icon={<ShieldCheck />}
              label="Listas para Auto Apply"
              value={statsQuery.isLoading ? "…" : String(stats?.readyJobs ?? 0)}
            />
            <ProofCard
              icon={<RefreshCw />}
              label="Última actualización"
              value={
                stats?.lastUpdatedAt
                  ? new Date(stats.lastUpdatedAt).toLocaleString("es-AR", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "Sin sincronizar"
              }
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function ProofCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="inventory-proof-card">
      <span className="inventory-proof-icon">{icon}</span>
      <span>
        <small>{label}</small>
        <strong>{value}</strong>
      </span>
    </div>
  );
}
