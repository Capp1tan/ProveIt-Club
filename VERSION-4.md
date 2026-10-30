# ProveIt Club 4.0.0

## Flujo de una competencia nueva

1. El organizador elige reglas, fecha, invitados y, si corresponde, premio y jueces.
2. Cada persona acepta los términos de su cargo. Los jugadores completan el pago de su inscripción; los jueces no pagan salvo que compitan.
3. Al llegar la fecha programada, cada jugador pulsa **Estoy listo para jugar**. Inscribirse no confirma presencia.
4. El último jugador listo dispara un único sorteo criptográfico del servidor. La animación muestra el sorteo ya guardado; recargar no cambia los rivales.
5. Comienza una cuenta regresiva de dos minutos. Cancelar una asistencia la detiene; volver a completarla reinicia los dos minutos.
6. Antes de comenzar, el organizador puede intercambiar dos posiciones con un motivo. El orden original y los rivales quedan consultables. La cuenta se detiene y cada afectado debe aceptar la versión actual del cambio.
7. Una vez iniciado, la llave y las condiciones quedan bloqueadas. El árbitro acordado registra el resultado como antes. La sala conserva su cierre automático posterior.

## Perfil y privacidad

El país se almacena en PrivateAccount, no en el directorio público. Teléfono/correo mantienen sus permisos actuales. La zona del evento se obtiene de Intl.DateTimeFormat sin pedir ubicación GPS, y se persiste en UTC más identificador IANA; el país no se usa para adivinar horarios en países con varios husos.

Todo usuario puede recibir una invitación como juez. Eso no permite resolver torneos ajenos ni saltear la aceptación del cargo. El rol interno CREATOR conserva sus permisos y se muestra como Fundador.

## Premios

Nombre, imagen opcional y responsable de entrega. El estado PENDING nunca se presenta como premio disponible. La declaración CONFIRMED corresponde al responsable y no implica custodia de ProveIt. Cambiar el premio requiere nueva aceptación y conserva pagos acreditados. Las nuevas imágenes de creación usan el mismo upload validado, limitado y privado que las portadas; las posteriores se validan con los permisos del juez u organizador en S3.

## Datos y seguridad

Tournament añade competitionVersion y competitionState; la auditoría, asistencia y reloj se escriben en Lambda con control optimista membershipRevision. Las señales WebSocket publican sólo id/estado/fecha, nunca correos, teléfonos, recibos o credenciales. Para compatibilidad se conservan argumentos y campos de premios antiguos, aunque la interfaz nueva ya no los solicita.

No se eliminaron torneos ni se modificaron cargos monetarios o la configuración de Mercado Pago. Los torneos previos siguen su flujo anterior. Los honorarios de jueces siguen pendientes.

## Comprobación

- npm run build
- npm run test:entry (AWS y Mercado Pago simulados; sin red)
- npm run test:room
- npm run test:competition (sorteo, revisión, asistencia, permisos, plazos y trazabilidad)

Antes de anunciarlo a usuarios, probar con dos cuentas reales un torneo nuevo y comprobar aceptar/pagar, confirmar asistencia, cancelar/reconfirmar, aceptar un intercambio y registrar el resultado al terminar la cuenta. La comprobación visual automática del navegador quedó bloqueada por la herramienta de control; no debe considerarse realizada.
