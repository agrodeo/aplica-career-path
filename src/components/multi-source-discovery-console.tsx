import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  syncAllRegisteredJobSources,
  syncDetectedJobBoard,
} from "@/lib/discovery.functions";

export function MultiSourceDiscoveryConsole() {
  const [companyName, setCompanyName] = useState("");
  const [careersUrl, setCareersUrl] = useState("");
  const syncBoard = useServerFn(syncDetectedJobBoard);
  const syncAll = useServerFn(syncAllRegisteredJobSources);

  const mutation = useMutation({
    mutationFn: () =>
      syncBoard({
        data: {
          companyName,
          careersUrl,
        },
      }),
  });

  const syncAllMutation = useMutation({
    mutationFn: () => syncAll(),
  });

  return (
    <section className="mt-12">
      <h2 className="text-xl font-medium">Descubrimiento de vacantes</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
        Pegá un job board público de Greenhouse, Lever, Ashby, SmartRecruiters, Workable o Workday. Aplica detecta
        el ATS, registra la fuente y sincroniza las vacantes activas. Discovery
        no implica Auto Apply: cada formulario se habilita por separado.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          disabled={syncAllMutation.isPending}
          onClick={() => syncAllMutation.mutate()}
        >
          {syncAllMutation.isPending
            ? "Actualizando inventario…"
            : "Actualizar todas las fuentes"}
        </Button>
        <span className="text-xs text-muted-foreground">
          Cron: /api/cron/sync-jobs
        </span>
      </div>

      {syncAllMutation.error && (
        <p className="mt-3 text-sm text-destructive">
          {syncAllMutation.error.message}
        </p>
      )}

      {syncAllMutation.data && (
        <p className="mt-3 text-sm text-muted-foreground">
          {syncAllMutation.data.successful} fuentes actualizadas ·{" "}
          {syncAllMutation.data.discovered} vacantes leídas ·{" "}
          {syncAllMutation.data.deactivated} bajas detectadas.
        </p>
      )}

      <div className="mt-5 grid gap-3 md:grid-cols-[0.8fr_1.4fr]">
        <label className="text-sm font-medium">
          Empresa
          <Input
            className="mt-2"
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            placeholder="Ramp"
          />
        </label>
        <label className="text-sm font-medium">
          Job board
          <Input
            className="mt-2"
            value={careersUrl}
            onChange={(event) => setCareersUrl(event.target.value)}
            placeholder="https://jobs.ashbyhq.com/ramp"
          />
        </label>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        Ejemplos: job-boards.greenhouse.io/empresa · jobs.lever.co/empresa ·
        jobs.ashbyhq.com/empresa
      </p>

      <Button
        className="mt-4"
        disabled={
          mutation.isPending ||
          !companyName.trim() ||
          !careersUrl.trim()
        }
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? "Sincronizando…" : "Detectar y sincronizar"}
      </Button>

      {mutation.error && (
        <p className="mt-3 text-sm text-destructive">
          {mutation.error.message}
        </p>
      )}

      {mutation.data && (
        <div className="mt-5 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4">
          <Result label="ATS" value={mutation.data.atsType} />
          <Result label="Identificador" value={mutation.data.identifier} />
          <Result label="Vacantes" value={mutation.data.discovered} />
          <Result label="Bajas" value={mutation.data.deactivated} />
        </div>
      )}
    </section>
  );
}

function Result({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-background p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-medium">{value}</p>
    </div>
  );
}
