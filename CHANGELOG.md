# 2.5.0 — Duelo sin juez y torneos programados

- Modos con juez o sin juez; en este último decide el organizador, incluso si juega.
- Aceptación explícita y registrada de la condición sin juez, con reglas visibles en la invitación.
- Fecha, hora y zona horaria obligatorias para nuevos torneos; cuenta regresiva sin inicio automático.
- Ganador definitivo para Duelo 1v1: lo registra el organizador sin juez o un juez designado, después del horario y de las confirmaciones.
- Reglas, arbitraje e inicio fijados al crear. Sin capturas ni gestión de pagos.
- Los torneos anteriores conservan sus datos; no se les inventa un horario ni consentimiento.

# 2.4.1 — Compatibilidad del resolver de cuentas

- Corregido el despacho de operaciones: el evento de Amplify no siempre incluye `info.fieldName`.
- Los errores de carga de insignias ahora se muestran junto al perfil.
- Compatibilidad de las insignias con el alias de propietario que devuelve AppSync; la autorización conserva el identificador permanente de Cognito.

# 2.4.0 — Identidad del club

- Insignias Creador y Betatester, administradas exclusivamente por la cuenta autorizada.
- Teléfono internacional obligatorio al guardar el perfil; privado y único mediante reserva transaccional en AWS.
- Número sin verificación SMS: no demuestra posesión. Los perfiles anteriores se conservan y deben completarlo para participar en nuevos torneos.
- Fotos y nombres conservados; insignias visibles en perfil, selección y cuadros.

# Historial de versiones

## 2.3.0 - 2026-10-15

- Corrección de la lectura de perfiles: paginación completa en lugar de límite 1 antes del filtro. No se interpreta una página vacía como perfil inexistente.
- Renovación de sesión con Amplify y actualización del encabezado al volver a la pestaña. Un fallo al cargar el perfil no redirige ni permite sobrescribirlo como vacío.
- Sala de espera con avatares y estados, actualizada cada 15 segundos con la página visible.
- Sorteo aleatorio del servidor al aceptar todos los roles, guardado una sola vez con control transaccional de revisiones concurrentes.
- Cuadros con nombres para duelo, eliminación simple y doble, calendario Round Robin y prueba compartida. Suizo sortea la primera ronda: las siguientes dependen de resultados todavía no implementados.
- Un rechazo detiene el sorteo; los torneos anteriores conservan el comportamiento histórico. No se implementa aún reemplazo de invitados ni registro de resultados.


## 2.2.0 - 2026-10-15

- Invitaciones para participantes, jueces y tesorero, con aceptación o rechazo personal.
- Campana con contador en las páginas con sesión y actualización cada 20 segundos mientras la pestaña está visible.
- Sonido sintetizado y control para silenciarlo; requiere interacción por las restricciones del navegador.
- Creación e invitaciones atómicas y respuestas validadas en AWS por la identidad del destinatario.
- Ficha con estados pendientes, aceptados y rechazados. Elegirse a uno mismo confirma ese rol al crear.
- Las invitaciones son dentro del sitio, sin email ni notificaciones push con la página cerrada. Los torneos anteriores conservan sus integrantes sin generar invitaciones retroactivas.


## 2.1.3 - 2026-10-15

- Selección de participantes, jueces y tesorero mediante tarjetas con avatar y nick.
- Foto del perfil con inicial de respaldo si falta o no carga.
- Borde verde, marca y texto de selección visibles; tesorero con selección única y opción «Sin tesorero».
- La búsqueda por nick también filtra las opciones de tesorero. Se mantienen los límites y la separación de roles.


## 2.1.2 - 2026-10-15

- Corrección de la carga inicial del diagrama y la conexión de cuenta en creación de torneos.
- Incluye Duelo 1v1 y contacto de sugerencias de 2.1.1.


## 2.1.1 - 2026-10-15

- Duelo 1v1 como opción inicial, con diagrama, explicación y exactamente dos participantes, validado en el navegador y AWS.
- Se mantiene al menos un juez obligatorio y tesorero opcional.
- «Sugerir cambios» abre el correo del usuario dirigido a leorivero744@gmail.com con asunto precargado.


## 2.1.0 - 2026-10-15

### Incorporado
- Creación persistente de torneos con nombre, actividad y reglas opcionales.
- Cinco formatos con esquemas SVG y ejemplos: Round Robin, eliminación directa, doble eliminación, suizo y todos en una prueba.
- Selección por nick de perfiles registrados: mínimo dos participantes y un juez; tesorero opcional.
- Un único lugar y rol por cuenta, validado en el navegador y en AWS Lambda.
- Escritura de torneos sólo mediante una operación autenticada y validada. El modelo no concede escritura directa a usuarios.
- Reintentos de creación con identificador estable para evitar duplicados por cortes de conexión.
- Listado, búsqueda real y ficha consultable mediante enlace para cuentas del club.
- Retorno a la creación después de ingresar, con borrador de nombre, actividad, reglas y formato durante la sesión del navegador.

### Alcance
- Se guarda la organización inicial; todavía no se generan cruces, rondas, clasificaciones ni resultados.
- El tesorero es una asignación de rol; no procesa pagos ni mueve dinero.
- Las personas deben guardar su perfil y nick para aparecer en la selección. Los roles se asignan al crear, sin flujo de invitación o aceptación todavía.
- El bloqueo geográfico sigue pendiente, sin activar WAF.


## 2.0.1 - 2026-10-15

### Corregido
- El inicio conserva siempre «Un desafío. Todo por demostrar.»; se elimina la selección aleatoria al recargar.

### Rendimiento
- Fuentes externas sin bloqueo del primer dibujo del contenido, con respaldo para JavaScript desactivado.
- Amplify Data y Storage se cargan bajo demanda en lugar de incluirse en el arranque de acceso.
- Los controles de acceso ya no esperan la lectura remota del perfil para registrar sus acciones.
- La configuración de Amplify permite revalidación HTTP sin reutilizar silenciosamente una configuración obsoleta.
- Compilación local completada. No se garantiza un tiempo universal de 0,5 segundos.

### Pendiente de activación
- Restricción por IP a Latinoamérica y el Caribe, incluido Brasil. Requiere autorización del costo recurrente de AWS WAF; no está activada en esta entrega.


## 2.0.0 - 2026-10-15

Primera versión de ProveIt Club que conecta la web con cuentas y perfiles persistentes en AWS. La versión inicial del sitio estático se conserva en el historial del repositorio; esta entrega se identifica con la etiqueta `v2.0.0`.

### Incorporado
- Registro e ingreso por correo con verificación y recuperación de contraseña mediante Amazon Cognito.
- Inicio de sesión con Google.
- Perfil con nick, biografía opcional y foto elegida por el usuario.
- Validación de fotos JPG, PNG o WebP de hasta 2 MB en la interfaz.
- Persistencia del perfil con Amplify Data y almacenamiento de imágenes en Amazon S3.
- Avatar de acceso al perfil que reemplaza el botón Ingresar cuando existe una sesión.
- Actualización del avatar al completar el ingreso y al guardar el perfil.
- Dominio de acceso propio `auth.proveitclub.win`, certificado SSL y configuración DNS.
- Publicación conectada a GitHub y AWS Amplify, con Vite para preparar la web.

### Corregido
- Publicación de `amplify_outputs.json` para conectar la interfaz con el backend.
- Mapeo del correo de Google al campo obligatorio de Cognito.
- Inicialización compartida de Amplify y detección del estado de sesión en el encabezado.

### Alcance actual
- La gestión de torneos, resultados, jueces y dinero todavía no forma parte de esta entrega funcional.
- La moderación automática de imágenes y la unicidad transaccional de nicks siguen pendientes.
- El máximo de imagen y el formato se validan en el navegador; no equivalen a una validación de contenido en el servidor.
- La etiqueta y los archivos descargables conservan el código de esta versión. No contienen los secretos de Google, las cuentas, los datos de perfiles ni las fotos guardadas en AWS. DNS, certificados y otras configuraciones externas requieren su propia documentación.

## Cómo nombrar las próximas versiones

- `2.0.1`: correcciones pequeñas de esta versión.
- `2.1.0`: nuevas funciones dentro de la etapa 2.
- `3.0.0`: otro cambio de etapa importante decidido para el proyecto.

La numeración identifica entregas del proyecto; no es una certificación de que no existan errores.

