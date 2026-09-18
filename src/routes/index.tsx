import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, MapPin, Search } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { OnboardingShell } from "@/components/onboarding-shell";
import { Input } from "@/components/ui/input";
import { useAplica } from "@/lib/aplica-store";
import { cn } from "@/lib/utils";

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
  const { searchPreferences, setSearchPreferences, setOnboardingStep } = useAplica();
  const [role, setRole] = useState(searchPreferences.role);
  const [location, setLocation] = useState(searchPreferences.location);
  const [mode, setMode] = useState(searchPreferences.mode || "Remoto");

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearchPreferences({ role, location, mode });
    setOnboardingStep(2);
    void navigate({ to: "/onboarding" });
  };

  return (
    <OnboardingShell trust>
      <div className="sheet-intro">
        <p className="sheet-kicker">Empezá por lo importante</p>
        <h2>¿Qué trabajo estás buscando?</h2>
        <p className="sheet-subtitle">Definí tu búsqueda. Después completamos tu perfil una sola vez.</p>
      </div>
      <form onSubmit={submitSearch} className="sheet-form mt-8" aria-label="Buscar trabajos">
        <label className="sheet-field">
          <span>Puesto o área</span>
          <div className="relative"><Search className="sheet-field-icon" /><Input className="pl-11" value={role} onChange={(event) => setRole(event.target.value)} placeholder="Growth Manager" autoComplete="off" /></div>
        </label>
        <label className="sheet-field">
          <span>Ubicación</span>
          <div className="relative"><MapPin className="sheet-field-icon" /><Input className="pl-11" value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Buenos Aires" autoComplete="off" /></div>
        </label>
        <fieldset className="sheet-field">
          <legend>Modalidad</legend>
          <div className="sheet-segments">
            {["Remoto", "Híbrido", "Presencial"].map((value) => <Button key={value} type="button" variant={mode === value ? "default" : "outline"} className={cn(mode === value && "home-primary")} onClick={() => setMode(value)}>{value}</Button>)}
          </div>
        </fieldset>
        <Button type="submit" className="home-primary mt-2 h-12 w-full rounded-[10px] font-semibold">Continuar <ArrowRight /></Button>
      </form>
    </OnboardingShell>
  );
}
