# Administración y exenciones — v3.7.0

## Dar permiso para crear torneos gratis

1. Ingresá con la cuenta de Capitán y abrí **Administración**, junto al logo.
2. En **Cuentas**, buscá a la persona y elegí **Ver cuenta**.
3. En **Creación gratuita de torneos**, activá el permiso.
4. Escribí un motivo de entre 10 y 500 caracteres y guardá.
5. La persona verá **Crear torneo gratis** al volver a abrir la creación de torneos.

El permiso es ilimitado y revocable. Para retirarlo, desmarcá la casilla y registrá otro motivo. La cuenta del Creador tiene gratuidad permanente; no necesita un permiso manual.

La pausa general de creación sigue vigente para todas las cuentas. Ser gratuito no elimina los demás requisitos: participantes, fecha, reglas y aceptaciones. El permiso sólo evita la tarifa de creación; no aporta dinero al premio ni cambia quién lo financia.

## Qué pasa con los pagos

- Las nuevas creaciones exentas se publican directamente, sin QR ni solicitud a Mercado Pago.
- Torneo, invitaciones y constancia de exención se guardan en una misma transacción.
- Los recibos exentos usan `EXEMPT`, importe cero y referencia al permiso utilizado. No simulan un pago aprobado.
- Los pagos pendientes anteriores conservan su importe y su flujo. Conceder una exención no los cancela ni devuelve dinero.
- Los torneos ya creados no cambian al revocar la exención.
- Se reutilizan las tablas y funciones existentes; no se agregan servicios de pago mensual fijo.

## Controles del servidor

La identidad se obtiene del token de Cognito. AWS comprueba la reserva persistente `creator`; no confía en el correo escrito en el formulario, el nick ni un rol enviado por el navegador.

Cada exención se guarda en `UniqueClaim`, con clave `creation-exempt:<sub>`, estado, revisión, motivo, autor y fecha. La función administrativa sólo recibe permiso de escritura para ese prefijo, además del registro privado de auditoría.

La concesión o revocación y su auditoría se escriben juntas. Una revisión anterior se rechaza para evitar que dos pestañas pisen cambios. Al crear gratis, otra comprobación transaccional exige que el permiso continúe activo y con la misma revisión. Los identificadores de creación impiden duplicar una solicitud al reintentar.

## Correcciones de acceso y fotos

- El encabezado espera el estado de Auth antes de mostrar Ingresar. Un fallo de red no convierte una sesión conocida en una sesión cerrada.
- Las respuestas antiguas no pueden restaurar el encabezado de una cuenta que ya salió.
- Administración espera la renovación de sesión antes de su consulta inicial y permite reintentar el acceso. Iniciar sesión desde el panel lo abre sin tener que recargar manualmente.
- La foto puede obtenerse por lectura consistente del perfil; el índice tiene permiso explícito. El selector usa caché con vencimiento y un reintento, en lugar de recordar un fallo indefinidamente.
- Nick y foto siguen disponibles para las demás cuentas del club, aunque el perfil sea privado. Biografía, redes, historial y contactos conservan sus permisos.

## Otras herramientas

Emblemas, tarifas y reclamos siguen en sus secciones de Administración. El registro ahora se llama **Registro de actividad** e incluye los cambios de exenciones con su motivo. Los torneos se abren y eliminan individualmente desde su ficha; no existe un botón de borrado masivo.

La baja voluntaria está en **Configuración de cuenta → Eliminar mi cuenta**, al final del perfil propio. Sigue exigiendo escribir la frase completa y confirmar la eliminación final. El Creador no dispone de esa opción y el servidor protege su cuenta.

Esta versión no modifica XP, puntos, ligas, logros, premios ni formatos de competición. Esas decisiones quedan para una versión posterior.

## Alcance de las comprobaciones

Se compilan el frontend de producción y los tipos del backend. La publicación se comprueba en Amplify. No se cobran pagos ni se eliminan cuentas o torneos como parte de la publicación; tampoco se conceden permisos a terceros como prueba.
