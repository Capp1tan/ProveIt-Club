# Inscripción por participante — 3.17.0

## Regla vigente
- Crear torneos es gratis para cualquier cuenta completa.
- En torneos nuevos, cada jugador paga $500 ARS para confirmar su lugar.
- El organizador y el administrador también pagan si participan.
- Los jueces sólo pagan si además participan como jugadores.
- Los torneos anteriores conservan sus reglas y no reciben cobros retroactivos.
- La inscripción remunera el servicio: no se incorpora automáticamente al premio ni a un fondo común.
- El precio se configura en el panel de administración; cada torneo conserva la tarifa que tenía al crearse.

## Recorrido
1. El organizador completa y publica el torneo sin pasar por Mercado Pago.
2. AWS crea las invitaciones pendientes con el precio fijado en el servidor.
3. El invitado lee las reglas, ve el importe y acepta las condiciones.
4. El servidor prepara su inscripción privada y un Checkout Pro individual.
5. La página de pago ofrece el botón de Mercado Pago y un QR con ese enlace HTTPS. No es un QR presencial interoperable de caja.
6. El webhook verifica la firma HMAC y consulta el pago directamente en Mercado Pago.
7. AWS comprueba referencia, vendedor, moneda ARS, importe, metadata y entorno LIVE.
8. Sólo un pago aprobado permite aceptar al jugador. Al confirmarse todos los jugadores y responsables, se sortean las llaves.

## Protección y compatibilidad
El recibo usa un identificador determinista por torneo y perfil. Un reintento o una nueva aceptación de condiciones conserva ese recibo; no genera otra inscripción. Un cambio de reglas exige volver a aceptar, pero no volver a pagar una inscripción ya aprobada.

La URL de regreso del checkout no es comprobante de pago. El cliente no puede decidir precios, aprobar pagos ni editar recibos. El teléfono y el estado activo de la cuenta se comprueban nuevamente antes de confirmar.

Un reembolso, incluso parcial, o un contracargo marca la inscripción como REVERSED y bloquea el avance del torneo hasta revisión. Se conserva el historial del pago. Eliminar un torneo no devuelve dinero automáticamente.

Los antiguos enlaces de creación pendientes se rechazan desde ProveIt, porque crear ahora es gratis. Los recibos y cobros históricos se conservan. Los enlaces de Mercado Pago ya emitidos pueden seguir existiendo hasta su vencimiento.

## Operación
Se reutilizan la integración productiva, el endpoint HTTPS y los secretos privados de Amplify. No se agregan tablas ni credenciales. La configuración administrada se guarda en BillingSettings, clave participation; el importe mínimo es 50000 centavos ARS.

Las preferencias duran 30 minutos. Si vencen o si se pagó un torneo cancelado, se indica contactar a administración para revisar el caso; no se emiten nuevos cobros ni devoluciones a ciegas. Si un cambio de condiciones impide confirmar un pago aprobado, se conserva el recibo y se solicita aceptar las condiciones vigentes.

Mercado Pago no permite pagar al vendedor con su misma cuenta. Para la primera comprobación real debe pagar una persona con otra cuenta. Las pruebas automatizadas usan datos ficticios y no mueven dinero real.

## Comprobaciones
Ejecutar npm run test:entry: comprueba creación gratuita, autorización, consentimiento, importe, firma, aprobación, reintentos, cambios de términos, jueces gratuitos, compatibilidad histórica y reversiones, con tablas en memoria y Mercado Pago simulado sin red.

Los cargos de Mercado Pago y los costos de AWS siguen sujetos al uso y a las tarifas de cada proveedor. El monto cobrado no equivale al ingreso neto.

