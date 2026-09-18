import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, MapPin, Search } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { OnboardingShell } from "@/components/onboarding-shell";
import { Input } from "@/components/ui/input";
import { applications, jobs } from "@/lib/aplica-data";
import { useAplica } from "@/lib/aplica-store";
import { cn } from "@/lib/utils";

const coveredCompanies = Array.from(new Set([...jobs, ...applications].map((item) => item.company)));
const coverageRows = [coveredCompanies, [...coveredCompanies.slice(5), ...coveredCompanies.slice(0, 5)]];

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
    <div className="home-continuum">
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

      <section className="coverage-section" aria-labelledby="coverage-title">
        <div className="coverage-heading">
          <p className="coverage-kicker">Oportunidades en todo el mercado</p>
          <h2 id="coverage-title">Encontrá oportunidades en empresas de toda la región.</h2>
          <p>Desde startups hasta compañías con alcance global.</p>
        </div>
        <div className="coverage-wall" aria-label={`Cobertura de oportunidades públicas en ${coveredCompanies.join(", ")}`}>
          {coverageRows.map((companies, rowIndex) => (
            <div className="coverage-marquee" data-direction={rowIndex === 0 ? "left" : "right"} key={rowIndex}>
              <div className="coverage-track">
                {[0, 1, 2, 3].map((copy) => (
                  <div className="coverage-group" aria-hidden={copy !== 0} key={copy}>
                    {companies.map((company) => <span className="coverage-logo" key={`${copy}-${company}`}>{company}</span>)}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="coverage-disclaimer">Las marcas pertenecen a sus respectivos propietarios. La inclusión indica disponibilidad de oportunidades públicas y no implica afiliación con Aplica.</p>
      </section>
    </div>
  );
}
