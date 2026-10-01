# Secreto propio para llamar cron desde afuera

## Contexto

`LOVABLE_CRON_SECRET` existe pero es administrado por Lovable: su valor está encriptado, no se puede ver, copiar ni modificar. Por eso no puede usarse para autenticar llamadas externas (Railway, cron externo, scripts). La solución es un secreto propio con un valor que el usuario conoce y controla.

## Plan

1. **Crear el secreto `CRON_API_TOKEN`** con la herramienta de secretos.
   - El usuario genera un valor fuerte (ej. `openssl rand -hex 32`) y lo guarda en el formulario seguro.
   - El mismo valor se configura en el servicio externo que hará las llamadas (variable de entorno en Railway/Render/etc.).

2. **Autenticación en el endpoint público** (`src/routes/api/public/...`).
   - El handler lee `Authorization: Bearer <token>` y lo compara con `process.env['CRON_API_TOKEN']` usando comparación de tiempo constante (mismo patrón que `worker-auth.ts`).
   - Sin token válido → `401 Unauthorized`.

3. **Uso desde afuera**:
   ```
   curl -X POST https://project--bd0e59ea-eb97-4ba2-b7c3-f9878bca813a.lovable.app/api/public/<endpoint> \
     -H "Authorization: Bearer <CRON_API_TOKEN>"
   ```

## Notas técnicas

- No se toca `LOVABLE_CRON_SECRET` ni `src/integrations/supabase/cron-auth.ts` (autogenerado).
- El nuevo secreto queda disponible solo en código de servidor; nunca llega al navegador.
- Si ya existe un endpoint cron concreto que el usuario quiere exponer, se le agrega la verificación a ese handler; si no existe, se crea uno nuevo según lo que deba ejecutar.
