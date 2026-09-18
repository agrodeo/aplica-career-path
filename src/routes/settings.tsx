import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CreditCard, LogOut, Lock, ShieldCheck } from "lucide-react";
import { PageShell, SiteHeader } from "@/components/aplica";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { getAutoApplyOverview } from "@/lib/auto-apply.functions";
import { getAutoApplyConsent, setAutoApplyConsent } from "@/lib/master-profile.functions";
import type { ReactNode } from "react";

export const Route = createFileRoute("/settings")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
    return { user: data.user };
  },
  head: () => ({
    meta: [
      { title: "Configuración — aplica" },
      { name: "description", content: "Administrá privacidad, autorización y suscripción." },
      { property: "og:title", content: "Configuración — aplica" },
      { property: "og:description", content: "Controlá cómo funciona Aplica para vos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Settings,
});

function Settings() {
  const navigate = useNavigate();
  const fetchConsent = useServerFn(getAutoApplyConsent);
  const updateConsent = useServerFn(setAutoApplyConsent);
  const fetchOverview = useServerFn(getAutoApplyOverview);

  const consentQuery = useQuery({
    queryKey: ["auto-apply-consent"],
    queryFn: () => fetchConsent(),
  });
  const overviewQuery = useQuery({
    queryKey: ["auto-apply-overview"],
    queryFn: () => fetchOverview(),
  });

  const consentMutation = useMutation({
    mutationFn: (authorized: boolean) =>
      updateConsent({ data: { authorized, termsVersion: "v1" } }),
    onSuccess: () => void consentQuery.refetch(),
  });

  const logout = async () => {
    await supabase.auth.signOut();
    await navigate({ to: "/login" });
  };

  const overview = overviewQuery.data;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <PageShell className="max-w-[760px]">
        <h1 className="text-3xl font-medium tracking-normal">Configuración</h1>

        <div className="mt-10 space-y-10">
          <Section icon={<ShieldCheck />} title="Auto Apply">
            <div className="flex items-start justify-between gap-5 border-b border-border py-4">
              <div>
                <p className="text-sm font-medium">Autorizar envíos seleccionados</p>
                <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
                  Cuando está activo, Aplica puede enviar únicamente las vacantes que vos seleccionaste usando tu perfil y CV. Podés revocar esta autorización en cualquier momento.
                </p>
              </div>
              <Switch
                className="mt-1 shrink-0"
                checked={consentQuery.data?.authorized ?? false}
                disabled={consentQuery.isLoading || consentMutation.isPending}
                onCheckedChange={(checked) => consentMutation.mutate(checked)}
              />
            </div>
            {consentMutation.error && <p className="mt-3 text-sm text-destructive">{consentMutation.error.message}</p>}
          </Section>

          <Section icon={<CreditCard />} title="Suscripción">
            <p className="text-sm text-muted-foreground">
              {overviewQuery.isLoading
                ? "Cargando plan…"
                : overview?.subscriptionStatus === "active"
                  ? `${overview.planName ?? overview.subscriptionStatus} · ${overview.creditsConsumed} aplicaciones verificadas consumidas en el período actual`
                  : "No hay una suscripción activa."}
            </p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => void navigate({ to: "/upgrade" })}>
              {overview?.subscriptionStatus === "active" ? "Ver plan" : "Elegir plan"}
            </Button>
          </Section>

          <Section icon={<Lock />} title="Privacidad">
            <p className="text-sm leading-6 text-muted-foreground">
              Tu perfil, CV y respuestas se usan para buscar y preparar tus postulaciones. Las preguntas sensibles como autorización laboral y sponsorship sólo se contestan con respuestas que hayas confirmado explícitamente.
            </p>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Una postulación sólo aparece como “Enviada” después de que Aplica detecta una confirmación verificable del ATS.
            </p>
          </Section>

          <Section icon={<LogOut />} title="Sesión">
            <Button variant="outline" size="sm" onClick={() => void logout()}>
              <LogOut /> Cerrar sesión
            </Button>
          </Section>
        </div>
      </PageShell>
    </div>
  );
}

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="border-t border-border pt-6">
      <div className="mb-5 flex items-center gap-3 [&_svg]:h-5 [&_svg]:w-5">
        <span className="text-muted-foreground">{icon}</span>
        <h2 className="font-medium">{title}</h2>
      </div>
      {children}
    </section>
  );
}
