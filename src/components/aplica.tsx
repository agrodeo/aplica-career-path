import { Link, useRouterState } from "@tanstack/react-router";
import { Bookmark, ChevronRight, CircleHelp, Menu, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { matchTier, type Job } from "@/lib/aplica-data";
import { useAplica } from "@/lib/aplica-store";

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return <Link to="/" className={cn("font-semibold text-foreground", compact ? "text-xl" : "text-2xl")} aria-label="aplica, inicio">aplica<span className="text-primary">.</span></Link>;
}

export function SiteHeader({ simple = false }: { simple?: boolean }) {
  const [open, setOpen] = useState(false);
  const path = useRouterState({ select: (state) => state.location.pathname });
  const product = ["/jobs", "/applications", "/profile", "/settings"].some((route) => path.startsWith(route));
  return <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm">
    <div className={cn("mx-auto flex h-16 items-center justify-between px-5", product ? "max-w-[1200px]" : "max-w-[1120px]")}>
      <Wordmark compact />
      {!simple && product && <nav className="hidden items-center gap-7 md:flex" aria-label="Principal">
        <NavLink to="/jobs">Trabajos</NavLink><NavLink to="/applications">Aplicaciones</NavLink><NavLink to="/profile">Perfil</NavLink>
      </nav>}
      {!simple && !product && <nav className="hidden items-center gap-6 md:flex"><a className="text-sm text-muted-foreground hover:text-foreground" href="#como-funciona">Cómo funciona</a><Link className="text-sm text-muted-foreground hover:text-foreground" to="/login">Ingresar</Link><Button asChild size="sm"><Link to="/onboarding">Empezar</Link></Button></nav>}
      {!simple && product && <Link to="/profile" className="hidden h-9 w-9 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background md:flex">SF</Link>}
      {!simple && <Button variant="ghost" size="icon" className="md:hidden" aria-label={open ? "Cerrar menú" : "Abrir menú"} onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</Button>}
    </div>
    {open && <nav className="border-t border-border bg-background px-5 py-4 md:hidden"><div className="flex flex-col gap-1">{product ? <><MobileLink to="/jobs">Trabajos</MobileLink><MobileLink to="/applications">Aplicaciones</MobileLink><MobileLink to="/profile">Perfil</MobileLink><MobileLink to="/settings">Configuración</MobileLink></> : <><a className="py-3 text-sm" href="#como-funciona">Cómo funciona</a><MobileLink to="/login">Ingresar</MobileLink><Button asChild className="mt-2"><Link to="/onboarding">Empezar</Link></Button></>}</div></nav>}
  </header>;
}

function NavLink({ to, children }: { to: "/jobs" | "/applications" | "/profile"; children: ReactNode }) {
  return <Link to={to} className="text-sm text-muted-foreground transition-colors hover:text-foreground" activeProps={{ className: "text-sm font-medium text-foreground" }}>{children}</Link>;
}
function MobileLink({ to, children }: { to: "/jobs" | "/applications" | "/profile" | "/settings" | "/login"; children: ReactNode }) { return <Link className="py-3 text-sm" to={to}>{children}</Link>; }

export function PageShell({ children, className }: { children: ReactNode; className?: string }) { return <main className={cn("mx-auto w-full max-w-[1200px] px-5 py-10 md:px-8 md:py-14", className)}>{children}</main>; }

export function Choice({ selected, onClick, children, description }: { selected: boolean; onClick: () => void; children: ReactNode; description?: string }) {
  return <button type="button" onClick={onClick} className={cn("flex min-h-12 w-full items-center justify-between rounded-[10px] border px-4 py-3 text-left text-sm transition-all", selected ? "border-primary bg-primary-soft text-foreground ring-1 ring-primary" : "border-border bg-background hover:border-strong")}><span><span className="font-medium">{children}</span>{description && <span className="mt-1 block text-muted-foreground">{description}</span>}</span><span className={cn("h-4 w-4 rounded-full border", selected ? "border-primary bg-primary ring-4 ring-primary-soft" : "border-strong")} /></button>;
}

export function JobRow({ job, selectable = false }: { job: Job; selectable?: boolean }) {
  const { toggleJob, toggleSaved } = useAplica();
  return <article className={cn("group grid gap-4 border-t border-border py-6 first:border-t-0 md:grid-cols-[1fr_auto] md:gap-8", selectable && job.selected && "bg-selected -mx-3 px-3 rounded-lg")}>
    <div className="flex min-w-0 gap-4">
      {selectable ? <Checkbox checked={job.selected} onCheckedChange={() => toggleJob(job.id)} aria-label={`Seleccionar ${job.role} en ${job.company}`} className="mt-3 h-5 w-5" /> : <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-xs font-semibold">{job.initials}</div>}
      <div className="min-w-0"><Link to="/jobs/$id" params={{ id: job.id }} className="text-lg font-medium hover:text-primary">{job.role}</Link><p className="mt-0.5 text-sm text-foreground">{job.company}</p><p className="mt-1 text-sm text-muted-foreground">{job.location} · {job.mode} · {job.salary}</p><p className="mt-1 text-xs text-muted-foreground">{job.posted}</p>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">{job.fit.slice(0, 4).map((item) => <span key={item} className="text-xs text-muted-foreground"><span className="mr-1 text-success">✓</span>{item}</span>)}</div>
        {job.concern && <p className="mt-3 text-xs text-caution"><span className="font-medium">A considerar:</span> {job.concern}</p>}
      </div>
    </div>
    <div className="flex items-center justify-between gap-4 pl-[60px] md:w-40 md:flex-col md:items-end md:justify-start md:pl-0">
      <div className="text-right"><div className="text-xl font-semibold text-primary">{job.match}% <span className="text-sm font-medium">match</span></div><div className="mt-0.5 text-xs text-muted-foreground">{matchTier(job.match)}</div></div>
      <div className="flex items-center gap-1"><Button variant="ghost" size="icon" onClick={() => toggleSaved(job.id)} aria-label={job.saved ? "Quitar de guardados" : "Guardar trabajo"}><Bookmark className={cn(job.saved && "fill-primary text-primary")} /></Button><Button variant="outline" size="sm" asChild><Link to="/jobs/$id" params={{ id: job.id }}>Ver <ChevronRight /></Link></Button></div>
    </div>
  </article>;
}

export function MatchInfo() { return <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" title="El match compara tu experiencia, habilidades, ubicación y preferencias. No representa una probabilidad de contratación."><CircleHelp className="h-3.5 w-3.5" /> Cómo calculamos el match</span>; }
