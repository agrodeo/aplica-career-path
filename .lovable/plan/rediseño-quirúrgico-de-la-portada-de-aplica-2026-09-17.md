# Rediseño quirúrgico de la portada de Aplica

## Objetivo
Convertir únicamente `/` en una experiencia de búsqueda laboral inmediata y premium, sin tocar rutas, autenticación, onboarding, datos ni el resto de la aplicación.

## Cambios
- Crear una navegación mínima, sin divisor, con `aplica.` a la izquierda y accesos existentes a la derecha.
- Reemplazar la portada actual por el título corto “Encontrá el trabajo correcto.” y un buscador dominante.
- Incluir campos de puesto, ubicación y modalidad, más filtros secundarios compactos.
- Al buscar, conservar puesto, ubicación y modalidad en el estado existente y continuar hacia `/onboarding`.
- Crear un “campo de oportunidades” original en la mitad inferior: fragmentos ficticios claramente visuales, con profundidad, desenfoque progresivo y movimiento máximo de 3–5 px.
- Adaptar la composición para móvil como una experiencia compacta y táctil.
- Eliminar de la portada el fondo de nodos, la estructura SaaS, el texto promocional, la confianza y la sección de tres características.

## Detalles técnicos
- Cambios limitados a la portada, su componente visual, estilos globales necesarios y campos opcionales del estado local.
- Mantener los componentes, rutas y flujos ya existentes fuera de `/`.
- Usar tokens semánticos para blanco, negro, gris, borde y azul.
- Mantener los metadatos específicos de la portada.

## Validación
- Probar búsqueda y navegación a onboarding.
- Revisar escritorio y móvil, incluyendo foco, menús, movimiento sutil, desbordes y consola.
