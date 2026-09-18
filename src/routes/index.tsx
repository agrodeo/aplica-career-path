import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { OnboardingShell } from "@/components/onboarding-shell";
import { ProductDemo } from "@/components/product-demo";
import { getPublicInventorySummary } from "@/lib/public-inventory.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title: "aplica — Encontrar trabajo no debería ser un trabajo",
      },
      {
        name: "description",
        content:
          "Subí tu CV. Encontramos trabajos compatibles y automatizamos postulaciones que podemos completar de punta a punta.",
      },
      {
        property: "og:title",
        content: "aplica — Tu búsqueda laboral, automatizada",
      },
      {
        property: "og:description",
        content:
          "Subí tu CV. Encontramos trabajos compatibles y automatizamos postulaciones verificables.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const fetchInventory = useServerFn(getPublicInventorySummary);
  const inventory = useQuery({
    queryKey: ["public-live-inventory"],
    queryFn: () => fetchInventory(),
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  });

  const companies = inventory.data?.companies ?? [];
  const eligibleJobs = inventory.data?.eligibleJobs ?? 0;

  return (
    <div className="home-continuum">
      <OnboardingShell className="onboarding-sheet-demo">
        <ProductDemo />
      </OnboardingShell>

      <section
        className="coverage-section"
        aria-label="Inventario de oportunidades verificadas"
      >
        <div className="coverage-heading">
          <p className="coverage-kicker">Inventario en vivo</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            {inventory.isLoading
              ? "Verificando vacantes activas…"
              : eligibleJobs > 0
                ? `${eligibleJobs.toLocaleString("es-AR")} vacantes verificadas para Auto Apply`
                : "Verificando las primeras vacantes compatibles"}
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            Este número sale del inventario real de Aplica. Las vacantes
            cerradas se desactivan en la siguiente sincronización y los
            formularios se vuelven a inspeccionar antes de seguir disponibles.
          </p>
        </div>

        {companies.length > 0 && (
          <div className="coverage-wall" aria-label="Empresas con vacantes verificadas">
            <div className="coverage-marquee">
              <div className="coverage-track">
                {[0, 1, 2].map((copy) => (
                  <div
                    className="coverage-group"
                    aria-hidden={copy !== 0}
                    key={copy}
                  >
                    {companies.map((company) => (
                      <span
                        className="coverage-logo"
                        key={`${copy}-${company}`}
                      >
                        {company}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <p className="coverage-disclaimer">
          Sólo mostramos métricas y empresas presentes en el inventario actual.
          No implica afiliación con ningún empleador.
        </p>
      </section>
    </div>
  );
}
