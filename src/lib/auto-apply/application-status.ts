export type ApplicationFilter = "Todas" | "Enviadas" | "En proceso" | "Necesitan atención";

const labels: Record<string, string> = {
  queued: "En cola", preparing: "Preparando", resume_generating: "Generando CV",
  ready: "Lista para enviar", submitting: "Enviando", submitted_unverified: "Envío sin confirmar",
  verified: "Enviada", failed_retryable: "Reintento pendiente", failed_permanent: "No se pudo enviar",
  expired: "Vacante expirada", duplicate: "Ya habías aplicado", unsupported: "Necesita atención",
};
export function applicationStatusLabel(status: string) { return labels[status] ?? "Estado pendiente de revisión"; }
export function needsAttention(status: string) {
  return ["submitted_unverified", "failed_permanent", "unsupported", "expired"].includes(status);
}
export function isInProgress(status: string) {
  return ["queued", "preparing", "resume_generating", "ready", "submitting", "failed_retryable"].includes(status);
}
export function matchesApplicationFilter(status: string, filter: ApplicationFilter) {
  return filter === "Todas" || (filter === "Enviadas" && status === "verified") ||
    (filter === "En proceso" && isInProgress(status)) || (filter === "Necesitan atención" && needsAttention(status));
}
export function applicationAction(code: string | null, status: string) {
  if (status === "verified") return null;
  if (status === "submitted_unverified" || code === "VERIFICATION_FAILED") return "No pudimos confirmar el envío. Revisá tu correo o el sitio de la empresa antes de volver a aplicar. No se descontó un crédito.";
  if (status === "failed_retryable") return "Vamos a reintentar automáticamente. Todavía no se descontó un crédito.";
  if (code === "CAPTCHA_PRESENT") return "El formulario requiere que completes un CAPTCHA. Continuá en el sitio de la empresa.";
  if (code === "LOGIN_REQUIRED") return "La empresa requiere que inicies sesión. Continuá en su sitio.";
  if (code === "PROFILE_INCOMPLETE") return "Revisá tu perfil y completá los datos que faltan. También podés continuar en el sitio de la empresa.";
  if (code === "JOB_EXPIRED" || status === "expired") return "La vacante ya no está disponible. Buscá otra oportunidad.";
  if (needsAttention(status)) return "No se confirmó una postulación. Podés revisar el formulario en el sitio de la empresa.";
  return null;
}
