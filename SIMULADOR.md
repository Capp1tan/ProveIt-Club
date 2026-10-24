# Simulador local — v3.11.1

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

## Resultados, podio y personalización

- Al tocar un rival se abre una confirmación con su nombre, el oponente y el encuentro. No se guarda una victoria por el mero clic; cancelar o Escape conserva todo.
- El podio admite uno, dos o tres puestos, limitado por el número de rivales. En eliminación directa con tres puestos se añade el partido por el tercero (un pase libre puede resolverlo automáticamente con tres rivales). En doble eliminación, el tercero es quien pierde la última ronda inferior.
- Round Robin deriva puestos de victorias. Si hay empate en un puesto mostrado, permite ordenar sólo entre quienes empataron, exige rivales distintos y un criterio escrito. No se usa el nombre como criterio deportivo de desempate.
- En prueba compartida se seleccionan las posiciones manualmente. En suizo no se permite declarar podio de torneo con sólo la primera ronda.
- El podio requiere una confirmación separada y no promete premios. Puede reabrirse; corregir resultados también lo reabre.
- En un encuentro ya terminado, tocar al otro rival ofrece una corrección. Se enumeran los resultados posteriores dependientes que se anularían; los encuentros independientes se conservan. Los pases libres y el eventual reinicio de gran final se recalculan.
- La distribución personalizada acepta comas y guiones (incluidos guiones largos), además de `x`, `v`, `×`, `+` y punto y coma. Con siete jugadores, `5-2`, `5–2` y `5, 2` significan cinco contra dos. Exige al menos dos tamaños enteros positivos que sumen exactamente el total. No se interpreta el guion como resta ni se inventa un reparto N−1 / 1.
- Antes de jugar, una entrada válida se aplica después de una breve pausa al escribir. Si hay resultados, permanece pendiente hasta pulsar Aplicar distribución y confirmar el reinicio. La validación aparece junto al campo. Las confirmaciones, el inicio, los resultados y el podio quedan bloqueados mientras haya cambios pendientes; la llave previa se oculta. Cada grupo es una unidad de competencia con nombres e integrantes ficticios editables.
- Las reglas son texto descriptivo: no hay un motor que ejecute condiciones, vidas, handicaps o puntuaciones arbitrarias. Las llaves usan los formatos disponibles, incluso si los tamaños son diferentes. Crear grafos de encuentros completamente libres sigue fuera de alcance.
- Cambiar configuración con resultados exige confirmar el reinicio. El historial es local y temporal, y se muestran sus últimos cien eventos. Una simulación masiva registra una acción de lote, no un evento individual por cada resultado aleatorio.

## Límites de producción

`src/tournament-demo.js` importa únicamente el catálogo de formatos. No usa clientes de AWS, cuentas, pagos, notificaciones, torneos, mensajes, ligas ni almacenamiento remoto. No añade bots al directorio real ni acepta identificadores ficticios en el backend. Los cambios viven en memoria de esa página y se pierden al recargar.

Los torneos reales todavía son individuales. La simulación por equipos permite revisar su diseño antes de implementar equipos persistentes, sus miembros/capitanes, invitaciones y ganadores por equipo. El simulador no implica que esos elementos ya estén disponibles en producción.

## Correcciones de creación incluidas

Se retiró el texto visible de borrador, conservando el guardado interno por cuenta. El bloqueo de una publicación preparada ya no desactiva la navegación entre etapas. Los datos de una solicitud preparada siguen inmutables para evitar cobrar/publicar una configuración distinta con el mismo ID. Una acción explícita permite usar los datos como punto de partida de otro torneo con ID nuevo, sin borrar, cancelar ni reembolsar la solicitud anterior.

Archivos: `src/tournament-demo.js` (lógica local), `tournament-demo.css` (estilos), `simular-torneo.html` (controles y panel), `src/tournament-create.js` (corrección del bloqueo y enlaces).
