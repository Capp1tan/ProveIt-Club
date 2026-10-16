# Cobros por creación de torneos

## Estado inicial

Versión 2.7.0, Checkout Pro mediante Preferences API. La configuración del servidor
usa `MERCADOPAGO_MODE: 'test'` en las tres funciones. Sólo el Creador puede iniciar
solicitudes en este entorno. No hay cobros reales ni fondos para premios.

## Flujo

1. `createClubTournament` valida cuenta, roles, teléfono, fecha y consentimiento.
2. Guarda `TournamentPayment` privado con el borrador y el precio del servidor.
3. Crea una preferencia con `external_reference` igual al ID del borrador.
4. `/pago.html` muestra botón y QR del enlace, generado localmente con `qrcode`.
5. El webhook comprueba HMAC SHA-256 y consulta `/v1/payments/{id}` con la clave privada.
6. Revisa referencia, metadata, destinatario, moneda, importe y entorno del pago.
7. Una transacción de DynamoDB registra el cobro y publica torneo e invitaciones.
8. Las repeticiones no vuelven a publicar ni a invitar. Se intenta vencer la preferencia.

El regreso del checkout nunca se interpreta como aprobación. El estado de la URL
del navegador tampoco se utiliza para decidir. La consulta autenticada recupera
pagos aprobados si la notificación tarda; limita búsquedas a una cada 15 segundos
por solicitud. Los pagos pendientes/rechazados no publican el torneo.

## Configuración

- Amplify, main: `MERCADOPAGO_ACCESS_TOKEN`, sólo en el servidor.
- Amplify, main: `MERCADOPAGO_WEBHOOK_SECRET`, sólo en el servidor.
- URL de recepción: `custom.paymentWebhookUrl` de `amplify_outputs.json`.
- Mercado Pago: aplicación ProveIt Club, Checkout Pro, API de Preferencias.
- Evento de Webhooks: Pagos (legacy), tópico `payment`, para Preferences API.
- Precio inicial: 100 centavos ARS. Sólo el Creador lo cambia desde Mi perfil.
- No se guardan números de tarjeta ni contraseñas de Mercado Pago.

El primer despliegue omite temporalmente el secreto de firma para obtener la URL.
Durante ese despliegue el endpoint rechaza todas las notificaciones. Después de
configurar Webhooks se vincula el secreto y se vuelve a desplegar.

## Antes de pasar a cobros reales

Completar una compra de prueba con cuentas autorizadas y comprobar pago, activación,
invitaciones y rechazo. El agente no debe hacer pagos reales ni decidir por otros.
Validar que Mercado Pago admita el importe elegido y revisar las comisiones de la
cuenta. No asumir que $1 ARS está disponible sólo porque el precio se muestra.

Activar las credenciales de producción en MP y guardar el token real en Amplify.
Configurar la URL en el modo productivo y su firma correspondiente. Cambiar las tres
funciones a `MERCADOPAGO_MODE: 'live'` y desplegar como un cambio coordinado.
Las solicitudes TEST no pueden acreditarse con pagos LIVE ni viceversa. Para
desactivar nuevos cobros, pausar la creación desde el panel del Creador; las
solicitudes ya emitidas conservan su precio y siguen siendo conciliables.

Los torneos anteriores a esta función conservan su estado. Un reembolso o contracargo
del pago utilizado marca el torneo como REVERSED y bloquea nuevas confirmaciones y
resultados. No se ejecutan devoluciones automáticas ni se borran torneos.

## Costos

Lambda Function URLs evita incorporar API Gateway. Lambda, DynamoDB, almacenamiento,
AppSync, logs, compilaciones y alojamiento pueden cobrar según uso. Una estimación de
menos de USD 5/mes para el uso inicial no constituye un tope de facturación. Mercado
Pago cobra sus comisiones e impuestos por separado. No se activa WAF.

## Límites

El checkout de MP puede permanecer accesible si falla el vencimiento de preferencia;
no volver a pagar una solicitud que ya figura aprobada. Los cobros duplicados requieren
revisión del administrador: esta implementación no mueve ni devuelve dinero.

Documentación: https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-preferences/overview
