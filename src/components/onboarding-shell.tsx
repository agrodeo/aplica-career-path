import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Wordmark } from "./aplica";
import { cn } from "@/lib/utils";

export function OnboardingShell({ children, trust = false, className }: { children: ReactNode; trust?: boolean; className?: string }) {
  return (
    <div className="onboarding-scene min-h-[100svh] overflow-hidden">
      <header className="onboarding-nav">
        <Wordmark compact />
        <nav className="flex items-center gap-5 sm:gap-7" aria-label="Principal">
          <a className="hidden text-sm text-foreground/75 transition-colors hover:text-foreground sm:block" href="#experiencia">Cómo funciona</a>
          <Link className="text-sm text-foreground/75 transition-colors hover:text-foreground" to="/login">Ingresar</Link>
          <Button asChild variant="outline" size="sm" className="h-9 rounded-[10px] bg-background px-4 font-medium shadow-none">
            <Link to="/onboarding">Empezar <ArrowRight className="h-3.5 w-3.5" /></Link>
          </Button>
        </nav>
      </header>

      <main id="experiencia" className="onboarding-grid">
        <section className="onboarding-promise">
          <h1>La forma más rápida<br />de conseguir <span>trabajo.</span></h1>
          <p>Subí tu CV y aplicá más rápido a trabajos que encajan con vos.</p>
          <Button asChild size="lg" className="home-primary mt-8 h-[66px] w-[330px] rounded-[12px] text-[19px] font-semibold">
            <Link to="/onboarding">Empezar ahora <ArrowRight /></Link>
          </Button>
          <small>Tu perfil usa información real.</small>
        </section>

        <section className={cn("onboarding-sheet", className)}>{children}</section>
      </main>

      {trust && <footer className="onboarding-trust" aria-label="Compromisos de Aplica">
        <span>Tu información sigue siendo tuya.</span>
        <span>CV adaptados sin inventar experiencia.</span>
        <span>Cancelá cuando quieras.</span>
      </footer>}
    </div>
  );
}