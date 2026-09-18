# Aplica roadmap

## Producto visual (listo)
- [x] Sistema visual, navegación, portada, onboarding, resultados, upgrade, aplicaciones, perfil
- [x] Demostración automática del producto en la portada y cobertura de empresas
- [x] Lectura real del CV (PDF/Word) con autocompletado editable

## Arquitectura Auto Apply
- [x] Fase 1 — Base de datos: perfil maestro, preferencias, respuestas verificadas, empresas, fuentes, trabajos, esquemas de aplicación, matches, cola, tandas, intentos, créditos, planes, consentimiento, auditoría, snapshots, roles
- [x] Fase 1 — Funciones de cola con bloqueo atómico (enqueue/claim/complete/retry/fail) y crédito consumido sólo al verificar
- [x] Fase 2 — Generación de CV por puesto con validación de veracidad contra el perfil maestro (plantilla ATS de una columna)
- [x] Fase 3 — Interfaces de adaptadores, registro de capacidades y contrato del worker externo (`docs/auto-apply-worker.md`)
- [x] Fase 5 — Página de progreso en vivo de la tanda (`/applying`) con actualizaciones en tiempo real
- [x] Fase 6 — Panel interno `/admin` con elegibilidad, envíos verificados y salud de adaptadores
- [ ] Fase 2 — Conversión HTML→PDF y almacenamiento del CV generado (lo hace el worker externo)
- [ ] Fase 3 — Worker externo desplegado (Railway/Fly/Render) consumiendo el contrato
- [ ] Fase 4 — Primera integración real de ATS con envío + verificación autorizados
- [ ] Fase 4 — Servicio de descubrimiento de vacantes y detección de elegibilidad
- [ ] Fase 6 — Cobro real de planes y notificaciones por WhatsApp/email
- [ ] Conectar las pantallas actuales de onboarding/resultados a los datos reales (hoy siguen con datos de demostración)
