# Aplica roadmap

## Producto visual (listo)
- [x] Sistema visual, navegación, portada, onboarding, resultados, upgrade, aplicaciones, perfil
- [x] Demostración automática del producto en la portada y cobertura de empresas
- [x] Lectura real del CV (PDF/Word) con autocompletado editable

## Arquitectura Auto Apply
- [x] Base de datos completa: perfil maestro, preferencias, respuestas verificadas, trabajos, esquemas, matches, cola, tandas, intentos, créditos, planes, consentimiento, auditoría, snapshots, roles
- [x] Cola con reclamo atómico y crédito consumido sólo al verificar el envío
- [x] Generación de CV por puesto con validación de veracidad (plantilla ATS de una columna)
- [x] Contrato del servicio externo de envío y registro de capacidades por adaptador
- [x] Progreso en vivo de la tanda y panel interno con salud de adaptadores

## Primer envío real (milestone actual)
- [x] Servicio de envío independiente en `/worker` (Node + TypeScript + Playwright + Docker)
- [x] Adaptador de formularios públicos de Greenhouse: revisar, mapear campos, completar, subir CV, enviar, verificar
- [x] Normalización de campos a claves canónicas y regla de campo obligatorio desconocido → trabajo no soportado
- [x] Preguntas sensibles y demográficas: sólo respuestas guardadas explícitamente o "prefiero no responder"
- [x] Validación de respuestas abiertas contra el perfil maestro antes de enviar
- [x] Evidencia: captura posterior al envío y copia exacta de lo enviado, ambas privadas
- [x] Modos `WORKER_MODE` y `DRY_RUN` (producción nunca puede simular un envío exitoso)
- [x] Consola de adaptadores en `/admin` con revisión y prueba sin enviar
- [ ] Desplegar el servicio de envío (Railway/Fly/Render) y correr la primera revisión real
- [ ] Primer envío real verificado de punta a punta con un perfil real y una vacante pública
- [ ] Recién después: segundo adaptador (Lever, ya escrito pero deshabilitado)
- [ ] Servicio de descubrimiento de vacantes que marque elegibilidad automáticamente
- [ ] Cobro real de planes y notificaciones por WhatsApp/email
- [ ] Conectar onboarding y resultados a los datos reales (hoy siguen con datos de demostración)
