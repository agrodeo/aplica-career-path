import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/aplica";
import { supabase } from "@/integrations/supabase/client";
import { getAutoApplyOverview, listAvailablePlans } from "@/lib/auto-apply.supabase";
export const Route = createFileRoute("/upgrade")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
    return { user: data.user };
  },
  head: () => ({ meta: [{ title: "Planes — aplica" }] }), component: Upgrade,
});
function Upgrade() {
  const { user } = Route.useRouteContext();
  const plans = useQuery({ queryKey: ["plans"], queryFn: listAvailablePlans });
  const overview = useQuery({ queryKey: ["auto-apply-overview", user.id], queryFn: getAutoApplyOverview });
  return <main className="min-h-screen bg-surface">
    <header className="mx-auto flex max-w-[1120px] items-center justify-between px-5 py-5"><Wordmark compact /><Button asChild variant="ghost"><Link to="/jobs"><ArrowLeft />Volver</Link></Button></header>
    <section className="mx-auto max-w-[1060px] px-5 pb-16 pt-10 text-center">
      <h1 className="text-3xl font-medium md:text-[44px]">Planes de Aplica</h1>
      <p className="mx-auto mt-4 max-w-xl leading-7 text-muted-foreground">Adaptación de CV, postulaciones automáticas y seguimiento de envíos confirmados.</p>
      <div className="mx-auto mt-6 max-w-xl rounded-lg border border-border bg-background p-5 text-sm" role="status">
        {overview.data?.subscriptionStatus === "active" ? `Tu plan ${overview.data.planName ?? ""} está activo.` : "Aplica está en beta. La contratación y los cobros todavía no están habilitados."}
      </div>
      {plans.isPending && <p className="mt-8" role="status">Cargando planes…</p>}
      {plans.error && <p className="mt-8" role="alert">No pudimos cargar los planes: {plans.error.message}</p>}
      <div className="mt-10 grid gap-4 text-left md:grid-cols-3">{plans.data?.map((plan) => <article key={plan.code} className="rounded-xl border border-border bg-background p-6">
        <h2 className="text-xl font-medium">{plan.name}</h2>
        <p className="mt-5 text-2xl font-medium">{new Intl.NumberFormat("es-AR", { style: "currency", currency: plan.price_currency }).format(Number(plan.price_amount))}<span className="text-sm font-normal text-muted-foreground"> / {periodLabel(plan.billing_period)}</span></p>
        <p className="mt-3 text-sm">{plan.weekly_application_limit == null ? "Sin límite semanal de postulaciones" : `${plan.weekly_application_limit} postulaciones por semana`}</p>
        <Button className="mt-6 w-full" variant="outline" disabled>Contratación próximamente</Button>
      </article>)}</div>
      {plans.data?.length === 0 && <p className="mt-8 text-sm text-muted-foreground">Todavía no hay planes disponibles.</p>}
      <p className="mt-8 text-xs text-muted-foreground">La beta no activa una suscripción ni realiza un cargo desde esta pantalla.</p>
    </section>
  </main>;
}
function periodLabel(period: string) { return ({ weekly: "semana", monthly: "mes", yearly: "año", annual: "año" } as Record<string, string>)[period] ?? period; }
