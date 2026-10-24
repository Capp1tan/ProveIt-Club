# Sala de espera — v3.12.0

## Entrada y navegación

`simular-torneo.html` abre la sala oscura basada en el boceto A. Configurar simulación abre el formulario existente; Volver a la sala regresa sin perder la prueba. Ver modelo de llaves abre los resultados; iniciar también lleva a esa vista.

Para ver equipos 5v5, abrir Configurar simulación, elegir Partido 5v5, editar nombres si se desea y volver a la sala. Los nombres de equipo y de integrantes aparecen en la sala y en las llaves. El lápiz del encabezado de un equipo lleva al campo correspondiente de configuración.

## Asistencia

Cada integrante tiene estado pendiente, confirmado o no asiste. Los contadores de sala cuentan personas, mientras las llaves siguen contando equipos o individuos. Un equipo sólo queda confirmado cuando todos sus integrantes están confirmados.

La sala se mira desde un jugador ficticio, señalado con Vos; Confirmar mi asistencia cambia sólo a ese jugador. Una vez confirmado, el botón muestra Asistencia confirmada. No podré asistir permite volver al estado no asiste, con confirmación; puede revertirse confirmando antes del inicio.

Opciones de la sala y controles de simulación permite cambiar el jugador desde el que se mira, mostrar selectores de estado en las tarjetas, confirmar al siguiente o a todos e iniciar. La asistencia queda bloqueada al iniciar. Si la configuración tiene cambios pendientes o inválidos, también queda bloqueada, como en el formulario.

## Datos ilustrativos

El nombre, premio, aportante y juez se editan en las opciones de esta sala local. El premio comienza sin definir; si se escribe uno, se identifica como Premio de ejemplo. Un nombre de juez se etiqueta como ficticio, no como una aceptación real de cargo. No se asignan verificaciones, ligas ni fotos reales a los bots.

El contador usa el horario de ejemplo ya existente, cinco minutos desde la configuración. Es orientativo: no expulsa jugadores, no crea reservas y no inicia automáticamente. Al llegar a cero explica que se espera a las confirmaciones. Un sistema real de cierre, reemplazos y sanciones requiere reglas y backend adicionales.

## Implementación

- `src/tournament-waiting-room.js`: componente de presentación basado en datos y callbacks; sin AWS, pagos ni autenticación.
- `tournament-waiting-room.css`: estilos de cristal oscuro, estados, foco, disposición adaptable y versión sin transparencias.
- `src/tournament-demo.js`: adapta la asistencia por persona al estado de cada unidad de la llave y conserva el motor de resultados, correcciones y podio.
- `simular-torneo.html`: alterna sala, configuración y resultados sin navegación ni recarga.

Usa el fondo WebP ya existente del sitio y avatares locales con iniciales. Los datos viven en memoria y se pierden al recargar. Esta versión no modifica torneos reales, perfiles, permisos, cobros o infraestructura. La publicación real por equipos y la sala conectada a confirmaciones de cuentas reales siguen pendientes.
