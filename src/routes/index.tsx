import { createFileRoute } from "@tanstack/react-router";
import { OnboardingShell } from "@/components/onboarding-shell";
import { ProductDemo } from "@/components/product-demo";
import { applications, jobs } from "@/lib/aplica-data";
import accentureAsset from "@/assets/accenture.png.asset.json";
import amazonAsset from "@/assets/amazon.png.asset.json";
import anthropicAsset from "@/assets/anthropic.png.asset.json";
import canvaAsset from "@/assets/canva.png.asset.json";
import kavakAsset from "@/assets/kavak.png.asset.json";
import mercadoLibreAsset from "@/assets/mercado-libre.png.asset.json";
import metaAsset from "@/assets/meta.png.asset.json";
import rampAsset from "@/assets/ramp.png.asset.json";
import rappiAsset from "@/assets/rappi.png.asset.json";
import santanderAsset from "@/assets/santander.png.asset.json";
import stripeAsset from "@/assets/stripe.png.asset.json";
import ualaAsset from "@/assets/uala.png.asset.json";

const coverageLogos: { name: string; src: string }[] = [
  { name: "Mercado Libre", src: mercadoLibreAsset.url },
  { name: "Amazon", src: amazonAsset.url },
  { name: "Meta", src: metaAsset.url },
  { name: "Santander", src: santanderAsset.url },
  { name: "Stripe", src: stripeAsset.url },
  { name: "Accenture", src: accentureAsset.url },
  { name: "Anthropic", src: anthropicAsset.url },
  { name: "Kavak", src: kavakAsset.url },
  { name: "Ramp", src: rampAsset.url },
  { name: "Rappi", src: rappiAsset.url },
  { name: "Ualá", src: ualaAsset.url },
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
          <p className="coverage-kicker">Oportunidades en empresas de la región y el mundo</p>
        </div>
        <div className="coverage-wall" aria-label={`Cobertura de oportunidades públicas en ${coveredCompanies.join(", ")}`}>
          <div className="coverage-marquee">
            <div className="coverage-track">
              {[0, 1, 2, 3].map((copy) => (
                <div className="coverage-group" aria-hidden={copy !== 0} key={copy}>
                  {coverageLogos.map((logo) => (
                    <img className="coverage-logo-img" key={`${copy}-${logo.name}`} src={logo.src} alt={copy === 0 ? logo.name : ""} aria-hidden={copy !== 0} loading="eager" />
                  ))}
                  {otherCompanies.map((company) => <span className="coverage-logo" key={`${copy}-${company}`}>{company}</span>)}
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
