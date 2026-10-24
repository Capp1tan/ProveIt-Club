# Sala de espera — v3.13.1

## Entrada y navegación

`simular-torneo.html` abre la sala oscura basada en el boceto A. Configurar simulación abre el formulario existente; Volver a la sala regresa sin perder la prueba. Ver modelo de llaves abre los resultados; iniciar también lleva a esa vista.

Para ver equipos 5v5, abrir Configurar simulación, elegir Partido 5v5, editar nombres si se desea y volver a la sala. Los nombres de equipo y de integrantes aparecen en la sala y en las llaves. El lápiz del encabezado de un equipo lleva al campo correspondiente de configuración.

## Asistencia

Cada integrante tiene estado pendiente, confirmado o no asiste. Los contadores de sala cuentan personas, mientras las llaves siguen contando equipos o individuos. Un equipo sólo queda confirmado cuando todos sus integrantes están confirmados.

La sala se mira desde un jugador de ejemplo, señalado con Vos; Confirmar mi asistencia cambia sólo a ese jugador. Una vez confirmado, el botón muestra Asistencia confirmada. No podré asistir permite volver al estado no asiste, con confirmación; puede revertirse confirmando antes del inicio.

Opciones de la sala · Simular jugadores permite cambiar el jugador desde el que se mira, mostrar selectores de estado en las tarjetas, confirmar al siguiente o a todos e iniciar. La asistencia queda bloqueada al iniciar. Si la configuración tiene cambios pendientes o inválidos, también queda bloqueada, como en el formulario.

## Datos ilustrativos

El nombre, premio, aportante y juez se editan en las opciones de esta sala local. El premio comienza sin definir; si se escribe uno, se identifica como Premio de ejemplo. Un nombre de juez se etiqueta como ficticio, no como una aceptación real de cargo. No se asignan verificaciones, ligas ni fotos reales a los jugadores de ejemplo.

El tipo de premio se elige explícitamente: sin premio, dinero, regalo sorpresa, comida/bebida, tecnología/informática, ropa/accesorios, experiencia o actividad y otro premio. Cada categoría usa un SVG local (billete, caja de regalo, cubiertos, monitor, camiseta o entrada). No se infiere la categoría de palabras o símbolos del texto. Cada categoría conserva un detalle independiente mientras la página permanece abierta; volver a dinero recupera su importe de ejemplo, pero cambiar a comida no muestra ese importe. Sin premio desactiva el detalle. Si hay categoría sin detalle, el texto indica que está por definir.

## Movimiento

El círculo conserva su nodo y su valor visual, y cambia hacia el nuevo porcentaje en 720 ms con aceleración y frenado suaves. Un cambio durante la animación parte de la posición visible actual, también al disminuir confirmaciones. El número y la etiqueta accesible muestran el dato real inmediatamente; sólo se anima el arco. El reloj no reconstruye la sala y el movimiento sólo usa requestAnimationFrame mientras cambia el progreso. Al cambiar de prueba/configuración se usa el porcentaje nuevo sin simular una variación de asistencia de la prueba anterior.

Los botones, los indicadores de estado modificados y el ícono al cambiar de categoría tienen movimiento discreto. Con prefers-reduced-motion se actualiza todo inmediatamente, sin esas animaciones. Los íconos no requieren descargas ni bibliotecas adicionales.

El contador usa el horario de ejemplo ya existente, cinco minutos desde la configuración. Es orientativo: no expulsa jugadores, no crea reservas y no inicia automáticamente. Al llegar a cero explica que se espera a las confirmaciones. Un sistema real de cierre, reemplazos y sanciones requiere reglas y backend adicionales.

## Implementación

- `src/tournament-waiting-room.js`: componente de presentación basado en datos y callbacks; sin AWS, pagos ni autenticación.
- `tournament-waiting-room.css`: estilos de cristal oscuro, estados, foco, disposición adaptable y versión sin transparencias.
- `src/tournament-demo.js`: adapta la asistencia por persona al estado de cada unidad de la llave y conserva el motor de resultados, correcciones y podio.
- `simular-torneo.html`: alterna sala, configuración y resultados sin navegación ni recarga.

Usa el fondo WebP ya existente del sitio y avatares locales con iniciales. Los datos viven en memoria y se pierden al recargar. Esta versión no modifica torneos reales, perfiles, permisos, cobros o infraestructura. La publicación real por equipos y la sala conectada a confirmaciones de cuentas reales siguen pendientes.

## Nombres de ejemplo

La simulación utiliza 64 nombres ficticios de personas, como Alex, Luna y Nico, y equipos con nombres como Equipo Norte o Equipo Sur. Los valores predeterminados se reparten sin repetir nombres entre los integrantes activos, también en distribuciones personalizadas. Los nombres de jugadores y equipos son editables y los cambios se conservan al navegar entre configuración, sala y llaves durante esa sesión. No representan cuentas reales ni jugadores automáticos.
