# Diseño y sala real — 3.14.0

## Tema compartido

`public/theme-init.js` se carga en la cabecera de las nueve entradas HTML antes de dibujar el contenido. Guarda la preferencia `proveit:theme` en localStorage; ante almacenamiento bloqueado el cambio funciona en la página actual. El valor predeterminado es claro. Un evento storage mantiene las pestañas sincronizadas. El botón tiene foco visible, nombre accesible, icono sol/luna y estado aria-pressed; funciona sin sesión y sin Amplify.

`site-theme.css` centraliza los colores, sustituye el paisaje por un fondo liso y adapta controles anteriores mediante variables compartidas. El alias --green permite mantener los componentes existentes usando el nuevo azul. Los colores propios de las insignias y las fotografías no se transforman con filtros.

## Creación

La primera etapa sólo muestra datos del desafío y si habrá premio/juez, sin adelantar invitados o premios inventados. La segunda permite seleccionar cuentas reales, formato y fecha, y proponer categoría, título o importe con moneda, descripción, responsable y aportante del premio. El backend valida longitudes y categoría y lo publica siempre como pendiente. Sólo el responsable autorizado puede confirmar las condiciones desde la sala, con las reglas de nueva aceptación existentes. Los adjuntos se mantienen en el editor autorizado posterior a publicar.

## Sala real

`src/tournament-real-lobby.js` usa las identidades y estados del torneo recibido de AWS. El círculo cuenta participantes; las aceptaciones de jueces se muestran aparte y también bloquean el sorteo mientras falten. Los filtros no escriben datos. No hay botones que confirmen a otros jugadores ni identidades simuladas. El reloj es orientativo y no expulsa personas ni inicia partidos por sí solo.

La aceptación desde la sala vuelve a consultar las invitaciones privadas del usuario y responde sólo a las de ese torneo y versión de condiciones. Un usuario con dos cargos acepta ambos expresamente. El servidor sigue controlando destinatario, revisión, teléfono y permisos. No se permite cancelar una aceptación ya registrada desde la vista: se conserva la semántica del backend. Las señales WebSocket y la lectura de respaldo existentes actualizan la sala.

Los torneos antiguos sin categoría de premio usan un icono genérico; no se interpreta su texto para inventar una categoría. Una propuesta pendiente no se anuncia como premio disponible. El bloque del premio aclara quién entrega/financia y que ProveIt no lo custodia.

## Alcance y operación

La sala de cuentas reales deja de depender del simulador. El simulador sigue como herramienta opcional para probar repartos y resultados sin afectar datos. Esta versión no añade publicación real por equipos personalizados ni resultados individuales para cada cruce: conserva los formatos y capacidades del motor real existente. No crea cuentas o torneos ficticios ni realiza cobros durante la verificación.

El despliegue usa el pipeline de Amplify existente, con cambios opcionales de esquema y funciones ya existentes. No crea servicios nuevos ni cambia el precio de creación de torneos.
