# Simulador local — v3.10.0

Entrada: `simular-torneo.html`. Se puede abrir desde la cabecera de la creación real o desde la segunda etapa.

## Qué permite

- Elegir primero el total de jugadores ficticios, de 2 a 64.
- Dividirlos en equipos del mismo tamaño, calculados a partir de los divisores del total y con al menos dos rivales. No se descartan jugadores ni se crean equipos incompletos: si un cambio de total invalida el tamaño previo, se vuelve a individual con un aviso explícito.
- Con 20 jugadores se ofrecen individual, diez equipos de dos, cinco de cuatro, cuatro de cinco o dos de diez. El ejemplo rápido 10v10 configura dos equipos de diez, con integrantes editables. Cada casillero representa al equipo completo.
- Mostrar formatos según la cantidad de rivales: enfrentamiento directo sólo para dos; eliminación simple/doble y Round Robin desde dos; suizo y prueba compartida desde tres. Son criterios de esta interfaz de demostración, no restricciones universales de esos formatos.
- Cambiar nombres de jugadores y equipos. Los cambios se reflejan sin perder los resultados de esa prueba.
- Mezclar cruces, simular confirmaciones una por una o todas juntas y adelantar el inicio.
- Elegir ganadores en cada encuentro, simular un resultado al azar o completar la prueba entera.
- Explorar eliminación directa, doble eliminación con llave inferior/reinicio de final, Round Robin, duelo y prueba compartida. Round Robin conserva todas las rondas y permite elegir cuál dibujar para evitar miles de elementos simultáneos. Suizo conserva sólo la primera ronda, explícitamente indicada.
- Consultar una tabla de resultados ficticios.

## Separación de la producción

`src/tournament-demo.js` importa únicamente el catálogo de formatos. No usa clientes de AWS, cuentas, pagos, notificaciones, torneos, mensajes, ligas ni almacenamiento remoto. No añade bots al directorio real ni acepta identificadores ficticios en el backend. Los cambios viven en memoria de esa página y se pierden al recargar.

Los torneos reales todavía son individuales. La simulación por equipos permite revisar su diseño antes de implementar equipos persistentes, sus miembros/capitanes, invitaciones y ganadores por equipo. El simulador no implica que esos elementos ya estén disponibles en producción.

## Correcciones de creación incluidas

Se retiró el texto visible de borrador, conservando el guardado interno por cuenta. El bloqueo de una publicación preparada ya no desactiva la navegación entre etapas. Los datos de una solicitud preparada siguen inmutables para evitar cobrar/publicar una configuración distinta con el mismo ID. Una acción explícita permite usar los datos como punto de partida de otro torneo con ID nuevo, sin borrar, cancelar ni reembolsar la solicitud anterior.

Archivos: `src/tournament-demo.js` (lógica local), `tournament-demo.css` (estilos), `simular-torneo.html` (controles y panel), `src/tournament-create.js` (corrección del bloqueo y enlaces).
