import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowUpDown, BriefcaseBusiness, Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { JobRow, MatchInfo, PageShell, SiteHeader } from "@/components/aplica";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAplica } from "@/lib/aplica-store";

export const Route = createFileRoute("/jobs")({ head: () => ({ meta: [{ title: "Trabajos para vos — aplica" }, { name: "description", content: "Oportunidades ordenadas según tu experiencia y preferencias." }, { property: "og:title", content: "Trabajos para vos — aplica" }, { property: "og:description", content: "Encontrá oportunidades que encajan con tu perfil." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }), component: JobsPage });

function JobsPage() {
  const { jobs, subscribed } = useAplica();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [min, setMin] = useState(70);
  const filtered = useMemo(() => jobs.filter((job) => job.match >= min && `${job.role} ${job.company} ${job.location}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => b.match - a.match), [jobs, query, min]);
  const eligible = jobs.filter((job) => job.match >= 80).length;
  return <div className="min-h-screen bg-background"><SiteHeader /><PageShell className="pb-32">
    <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="text-sm font-medium text-primary">Selección actualizada hoy</p><h1 className="mt-2 text-3xl font-medium tracking-normal md:text-[40px]">127 trabajos para vos</h1><p className="mt-3 text-sm text-muted-foreground">Ordenados según qué tan bien coincide tu perfil con cada puesto.</p></div><MatchInfo /></div>
    <div className="mt-9 flex flex-col gap-3 border-y border-border py-4 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground"/><Input className="pl-10" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Puesto, empresa o ubicación" /></div><Button variant="outline" onClick={() => setMin(min === 70 ? 80 : 70)}><SlidersHorizontal />Match mínimo: {min}%</Button><Button variant="outline"><ArrowUpDown />Mejor match</Button></div>
    <div className="mt-4">{filtered.length ? filtered.map((job) => <JobRow key={job.id} job={job} />) : <div className="py-24 text-center"><BriefcaseBusiness className="mx-auto h-8 w-8 text-muted-foreground"/><h2 className="mt-5 text-xl font-medium">Todavía no encontramos suficientes trabajos que encajen con tus criterios.</h2><p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-muted-foreground">Probá ajustando ubicación, salario, modalidad, seniority o industria.</p><Button className="mt-6" variant="outline" onClick={() => { setMin(70); setQuery(""); }}>Ajustar búsqueda</Button></div>}</div>
  </PageShell>
  <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur"><div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-5 py-3 md:px-8"><div><p className="text-sm font-medium">{eligible} trabajos cumplen tus criterios</p><p className="hidden text-xs text-muted-foreground sm:block">CV adaptado para cada puesto</p></div><Button onClick={() => navigate({ to: subscribed ? "/jobs", search: { selection: "true" } : "/upgrade" })}>Aplicar a {eligible} trabajos</Button></div></div>
  </div>;
}
