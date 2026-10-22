# Cobros por creación de torneos

## Exenciones — 3.7.0

El Creador y las cuentas con permiso administrativo activo crean sin pagar.
AWS guarda un recibo `EXEMPT` de importe cero y publica torneo e invitaciones
de forma atómica, sin solicitar una preferencia ni un cobro a Mercado Pago.
La tarifa general, los pagos pendientes y el resto de las validaciones siguen
vigentes. La pausa general se aplica también a las cuentas exentas.
La gestión y auditoría se explican en `ADMINISTRACION.md`.

## Estado de producción — 2.9.0

Checkout Pro mediante Preferences API. Las tres funciones usan
`MERCADOPAGO_MODE: 'live'` y secretos independientes:
`MERCADOPAGO_PRODUCTION_ACCESS_TOKEN` y `MERCADOPAGO_PRODUCTION_WEBHOOK_SECRET`.
Las cuentas completas del club pueden iniciar pagos reales por creación de torneos.
El QR contiene el enlace HTTPS de Checkout Pro; no es un QR presencial de caja.
No se usan las credenciales de pruebas y los enlaces TEST anteriores se rechazan.

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

## Operación y comprobación del primer cobro

El cambio de producción requiere token real y Webhooks en modo productivo con el
endpoint HTTPS del backend y el evento Pagos (legacy). No se realiza una compra
real desde el agente. El primer cobro debe completarlo una persona distinta del
vendedor; hasta verificarlo no debe afirmarse que el flujo completo está validado.

Validar el importe admitido y las comisiones de la cuenta. Si Mercado Pago rechaza
el monto, no se publica el torneo y se muestra el error. No se incrementa la tarifa
automáticamente. Las solicitudes conservan el importe fijado al crearse.

Para pausar nuevos cobros usar la tarifa del perfil del Creador. Revertir el entorno
requiere cambiar las tres funciones y sus secretos de forma coordinada: los pagos
LIVE pendientes deben seguir conciliándose con las credenciales productivas.

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
