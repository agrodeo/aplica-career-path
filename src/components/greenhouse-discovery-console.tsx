import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getDiscoveryHealth,
  syncAllGreenhouseBoards,
  syncGreenhouseBoard,
} from "@/lib/discovery.functions";

export function GreenhouseDiscoveryConsole() {
  const queryClient = useQueryClient();
  const [companyName, setCompanyName] = useState("");
  const [boardToken, setBoardToken] = useState("");
  const [careersUrl, setCareersUrl] = useState("");

  const syncBoard = useServerFn(syncGreenhouseBoard);
  const syncAll = useServerFn(syncAllGreenhouseBoards);
  const fetchHealth = useServerFn(getDiscoveryHealth);

  const health = useQuery({
    queryKey: ["discovery-health"],
    queryFn: () => fetchHealth(),
    refetchInterval: 30_000,
  });

  const mutation = useMutation({
    mutationFn: () =>
      syncBoard({
        data: {
          companyName,
          boardToken,
          careersUrl: careersUrl.trim() || undefined,
        },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["discovery-health"] });
    },
  });

  const syncAllMutation = useMutation({
    mutationFn: () => syncAll(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["discovery-health"] });
    },
  });

  return (
    <section className="mt-12">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h2 className="text-xl font-medium">Inventario Greenhouse</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Los boards registrados se vuelven a sincronizar automáticamente. Una
            vacante que desaparece del board se desactiva y los formularios
            vencidos se vuelven a inspeccionar.
          </p>
        </div>
        <Button
          variant="outline"
          disabled={syncAllMutation.isPending}
          onClick={() => syncAllMutation.mutate()}
        >
          <RefreshCw
            className={
              syncAllMutation.isPending ? "h-4 w-4 animate-spin" : "h-4 w-4"
            }
          />
          {syncAllMutation.isPending
            ? "Actualizando inventario…"
            : "Actualizar todos ahora"}
        </Button>
      </div>

      {syncAllMutation.data && (
        <div className="mt-5 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4">
          <Result
            label="Boards sincronizados"
            value={syncAllMutation.data.succeeded}
          />
          <Result
            label="Vacantes leídas"
            value={syncAllMutation.data.discovered}
          />
          <Result
            label="Vacantes cerradas"
            value={syncAllMutation.data.deactivated}
          />
          <Result
            label="Formularios a revisar"
            value={syncAllMutation.data.inspectionsQueued}
          />
        </div>
      )}

      {syncAllMutation.error && (
        <p className="mt-3 text-sm text-destructive">
          {syncAllMutation.error.message}
        </p>
      )}

      <div className="mt-7 border-t border-border">
        {(health.data ?? []).map((source) => (
          <div
            key={source.id}
            className="grid gap-2 border-b border-border py-4 text-sm md:grid-cols-[minmax(0,1fr)_110px_160px_100px]"
          >
            <div>
              <p className="font-medium">{source.name}</p>
              {source.lastSyncError && (
                <p className="mt-1 text-xs text-destructive">
                  {source.lastSyncError}
                </p>
              )}
            </div>
            <span
              className={
                source.lastSyncStatus === "success"
                  ? "text-xs font-medium text-success"
                  : source.lastSyncStatus === "failed"
                    ? "text-xs font-medium text-destructive"
                    : "text-xs font-medium text-muted-foreground"
              }
            >
              {source.lastSyncStatus}
            </span>
            <span className="text-xs text-muted-foreground">
              {source.lastSyncedAt
                ? new Date(source.lastSyncedAt).toLocaleString("es-AR")
                : "Nunca sincronizado"}
            </span>
            <span className="text-xs text-muted-foreground">
              {source.lastJobCount} vacantes
            </span>
          </div>
        ))}
      </div>

      <div className="mt-9 rounded-xl border border-border bg-surface p-5">
        <h3 className="text-sm font-medium">Agregar otro board</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="text-sm font-medium">
            Empresa
            <Input
              className="mt-2"
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              placeholder="Nombre de la empresa"
            />
          </label>
          <label className="text-sm font-medium">
            Board token
            <Input
              className="mt-2"
              value={boardToken}
              onChange={(event) => setBoardToken(event.target.value)}
              placeholder="token-del-board"
            />
          </label>
          <label className="text-sm font-medium">
            Careers URL opcional
            <Input
              className="mt-2"
              value={careersUrl}
              onChange={(event) => setCareersUrl(event.target.value)}
              placeholder="https://empresa.com/careers"
            />
          </label>
        </div>

        <Button
          className="mt-4"
          disabled={
            mutation.isPending || !companyName.trim() || !boardToken.trim()
          }
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? "Sincronizando…" : "Agregar y sincronizar"}
        </Button>

        {mutation.error && (
          <p className="mt-3 text-sm text-destructive">
            {mutation.error.message}
          </p>
        )}

        {mutation.data && (
          <div className="mt-5 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3">
            <Result
              label="Vacantes descubiertas"
              value={mutation.data.discovered}
            />
            <Result
              label="Inspecciones en cola"
              value={mutation.data.inspectionsQueued}
            />
            <Result
              label="Vacantes desactivadas"
              value={mutation.data.deactivated}
            />
          </div>
        )}
      </div>
    </section>
  );
}

function Result({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-background p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-medium">{value}</p>
    </div>
  );
}
