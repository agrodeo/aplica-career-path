import { createFileRoute } from "@tanstack/react-router";
import { OnboardingShell } from "@/components/onboarding-shell";
import { ProductDemo } from "@/components/product-demo";
import { applications, jobs } from "@/lib/aplica-data";
import accentureAsset from "@/assets/accenture.png.asset.json";
import amazonAsset from "@/assets/amazon.png.asset.json";
import canvaAsset from "@/assets/canva.png.asset.json";
import kavakAsset from "@/assets/kavak.png.asset.json";
import mercadoLibreAsset from "@/assets/mercado-libre.png.asset.json";
import rappiAsset from "@/assets/rappi.png.asset.json";
import santanderAsset from "@/assets/santander.png.asset.json";

const coverageLogos: { name: string; src: string }[] = [
  { name: "Mercado Libre", src: mercadoLibreAsset.url },
  { name: "Amazon", src: amazonAsset.url },
  { name: "Santander", src: santanderAsset.url },
  { name: "Accenture", src: accentureAsset.url },
  { name: "Kavak", src: kavakAsset.url },
  { name: "Rappi", src: rappiAsset.url },
  { name: "Canva", src: canvaAsset.url },
];

const coveredCompanies = Array.from(new Set([...jobs, ...applications].map((item) => item.company)));
const logoCompanies = new Set(coverageLogos.map((logo) => logo.name.toLowerCase()));
const otherCompanies = coveredCompanies.filter((company) => !logoCompanies.has(company.toLowerCase()));

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
    <div className="home-continuum">
      <OnboardingShell className="onboarding-sheet-demo">
        <ProductDemo />
      </OnboardingShell>

      <section className="coverage-section" aria-label="Cobertura de oportunidades">
        <div className="coverage-heading">
          <p className="coverage-kicker">Vacantes en más de 10.000 empresas</p>
        </div>
        <div className="coverage-wall" aria-label={`Cobertura de oportunidades públicas en ${coveredCompanies.join(", ")}`}>
          <div className="coverage-marquee">
            <div className="coverage-track">
              {[0, 1, 2, 3].map((copy) => (
                <div className="coverage-group" aria-hidden={copy !== 0} key={copy}>
                  {coveredCompanies.map((company) => <span className="coverage-logo" key={`${copy}-${company}`}>{company}</span>)}
                </div>
              ))}
              </div>
          </div>
        </div>
        <p className="coverage-disclaimer">La inclusión de marcas indica disponibilidad de oportunidades públicas y no implica afiliación.</p>
      </section>
    </div>
  );
}
