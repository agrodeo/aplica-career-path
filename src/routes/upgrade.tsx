import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/aplica";
import { supabase } from "@/integrations/supabase/client";
import {
  getAutoApplyOverview,
  listAvailablePlans,
  listAutoApplyJobs,
} from "@/lib/auto-apply.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/upgrade")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
    return { user: data.user };
  },
  head: () => ({
    meta: [
      { title: "Elegí tu plan — aplica" },
      {
        name: "description",
        content: "Planes semanales para automatizar postulaciones verificadas.",
      },
      { property: "og:title", content: "Elegí tu plan — aplica" },
      {
        property: "og:description",
        content: "Elegí cuántas postulaciones querés automatizar por semana.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Upgrade,
});

function Upgrade() {
  const navigate = useNavigate();
  const fetchPlans = useServerFn(listAvailablePlans);
  const fetchOverview = useServerFn(getAutoApplyOverview);
  const fetchJobs = useServerFn(listAutoApplyJobs);
  const [notice, setNotice] = useState<string | null>(null);

  const plansQuery = useQuery({
    queryKey: ["plans"],
    queryFn: () => fetchPlans(),
  });
  const overviewQuery = useQuery({
    queryKey: ["auto-apply-overview"],
    queryFn: () => fetchOverview(),
  });
  const jobsQuery = useQuery({
    queryKey: ["auto-apply-jobs-paywall"],
    queryFn: () => fetchJobs(),
  });

  const plans = plansQuery.data ?? [];
  const ready = jobsQuery.data?.readyCount ?? 0;
  const currentPlan = overviewQuery.data?.planName ?? null;
  const active = overviewQuery.data?.subscriptionStatus === "active";

  return (
    <main className="min-h-screen bg-surface">
      <header className="mx-auto flex max-w-[1120px] items-center justify-between px-5 py-5">
        <Wordmark compact />
        <button
          onClick={() => navigate({ to: "/jobs" })}
          className="flex items-center gap-2 text-sm text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </button>
      </header>

      <section className="mx-auto max-w-[1060px] px-5 pb-16 pt-10 text-center">
        <h1 className="text-3xl font-medium tracking-normal md:text-[44px]">
          Dejá de aplicar trabajo por trabajo.
        </h1>
        <p className="mx-auto mt-4 max-w-xl leading-7 text-muted-foreground">
          Aplica prepara un CV específico, completa respuestas verificadas y
          envía sólo las vacantes que seleccionás.
        </p>
        <p className="mt-6 text-sm font-medium text-primary">
          {ready === 1
            ? "Tenés 1 trabajo listo para aplicar."
            : `Tenés ${ready} trabajos listos para aplicar.`}
        </p>

        {notice && (
          <div className="mx-auto mt-6 max-w-xl rounded-lg border border-border bg-background p-4 text-left text-sm leading-6 text-muted-foreground">
            {notice}
          </div>
        )}

        {plansQuery.isLoading ? (
          <p className="mt-12 text-sm text-muted-foreground">Cargando planes…</p>
        ) : plansQuery.error ? (
          <p className="mt-12 text-sm text-destructive">
            No pudimos cargar los planes: {plansQuery.error.message}
          </p>
        ) : (
          <div className="mt-10 grid gap-4 text-left md:grid-cols-3">
            {plans.map((plan, index) => {
              const preferred = index === 1;
              const isCurrent = active && currentPlan === plan.name;
              return (
                <article
                  key={plan.code}
                  className={cn(
                    "relative rounded-xl border bg-background p-6",
                    preferred
                      ? "border-primary ring-1 ring-primary"
                      : "border-border",
                  )}
                >
                  {preferred && (
                    <span className="absolute -top-3 left-5 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                      Más elegido
                    </span>
                  )}
                  <h2 className="text-xl font-medium">{plan.name}</h2>
                  <p className="mt-5">
                    <span className="text-3xl font-medium">
                      {plan.price_currency}{" "}
                      {Number(plan.price_amount).toLocaleString("en-US", {
                        maximumFractionDigits: 2,
                      })}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {" "}
                      / {plan.billing_period === "week" ? "semana" : plan.billing_period}
                    </span>
                  </p>
                  <p className="mt-2 text-sm font-medium">
                    {plan.weekly_application_limit} postulaciones por semana
                  </p>

                  <ul className="my-7 space-y-3">
                    {[
                      "Búsqueda y match de trabajos",
                      "CV específico para cada vacante",
                      "Respuestas confirmadas por vos",
                      "Envío y verificación cuando el ATS es compatible",
                      "Historial exacto de lo enviado",
                    ].map((feature) => (
                      <li
                        key={feature}
                        className="flex gap-2 text-sm text-muted-foreground"
                      >
                        <Check className="h-4 w-4 shrink-0 text-success" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <Button
                    className="w-full"
                    variant={preferred ? "default" : "outline"}
                    disabled={isCurrent}
                    onClick={() => {
                      if (isCurrent) return;
                      setNotice(
                        "El checkout todavía no está conectado en este entorno. No activamos planes ni cobramos sin una confirmación real del proveedor de pagos.",
                      );
                    }}
                  >
                    {isCurrent ? "Plan actual" : `Elegir ${plan.name}`}
                  </Button>
                </article>
              );
            })}
          </div>
        )}

        <p className="mt-8 text-sm">
          Renovación semanal. El límite se consume sólo con postulaciones
          verificadas.
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          Nunca agregamos experiencia, estudios ni habilidades que no hayas
          declarado.
        </p>
      </section>
    </main>
  );
}
