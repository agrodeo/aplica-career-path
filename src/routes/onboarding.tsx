import { createFileRoute, redirect } from "@tanstack/react-router";
import { OnboardingFlow } from "@/components/onboarding-flow";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/signup" });
    return { user: data.user };
  },
  head: () => ({
    meta: [
      { title: "Tu perfil — aplica" },
      { name: "description", content: "Contanos qué trabajo buscás una sola vez." },
      { property: "og:title", content: "Tu perfil — aplica" },
      { property: "og:description", content: "Prepará tu búsqueda laboral con Aplica." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OnboardingFlow,
});
