# Corregir el recorte del panel “1RM · Evolución”

## Diagnóstico confirmado
- El panel está en `HistoryModal`, dentro de la pantalla “Mis RM”.
- Su fondo ocupa toda la pantalla y el panel se alinea al borde inferior con `fixed inset-0`.
- El panel usa `max-height: 88vh` y `overflow: auto`, pero no reserva la altura de la navegación inferior ni el área segura del iPhone.
- La navegación inferior permanece por encima del panel mediante un `z-index` muy superior. Por eso tapa físicamente la parte final del panel.
- No hay una tarjeta interior ni un padre con `overflow: hidden` que cause este recorte; la causa es la combinación de alineación al fondo, altura basada en `vh` y barra fija superpuesta.

## Cambio mínimo
- Modificar únicamente el contenedor del panel de evolución en `src/routes/records.tsx`.
- Reservar dinámicamente debajo del panel la altura de la navegación y `env(safe-area-inset-bottom)`.
- Calcular su altura máxima con `100dvh`, descontando navegación, área segura y margen superior.
- Mantener un único scroll vertical en el cuerpo completo del panel, con desplazamiento fluido en iPhone y padding inferior suficiente.
- Mantener intactos colores, tipografías, tarjetas, navegación y lógica de RM.

## Comprobación
- Abrir “Mis RM” en un viewport móvil equivalente a iPhone y pulsar “Deadlift”.
- Confirmar que aparecen RM actual y Mejor marca.
- Desplazar el panel hasta su último elemento y medir que queda completamente por encima de la navegación inferior.
- Cerrar y volver a abrir el panel, comprobando que el listado de RM sigue funcionando.
- Revisar el resultado visible y el estado de compilación; no publicar.
