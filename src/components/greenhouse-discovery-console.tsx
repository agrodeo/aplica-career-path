import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  syncAllJobBoards,
  syncJobBoardUrl,
} from "@/lib/discovery.functions";

export function JobDiscoveryConsole() {
  const [companyName, setCompanyName] = useState("");
  const [boardUrl, setBoardUrl] = useState("");
  const syncBoard = useServerFn(syncJobBoardUrl);
  const syncAll = useServerFn(syncAllJobBoards);

  const mutation = useMutation({
    mutationFn: () =>
      syncBoard({
        data: {
          url: boardUrl,
          companyName: companyName.trim() || undefined,
        },
      }),
  });

  const syncAllMutation = useMutation({
    mutationFn: () => syncAll(),
  });

  return (
    <section className="mt-12">
      <h2 className="text-xl font-medium">Descubrimiento de trabajos</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
        Pegá un careers board público de Greenhouse, Lever, Ashby o Workday. Aplica
        detecta el ATS, normaliza las vacantes y después las mantiene frescas
        automáticamente. Discovery no implica Auto Apply: una vacante sólo se
        envía sola cuando existe un adaptador verificado para ese formulario.
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
          El endpoint programable sigue siendo /api/cron/sync-jobs.
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
          {syncAllMutation.data.deactivated} bajas detectadas ·{" "}
          {syncAllMutation.data.inspectionsQueued} inspecciones Auto Apply.
        </p>
      )}

      <div className="mt-5 grid gap-3 md:grid-cols-[1fr_2fr]">
        <label className="text-sm font-medium">
          Empresa opcional
          <Input
            className="mt-2"
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            placeholder="Acme"
          />
        </label>
        <label className="text-sm font-medium">
          URL del careers board
          <Input
            className="mt-2"
            value={boardUrl}
            onChange={(event) => setBoardUrl(event.target.value)}
            placeholder="https://jobs.ashbyhq.com/acme"
          />
        </label>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        Ejemplos compatibles: job-boards.greenhouse.io/acme · jobs.lever.co/acme
        · jobs.ashbyhq.com/acme · acme.wd5.myworkdayjobs.com/en-US/External
      </p>

      <Button
        className="mt-4"
        disabled={mutation.isPending || !boardUrl.trim()}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? "Sincronizando…" : "Registrar y sincronizar"}
      </Button>

      {mutation.error && (
        <p className="mt-3 text-sm text-destructive">
          {mutation.error.message}
        </p>
      )}

      {mutation.data && (
        <div className="mt-5 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4">
          <Result label="ATS" value={mutation.data.provider} />
          <Result label="Vacantes" value={mutation.data.discovered} />
          <Result label="Inspecciones" value={mutation.data.inspectionsQueued} />
          <Result label="Bajas" value={mutation.data.deactivated} />
        </div>
      )}
    </section>
  );
}

export const GreenhouseDiscoveryConsole = JobDiscoveryConsole;

function Result({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="bg-background p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-medium">{value}</p>
    </div>
  );
}
