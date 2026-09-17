# Refinamiento atmosférico de la portada

## Objetivo
Refinar únicamente la portada existente para que sea una escena continua, premium y editorial, conservando su navegación, buscador, filtros, estado y acceso al onboarding.

## Cambios
- Mantener la estructura actual y ajustar posiciones, escala tipográfica, espaciado, borde, sombra y proporciones del buscador.
- Mejorar la navegación y el contenedor compacto de filtros sin añadir contenido nuevo.
- Eliminar por completo las tarjetas, líneas horizontales y bloques rectangulares del campo de oportunidades actual.
- Sustituirlos por una atmósfera abstracta continua: blanco en la parte superior, azul muy pálido en profundidad, niebla, trazos documentales sin contenedores y un foco vertical casi imperceptible.
- Crear tres capas de profundidad con un máximo de cuatro fragmentos legibles y movimiento de 2, 4 y 6 px, desactivado cuando el sistema solicita menos movimiento.
- Mantener la adaptación móvil sin alterar otras pantallas.

## Detalles técnicos
- Limitar los cambios a la portada, su componente decorativo y estilos globales específicos de esa portada.
- Usar los controles y tokens semánticos existentes; no modificar rutas, datos ni lógica.
- Conservar los metadatos propios de la portada.

## Validación
- Verificar escritorio y móvil, ausencia de cortes visuales, bordes exteriores, solapamientos y desbordes.
- Confirmar que la búsqueda conserva los valores y navega a onboarding.
- Revisar consola y movimiento reducido.
