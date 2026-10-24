# Simulador local — v3.9.1

Entrada: `simular-torneo.html`. Se puede abrir desde la cabecera de la creación real o desde la segunda etapa.

## Qué permite

- Llenar automáticamente de 2 a 16 jugadores o equipos ficticios.
- Ver individuales, 2v2, 3v3, 4v4 y 5v5. En equipos, cada casillero representa al equipo completo y muestra su alineación. Para ocho jugadores en un 4v4, elegí dos equipos de cuatro o el ejemplo rápido «Partido 4v4 · 8 jugadores».
- Cambiar nombres de jugadores y equipos. Los cambios se reflejan sin perder los resultados de esa prueba.
- Mezclar cruces, simular confirmaciones una por una o todas juntas y adelantar el inicio.
- Elegir ganadores en cada encuentro, simular un resultado al azar o completar la prueba entera.
- Explorar eliminación directa, doble eliminación con llave inferior/reinicio de final, Round Robin, duelo y prueba compartida. Suizo conserva sólo la primera ronda, explícitamente indicada.
- Consultar una tabla de resultados ficticios.

## Separación de la producción

`src/tournament-demo.js` importa únicamente el catálogo de formatos. No usa clientes de AWS, cuentas, pagos, notificaciones, torneos, mensajes, ligas ni almacenamiento remoto. No añade bots al directorio real ni acepta identificadores ficticios en el backend. Los cambios viven en memoria de esa página y se pierden al recargar.

Los torneos reales todavía son individuales. La simulación por equipos permite revisar su diseño antes de implementar equipos persistentes, sus miembros/capitanes, invitaciones y ganadores por equipo. El simulador no implica que esos elementos ya estén disponibles en producción.

## Correcciones de creación incluidas

Se retiró el texto visible de borrador, conservando el guardado interno por cuenta. El bloqueo de una publicación preparada ya no desactiva la navegación entre etapas. Los datos de una solicitud preparada siguen inmutables para evitar cobrar/publicar una configuración distinta con el mismo ID. Una acción explícita permite usar los datos como punto de partida de otro torneo con ID nuevo, sin borrar, cancelar ni reembolsar la solicitud anterior.

Archivos: `src/tournament-demo.js` (lógica local), `tournament-demo.css` (estilos), `simular-torneo.html` (controles y panel), `src/tournament-create.js` (corrección del bloqueo y enlaces).
