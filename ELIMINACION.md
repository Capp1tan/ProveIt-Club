# Eliminación y permisos — 2.8.0

## Torneos

`deleteClubTournament` toma únicamente el ID. El servidor consulta `createdBySub`
y la reserva privada `creator`. Autoriza al organizador o al Creador del club.
El botón aparece en el detalle; las solicitudes pendientes tienen otro en pago.

La baja guarda `deletedAt` y `deletedBySub`, marca `DELETED` y aumenta la revisión.
Es recuperable por mantenimiento de la base: no borra recibos ni mueve dinero.
Las listas y búsquedas excluyen las bajas; las invitaciones dejan de aparecer.
Resultados, sorteos y confirmaciones comprueban la baja en el servidor y sus
condiciones de escritura. Un Webhook tardío no puede republicar un torneo retirado.

El panel del Creador permite limpiar todos los torneos visibles y sus solicitudes
pendientes, incluso vencidas, existentes al pulsar el botón. El lote se procesa
por ID y se puede reintentar. La limpieza no incluye torneos creados después del
inicio del lote. En modo TEST sólo el Creador tiene solicitudes de pago.

Un enlace externo de Mercado Pago ya abierto puede continuar accesible hasta su
vencimiento. No volver a pagarlo. No hay reembolso automático al retirar el torneo.

## Cuenta propia

La persona escribe `ELIMINAR MI CUENTA` y confirma. El SDK limpia las fotos bajo
el prefijo de su identidad autenticada con permisos IAM; si falla, no se continúa.
El servidor nunca acepta un usuario destinatario del navegador: usa el `sub`
autenticado y consulta Cognito para comprobar la identidad.

Se protege al Creador mediante su reserva privada y también mediante su correo
verificado por Cognito. La baja registra un marcador, bloquea nuevas escrituras,
retira torneos propios, abandona torneos ajenos sin resultado, elimina invitaciones,
perfiles, teléfono/reserva e insignias. Por último elimina el usuario de Cognito.
Si una fase falla, se puede retomar con la sesión actual antes de cerrar la página.

Se retienen resultados históricos con sus nombres y registros de pagos. No se
eliminan cuentas externas de Google o Mercado Pago. La baja no borra ni reembolsa
operaciones financieras. Los JWT ya emitidos pueden seguir pasando validación
criptográfica hasta vencer; las mutaciones comprueban el marcador de baja.

## Búsqueda

Historial de hasta 12 entradas en `proveit:recent-searches` del navegador. Se guarda
al pulsar Enter o abrir un resultado, y permite borrar una entrada o todas.
`proveit:hidden-search-suggestions` conserva los descartes, con opción de restablecer.
Ocultar una sugerencia no borra el torneo. No se puede borrar por JavaScript el
historial/autocompletado propio del navegador; el campo usa `autocomplete=off`.

## Comprobaciones de implementación

Compilación Vite y TypeScript del backend. No se crean cuentas desechables ni se
ejecuta una baja real de usuario como prueba automática. El Creador elimina el
lote de torneos actuales mediante el panel, por autorización expresa del usuario.
