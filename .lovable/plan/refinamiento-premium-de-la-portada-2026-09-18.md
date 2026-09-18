# Refinamiento premium de la portada

## Objetivo
Refinar únicamente la portada actual para que se sienta más premium, editorial y equilibrada, conservando exactamente su estructura, contenido, navegación, buscador, filtros y comportamiento.

## Cambios
- Subir ligeramente el conjunto de título, buscador y filtros para reducir el vacío superior.
- Ajustar la tipografía del título, navegación, campos, botón principal y filtros según las medidas indicadas.
- Reforzar el buscador como objeto principal con borde, sombra, radios y separadores más precisos.
- Eliminar por completo el bloque borroso rectangular del centro.
- Reconstruir solo la atmósfera inferior como un campo continuo de profundidad blanco-azul, sin cortes ni contenedores visibles.
- Añadir capas orgánicas de niebla, textura, líneas delicadas y entre 3 y 5 fragmentos de información parcialmente legibles.
- Mantener el movimiento de profundidad en 2, 4 y 6 px, con soporte para movimiento reducido.
- Conservar el lienzo a pantalla completa sin marco exterior.

## Detalles técnicos
- Cambios limitados a `src/routes/index.tsx`, `src/components/opportunity-field.tsx` y los estilos específicos de la portada.
- Usar los tokens semánticos actuales, ajustándolos solo donde sea necesario para reproducir la paleta y sombras solicitadas.
- No modificar estado, rutas, formularios, autenticación, onboarding ni otras pantallas.

## Validación
- Verificar escritorio y móvil, jerarquía vertical, ausencia de bloques rectangulares, cortes, solapamientos y desbordes.
- Confirmar que el buscador conserva valores y continúa hacia onboarding.
- Revisar interacción del mouse, movimiento reducido y consola sin errores.
