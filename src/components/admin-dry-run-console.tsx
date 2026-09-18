import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  listAdminDryRunJobs,
  listAdminDryRuns,
  queueAdminDryRun,
} from "@/lib/admin.functions";
import { cn } from "@/lib/utils";

export function AdminDryRunConsole() {
  const queryClient = useQueryClient();
  const fetchJobs = useServerFn(listAdminDryRunJobs);
  const fetchRuns = useServerFn(listAdminDryRuns);
  const queueRun = useServerFn(queueAdminDryRun);

  const [jobId, setJobId] = useState("");

  const jobsQuery = useQuery({
    queryKey: ["admin-dry-run-jobs"],
    queryFn: () => fetchJobs(),
    refetchInterval: 60_000,
  });

  const runsQuery = useQuery({
    queryKey: ["admin-dry-runs"],
    queryFn: () => fetchRuns(),
    refetchInterval: 5_000,
  });

  const mutation = useMutation({
    mutationFn: () => queueRun({ data: { jobId } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-dry-runs"] });
    },
  });

  const jobs = jobsQuery.data ?? [];
  const selected = useMemo(
    () => jobs.find((job) => job.id === jobId) ?? null,
    [jobs, jobId],
  );

  return (
    <section className="mt-12">
      <h2 className="text-xl font-medium">Dry run con perfil real</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
        Usa tu propio Career Profile y CV, completa un formulario real y se
        detiene antes del submit final. Estos intentos están marcados como test
        en la base y no pueden consumir créditos ni convertirse en una
        postulación verificada.
      </p>

      <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
        <label className="text-sm font-medium">
          Vacante elegible
          <select
            className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={jobId}
            onChange={(event) => setJobId(event.target.value)}
          >
            <option value="">Elegí una vacante</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {[job.company, job.title, job.location]
                  .filter(Boolean)
                  .join(" · ")}
              </option>
            ))}
          </select>
        </label>

        <Button
          disabled={!jobId || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? "Encolando…" : "Correr dry run"}
        </Button>
      </div>

      {selected && (
        <div className="mt-3 rounded-lg border border-border bg-surface p-4 text-xs leading-5 text-muted-foreground">
          <span className="font-medium text-foreground">{selected.company}</span>
          {" · "}
          {selected.title}
          {" · "}
          {selected.adapter ?? selected.atsType ?? "ATS desconocido"}
        </div>
      )}

      {jobsQuery.error && (
        <p className="mt-3 text-sm text-destructive">
          No pudimos cargar vacantes: {jobsQuery.error.message}
        </p>
      )}
      {mutation.error && (
        <p className="mt-3 text-sm text-destructive">
          No pudimos encolar el dry run: {mutation.error.message}
        </p>
      )}
      {mutation.data && (
        <p className="mt-3 text-sm text-primary">
          Dry run encolado para {mutation.data.profile || "tu perfil"}. El worker
          lo va a tomar automáticamente.
        </p>
      )}

      <div className="mt-7 border-t border-border">
        {(runsQuery.data ?? []).length === 0 ? (
          <p className="py-5 text-sm text-muted-foreground">
            Todavía no hay dry runs.
          </p>
        ) : (
          (runsQuery.data ?? []).map((run) => (
            <div
              key={run.id}
              className="grid gap-2 border-b border-border py-4 md:grid-cols-[minmax(0,1fr)_150px_220px]"
            >
              <div>
                <p className="text-sm font-medium">
                  {[run.company, run.title].filter(Boolean).join(" · ")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(run.queuedAt).toLocaleString("es-AR")}
                </p>
              </div>

              <p
                className={cn(
                  "text-xs font-medium",
                  run.errorCode === "DRY_RUN_COMPLETE"
                    ? "text-success"
                    : run.status === "queued" ||
                        run.status === "preparing" ||
                        run.status === "resume_generating" ||
                        run.status === "ready" ||
                        run.status === "submitting"
                      ? "text-primary"
                      : run.status.startsWith("failed")
                        ? "text-caution"
                        : "text-muted-foreground",
                )}
              >
                {run.errorCode === "DRY_RUN_COMPLETE"
                  ? "Dry run completo ✓"
                  : run.status}
              </p>

              <p className="text-xs leading-5 text-muted-foreground">
                {run.errorCode && run.errorCode !== "DRY_RUN_COMPLETE"
                  ? \`\${run.errorCode}\${run.errorMessage ? \` · \${run.errorMessage}\` : ""}\`
                  : run.errorCode === "DRY_RUN_COMPLETE"
                    ? "Formulario completado; submit final omitido."
                    : "Esperando al worker."}
              </p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
