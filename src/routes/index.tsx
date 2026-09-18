import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronDown, Search } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/aplica";
import { OpportunityField } from "@/components/opportunity-field";
import { useAplica } from "@/lib/aplica-store";

// No head() here: the home route inherits title/description/og/twitter from
// __root.tsx, and ships no og:image so serve-time hosting can inject the
// project's social preview (explicit og:image or latest screenshot).
export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "aplica — Encontrar trabajo no debería ser un trabajo" }, { name: "description", content: "Subí tu CV. Encontramos los trabajos correctos y aplicamos por vos." }, { property: "og:title", content: "aplica — Tu búsqueda laboral, automatizada" }, { property: "og:description", content: "Subí tu CV. Encontramos los trabajos correctos y aplicamos por vos." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Index,
});

// IMPORTANT: Replace this placeholder. See ./README.md for routing conventions.
function Index() {
  const navigate = useNavigate();
  const { searchPreferences, setSearchPreferences } = useAplica();
  const [role, setRole] = useState(searchPreferences.role);
  const [location, setLocation] = useState(searchPreferences.location);
  const [mode, setMode] = useState(searchPreferences.mode || "Remoto");

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearchPreferences({ role, location, mode });
    void navigate({ to: "/onboarding" });
  };

  return (
    <div className="home-page relative min-h-[100svh] overflow-hidden bg-background">
      <header className="absolute inset-x-0 top-0 z-30">
        <div className="mx-auto flex h-[88px] max-w-[1600px] items-center justify-between px-5 md:px-12">
          <Wordmark compact />
          <nav className="flex items-center gap-5 md:gap-8" aria-label="Principal">
            <a className="hidden text-sm font-medium text-foreground/80 transition-colors hover:text-foreground sm:block" href="#buscar">Cómo funciona</a>
            <Link className="text-sm font-medium text-foreground/80 transition-colors hover:text-foreground" to="/login">Ingresar</Link>
            <Button asChild size="sm" className="home-primary h-9 rounded-[10px] px-4 text-sm font-semibold"><Link to="/onboarding">Empezar</Link></Button>
          </nav>
        </div>
      </header>

      <main id="buscar" className="relative z-10 mx-auto flex min-h-[100svh] max-w-[1100px] flex-col items-center px-4 pt-[17vh] text-center sm:pt-[19vh] md:px-8 md:pt-[21.5vh]">
        <h1 className="home-headline text-[36px] font-medium leading-[1.04] tracking-normal text-foreground sm:text-[44px] md:text-[52px]">Encontrá el trabajo correcto.</h1>

        <form onSubmit={submitSearch} className="home-search-group mt-7 w-full max-w-[960px]" aria-label="Buscar trabajos">
          <div className="home-search grid overflow-hidden rounded-[18px] border border-border bg-background p-2 text-left md:h-[70px] md:grid-cols-[38fr_24fr_18fr_20fr] md:items-center md:p-1.5">
            <label className="home-search-field px-4 py-3 md:px-5 md:py-1">
              <span>Qué trabajo buscás</span>
              <input value={role} onChange={(event) => setRole(event.target.value)} placeholder="Growth Manager, Analista, Developer..." autoComplete="off" />
            </label>
            <label className="home-search-field border-t border-border px-4 py-3 md:border-l md:border-t-0 md:px-5 md:py-1">
              <span>Dónde</span>
              <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Buenos Aires" autoComplete="off" />
            </label>
            <label className="home-search-field border-t border-border px-4 py-3 md:border-l md:border-t-0 md:px-5 md:py-1">
              <span>Modalidad</span>
              <select value={mode} onChange={(event) => setMode(event.target.value)} aria-label="Modalidad de trabajo">
                <option>Remoto</option><option>Híbrido</option><option>Presencial</option><option>Cualquiera</option>
              </select>
            </label>
            <Button type="submit" className="home-primary mt-1 h-[54px] w-full rounded-[14px] px-[22px] text-sm font-semibold md:mt-0"><Search className="h-4 w-4" />Buscar trabajos</Button>
          </div>

          <div className="home-filters mx-auto mt-3 flex h-[38px] w-fit max-w-full divide-x divide-border overflow-hidden rounded-full border border-border bg-background/90">
            {["Full-time", "Seniority", "Salario"].map((filter) => (
              <Button key={filter} type="button" variant="ghost" className="h-full rounded-none px-4 text-[13px] font-normal text-muted-foreground hover:text-foreground sm:px-5">{filter}<ChevronDown className="h-3 w-3" /></Button>
            ))}
          </div>
        </form>
      </main>
      <OpportunityField />
    </div>
  );
}
