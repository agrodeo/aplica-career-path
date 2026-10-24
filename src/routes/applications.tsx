import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageShell, SiteHeader } from "@/components/aplica";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getApplicationResume, listMyApplications } from "@/lib/auto-apply.supabase";
import { applicationAction, applicationStatusLabel, matchesApplicationFilter, needsAttention, type ApplicationFilter } from "@/lib/auto-apply/application-status";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/applications")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
    return { user: data.user };
  },
  head: () => ({ meta: [{ title: "Tus postulaciones — aplica" }] }),
  component: Applications,
});
const filters: ApplicationFilter[] = ["Todas", "Enviadas", "En proceso", "Necesitan atención"];
function Applications() {
  const { user } = Route.useRouteContext();
  const [filter, setFilter] = useState<ApplicationFilter>("Todas");
  const query = useQuery({ queryKey: ["my-applications", user.id], queryFn: listMyApplications, refetchInterval: 15000 });
  const applications = query.data ?? [];
  const filtered = applications.filter((a) => matchesApplicationFilter(a.status, filter));
  return <div className="min-h-screen"><SiteHeader /><PageShell>
    <h1 className="text-3xl font-medium md:text-[40px]">Tus postulaciones</h1>
    <p className="mt-3 text-sm text-muted-foreground">Sólo los envíos confirmados aparecen como enviados y consumen un crédito. Mostramos las últimas 200 postulaciones.</p>
    <div className="mt-8 flex gap-2 overflow-x-auto border-b border-border pb-3" aria-label="Filtrar postulaciones">
      {filters.map((f) => <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f} className={cn("whitespace-nowrap rounded-full px-3 py-2 text-sm", filter === f ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted")}>{f}</button>)}
    </div>
    {query.isPending ? <p role="status" className="py-12">Cargando postulaciones…</p> : query.error ? <div role="alert" className="py-12"><p>No pudimos cargar tus postulaciones: {query.error.message}</p><Button variant="outline" className="mt-4" onClick={() => void query.refetch()}>Reintentar</Button></div> : <>
      {filtered.map((a) => <ApplicationRow key={a.id} application={a} />)}
      {!filtered.length && <div className="py-16 text-center"><p>{applications.length ? "No hay postulaciones con este estado." : "Todavía no enviaste postulaciones con Aplica."}</p><Button asChild variant="outline" className="mt-5"><Link to="/jobs">Ver trabajos</Link></Button></div>}
    </>}
  </PageShell></div>;
}
function ApplicationRow({ application: a }: { application: Awaited<ReturnType<typeof listMyApplications>>[number] }) {
  const resume = useMutation({ mutationFn: () => getApplicationResume(a.id), onSuccess: (url) => { window.location.assign(url); } });
  const action = applicationAction(a.errorCode, a.status);
  const timestamp = a.verifiedAt ?? a.submittedAt ?? a.queuedAt;
  return <article className="grid gap-4 border-b border-border py-6 md:grid-cols-[1fr_220px]">
    <div><h2 className="font-medium">{a.title}</h2><p className="mt-1 text-sm text-muted-foreground">{a.company}{a.adapter ? ` · ${a.adapter.replace(/_public$/, "").replace(/^./, (c) => c.toUpperCase())}` : ""}</p>
      {timestamp && <p className="mt-2 text-xs text-muted-foreground">{new Date(timestamp).toLocaleString("es-AR")}</p>}
      {action && <p className="mt-3 max-w-2xl text-sm leading-6">{action}</p>}
      {a.reference && a.status === "verified" && <p className="mt-2 break-all text-xs text-muted-foreground">Referencia: {a.reference}</p>}
      <div className="mt-3 flex flex-wrap gap-3">
        {a.resumeVariantId && <Button variant="outline" size="sm" disabled={resume.isPending} onClick={() => resume.mutate()}>{resume.isPending ? "Abriendo CV…" : "Ver CV utilizado"}</Button>}
        {needsAttention(a.status) && a.status !== "expired" && a.applicationUrl && <Button asChild variant="outline" size="sm"><a href={a.applicationUrl} target="_blank" rel="noreferrer">Abrir formulario de la empresa</a></Button>}
        {a.errorCode === "PROFILE_INCOMPLETE" && <Button asChild variant="outline" size="sm"><Link to="/profile">Revisar perfil</Link></Button>}
      </div>
      {resume.error && <p role="alert" className="mt-3 text-sm text-destructive">{resume.error.message}</p>}
    </div>
    <p className={cn("text-sm", a.status === "verified" ? "text-primary" : needsAttention(a.status) ? "text-caution" : "text-muted-foreground")}>{applicationStatusLabel(a.status)}</p>
  </article>;
}
