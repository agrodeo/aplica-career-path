import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/aplica";

// No head() here: the home route inherits title/description/og/twitter from
// __root.tsx, and ships no og:image so serve-time hosting can inject the
// project's social preview (explicit og:image or latest screenshot).
export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "aplica — Encontrar trabajo no debería ser un trabajo" }, { name: "description", content: "Subí tu CV. Encontramos los trabajos correctos y aplicamos por vos." }, { property: "og:title", content: "aplica — Tu búsqueda laboral, automatizada" }, { property: "og:description", content: "Subí tu CV. Encontramos los trabajos correctos y aplicamos por vos." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Index,
});

// IMPORTANT: Replace this placeholder. See ./README.md for routing conventions.
function Index() {
  return (
    <div className="min-h-screen bg-background"><SiteHeader />
      <main><section className="mx-auto flex min-h-[calc(100vh-64px)] max-w-[900px] flex-col items-center justify-center px-5 pb-24 pt-20 text-center md:min-h-[680px]">
        <p className="text-sm font-medium text-primary">Tu búsqueda laboral, automatizada.</p>
        <h1 className="mt-6 max-w-[820px] text-[42px] font-medium leading-[1.08] tracking-normal md:text-[60px]">Encontrar trabajo no debería ser un trabajo.</h1>
        <p className="mt-7 max-w-[680px] text-base leading-7 text-muted-foreground md:text-lg">Subí tu CV y Aplica encuentra los puestos que mejor encajan con vos, adapta tu perfil y te ayuda a postularte sin repetir el mismo formulario cien veces.</p>
        <Button asChild size="lg" className="mt-9"><Link to="/onboarding">Encontrar trabajos<ArrowRight /></Link></Button>
        <Link to="/login" className="mt-4 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Ya tengo cuenta</Link>
        <p className="mt-8 flex items-center gap-2 text-xs text-muted-foreground"><Check className="h-3.5 w-3.5 text-success" />Tu experiencia sigue siendo tuya. Nunca inventamos información en tu CV.</p>
      </section>
      <section id="como-funciona" className="border-t border-border bg-surface"><div className="mx-auto grid max-w-[1000px] gap-10 px-5 py-16 md:grid-cols-3 md:px-8 md:py-20">{[["01", "Contanos una vez", "Tu experiencia, preferencias y respuestas quedan listas para reutilizar."], ["02", "Elegí mejores trabajos", "Ordenamos oportunidades según lo que realmente buscás y podés hacer."], ["03", "Dejanos lo repetitivo", "Adaptamos tu CV y preparamos cada postulación para tu revisión."]].map(([n, title, text]) => <div key={n}><span className="text-xs font-medium text-primary">{n}</span><h2 className="mt-4 text-xl font-medium">{title}</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">{text}</p></div>)}</div></section></main>
      <footer className="border-t border-border"><div className="mx-auto flex max-w-[1120px] items-center justify-between px-5 py-8 text-sm"><span className="font-semibold">aplica<span className="text-primary">.</span></span><span className="text-muted-foreground">aplica.lat</span></div></footer>
    </div>
  );
}
