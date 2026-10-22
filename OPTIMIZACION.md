# Rendimiento, respaldo y presupuesto · 3.6.0

Objetivo operativo: alrededor de USD 20/mes en AWS para la comunidad inicial.
No es una tarifa plana ni un límite automático. Impuestos, dominio, comisiones
de Mercado Pago y futuros SMS deben calcularse aparte. El presupuesto existente
de AWS abarca toda la cuenta, incluidos otros proyectos.

## Chat

- `clubChatSend` usa las mismas validaciones, transacciones, límites e
  idempotencia que el envío anterior. Los mensajes siguen en DynamoDB.
- `onClubChat` emite únicamente un identificador de evento y los destinatarios.
  No lleva texto, fotos, correos, teléfonos ni nombres de los participantes.
- El filtro de la suscripción usa el `sub` del token de Cognito. No acepta que
  el cliente elija otra identidad. Los destinatarios los calcula el servidor.
- Cada aviso despierta la bandeja y la sala activa. Cada lectura comprueba
  nuevamente amistad, inscripción aceptada y bajas. Un socket viejo no concede
  acceso al historial después de perder los permisos.
- Hay una conexión por página. Con conexión sana, la reconciliación es cada
  60 segundos; si falla, vuelve el sondeo de respaldo (3 segundos en conversación
  activa, 15 segundos en bandeja cerrada). Los errores tienen espera progresiva.
- Al ocultar la pestaña no se consulta el historial. Al volver, reconcilia.
- Un cliente que quedó abierto con la versión anterior debe recargar para
  utilizar el nuevo envío y sus avisos. El respaldo recupera los mensajes viejos.
- Los contadores, borradores, sonidos y reintentos conservan su funcionamiento.

## Fotos y consultas

- Las fotos nuevas se reducen proporcionalmente a un máximo de 768 píxeles y
  se codifican en WebP con calidad 0,88. Se conserva transparencia y se usa el
  original si ya es más pequeño. El límite de entrada continúa en 2 MB.
- Las fotos existentes no se convierten ni se borran en esta publicación.
- Índice `byAvatarPath`: localizar la foto publicada sin recorrer todos los
  perfiles. Una búsqueda de respaldo cubre la propagación del índice al guardar.
- Índice `byRecipientStatus`: consultar sólo las invitaciones pendientes del
  destinatario. La autorización por dueño sigue aplicada por AppSync.
- Las consultas de reputación proyectan los campos necesarios y el buscador
  espera 120 ms tras escribir antes de reconstruir los resultados.
- Las consultas generales del directorio y el cálculo derivado de ligas aún
  utilizan recorridos paginados. Con pocos datos no justifican una migración
  completa. Si crecen, conviene una proyección por participante/evento mantenida
  en servidor. Esta versión no finge que todos los Scan se eliminaron.

## Recuperación y registros

- Las ocho tablas de modelos y las dos tablas privadas activan PITR con ventana
  de 35 días, protección de eliminación y política RETAIN en CloudFormation.
  PITR comienza al habilitarlo; no crea un historial retroactivo de 35 días.
- Restaurar PITR crea otra tabla: ante un incidente hay que coordinar restauración
  y reconexión de la aplicación, no basta un botón de deshacer en el sitio.
- El bucket de fotos activa versionado. No se vuelve público. Las URLs
  siguen firmadas y caducan. No se eliminan versiones automáticamente aquí.
- El ciclo de vida del bucket continúa administrado por Amplify. El versionado
  permite recuperar archivos, pero no es una copia independiente que sobreviva
  a eliminar toda la aplicación y sus recursos de almacenamiento.
- Retención de logs: 30 días para operaciones comunes; 90 días para cobros,
  webhook, mantenimiento y administración. Estos son registros técnicos;
  no se borran mensajes, pagos ni historiales de torneos con esta configuración.
- La retención se aplica a los grupos de Lambda existentes mediante CDK
  LogRetention. Al superar esa antigüedad los registros técnicos caducan.

## Publicaciones y costos

- Agrupar cambios relacionados en una publicación. No desplegar por cada
  corrección de texto mientras se está editando.
- El backend conserva DynamoDB bajo demanda y Lambda según uso. No se añaden
  servidores permanentes, NAT Gateway, réplicas regionales ni WAF de pago.
- El presupuesto se configura en la consola existente; no se crea otro que
  duplique las notificaciones. Objetivo USD 20, avisos reales USD 5/10/15/20 y
  previsión superior a USD 20. Las alertas no suspenden AWS ni son instantáneas.
- Comparar la factura previa a créditos por servicio y separar otros proyectos.
  Una reducción de consultas no permite prometer una factura fija: también se
  cobran entregas de avisos, conexiones, Lambda, DynamoDB, almacenamiento y tráfico.

## Comprobaciones realizadas

Compilación Vite del frontend y comprobación de tipos del backend. No se
ejecutaron pruebas automáticas ni una prueba de carga multiusuario. El estado
de la publicación y las protecciones efectivas se documentan en el informe de
entrega, después del despliegue. No se presentan porcentajes de ahorro medidos.
