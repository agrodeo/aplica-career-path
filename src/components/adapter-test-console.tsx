import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listInspections, requestInspection } from "@/lib/inspections.functions";
import { cn } from "@/lib/utils";

type Field = { label?: string; canonicalKey?: string | null; type?: string; required?: boolean };

/** Admin-only console: inspect a public application URL, or run a dry run. */
export function AdapterTestConsole() {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const enqueue = useServerFn(requestInspection);
  const fetchInspections = useServerFn(listInspections);

  const { data: inspections, refetch } = useQuery({
    queryKey: ["adapter-inspections"],
    queryFn: () => fetchInspections(),
    refetchInterval: 5000,
  });

  const mutation = useMutation({
    mutationFn: (mode: "inspect" | "dry_run") => enqueue({ data: { url, mode } }),
    onSuccess: () => {
      setError(null);
      void refetch();
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  });

  return (
    <section className="mt-12">
      <h2 className="text-xl font-medium">Consola de adaptadores</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Pegá la URL pública de una postulación. La revisión la ejecuta el servicio de envío con un navegador real, así que el resultado aparece cuando ese servicio está corriendo.
      </p>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <Input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://job-boards.greenhouse.io/empresa/jobs/123456" className="flex-1" />
        <Button onClick={() => mutation.mutate("inspect")} disabled={!url || mutation.isPending}>
          Revisar
        </Button>
        <Button variant="outline" onClick={() => mutation.mutate("dry_run")} disabled={!url || mutation.isPending}>
          Prueba sin enviar
        </Button>
      </div>
      {error && <p className="mt-3 text-sm text-caution">{error}</p>}

      <div className="mt-8 border-t border-border">
        {(inspections ?? []).map((inspection) => (
          <article key={inspection.id} className="border-b border-border py-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="break-all text-sm font-medium">{inspection.url}</p>
              <span
                className={cn(
                  "text-xs font-medium",
                  inspection.status === "completed" ? (inspection.auto_apply_eligible ? "text-primary" : "text-caution") : inspection.status === "failed" ? "text-caution" : "text-muted-foreground",
                )}
              >
                {inspection.status === "queued"
                  ? "Esperando al servicio de envío"
                  : inspection.status === "running"
                    ? "Revisando"
                    : inspection.status === "failed"
                      ? `Falló · ${inspection.error_code ?? "error"}`
                      : inspection.auto_apply_eligible
                        ? "Listo para aplicar automáticamente"
                        : "No soportado"}
              </span>
            </div>

            {inspection.status === "completed" && (
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <Row label="Sistema detectado" value={inspection.ats_type ?? "—"} />
                <Row label="Adaptador" value={inspection.adapter ?? "—"} />
                <Row label="CAPTCHA" value={inspection.captcha_detected ? "Sí" : "No"} />
                <Row label="Requiere iniciar sesión" value={inspection.login_required ? "Sí" : "No"} />
                <Row label="Campos obligatorios" value={(inspection.required_fields as string[] | null)?.join(", ") || "—"} />
                <Row label="Campos reconocidos" value={((inspection.mapped_fields as Field[] | null) ?? []).map((f) => `${f.label} → ${f.canonicalKey}`).join(", ") || "—"} />
                <Row label="Campos no reconocidos" value={((inspection.unknown_fields as Field[] | null) ?? []).map((f) => f.label).join(", ") || "—"} />
                {inspection.reason && <Row label="Motivo" value={inspection.reason} />}
              </dl>
            )}
            {inspection.status === "failed" && inspection.error_message && <p className="mt-3 text-sm text-muted-foreground">{inspection.error_message}</p>}
          </article>
        ))}
        {!inspections?.length && <p className="py-10 text-sm text-muted-foreground">Todavía no hay revisiones.</p>}
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words">{value}</dd>
    </div>
  );
}
