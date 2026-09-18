import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { syncGreenhouseBoard } from "@/lib/discovery.functions";

export function GreenhouseDiscoveryConsole() {
  const [companyName, setCompanyName] = useState("");
  const [boardToken, setBoardToken] = useState("");
  const [careersUrl, setCareersUrl] = useState("");
  const syncBoard = useServerFn(syncGreenhouseBoard);

  const mutation = useMutation({
    mutationFn: () =>
      syncBoard({
        data: {
          companyName,
          boardToken,
          careersUrl: careersUrl.trim() || undefined,
        },
      }),
  });

  return (
    <section className="mt-12">
      <h2 className="text-xl font-medium">Descubrimiento Greenhouse</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
        Registrá un board público de Greenhouse. Aplica importa sus vacantes y
        encola una inspección del formulario antes de mostrar cualquier puesto
        como Auto Apply.
      </p>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <label className="text-sm font-medium">
          Empresa
          <Input
            className="mt-2"
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            placeholder="Acme"
          />
        </label>
        <label className="text-sm font-medium">
          Board token
          <Input
            className="mt-2"
            value={boardToken}
            onChange={(event) => setBoardToken(event.target.value)}
            placeholder="acme"
          />
        </label>
        <label className="text-sm font-medium">
          Careers URL opcional
          <Input
            className="mt-2"
            value={careersUrl}
            onChange={(event) => setCareersUrl(event.target.value)}
            placeholder="https://acme.com/careers"
          />
        </label>
      </div>

      <Button
        className="mt-4"
        disabled={
          mutation.isPending ||
          !companyName.trim() ||
          !boardToken.trim()
        }
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? "Sincronizando…" : "Sincronizar board"}
      </Button>

      {mutation.error && (
        <p className="mt-3 text-sm text-destructive">
          {mutation.error.message}
        </p>
      )}

      {mutation.data && (
        <div className="mt-5 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3">
          <Result label="Vacantes descubiertas" value={mutation.data.discovered} />
          <Result label="Inspecciones en cola" value={mutation.data.inspectionsQueued} />
          <Result label="Vacantes desactivadas" value={mutation.data.deactivated} />
        </div>
      )}
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
