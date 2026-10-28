## 3.14.3 — 2026-10-28

- Sonido de invitaciones configurable desde el perfil, fuera de la campana; conserva la preferencia de este navegador.
- Estados de asistencia con colores y transición suave, respetando movimiento reducido.
- Sala sin bloques de premio o jueces cuando no corresponden, sin compartir ni actualización manual.
- Resultado público sólo después de registrar una decisión; acción privada para organizador o juez tras el horario de inicio y las confirmaciones.

## 3.14.2 — 2026-10-28

- Sala real con la estructura aprobada: reloj y premio en cabecera, bloque de confirmación con progreso horizontal, filtros y botón principal en una fila y participantes en dos columnas.
- La aceptación conserva la lectura de condiciones antes de responder. La portada queda dentro de los detalles y el jurado en un apartado desplegable.
- Se conservan ambas paletas, fuentes y permisos actuales.

## 3.14.1 — 2026-10-24

- El indicador de conexión en vivo se conserva al filtrar participantes en la sala real.
- Encabezado más compacto y nombres con emblemas alineados en las tarjetas de participantes.

## 3.14.0 — 2026-10-24

- Diseño claro en gris suave y azul vibrante; modo oscuro y botón de sol/luna en las nueve páginas del sitio.
- Preferencia guardada en el navegador, sincronizada entre pestañas y aplicada antes del primer dibujo, sin esperar autenticación.
- Marca geométrica compartida y paleta uniforme en perfiles, chat, administración, pagos y formularios.
- Segunda etapa reorganizada: participantes, tarjetas de formatos y modelo de llaves a la izquierda; arbitraje, horario y propuesta de premio a la derecha.
- Categoría explícita, título o importe con moneda, detalle, aportante y responsable del premio al crear. AWS valida los datos y guarda el premio como pendiente.
- Sala de espera para torneos reales: contador por participante, círculo animado, filtros, fotos/nombres públicos, estado separado del jurado y acceso a las llaves.
- Respuesta a la invitación desde la sala, previa aceptación de condiciones vigentes; permisos, confirmaciones y sorteo siguen en AWS.
- No se crean recursos AWS adicionales ni se modifican tarifas o medios de pago. Los formatos reales mantienen sus reglas actuales; la edición de equipos personalizados continúa en el simulador opcional.

## 3.13.1 — 2026-10-24

- Se reemplaza la denominación bots por jugadores de ejemplo en los controles y accesos al simulador.
- Jugadores con nombres ficticios editables, como Alex, Luna y Nico; equipos con nombres como Norte y Sur.
- Los nombres predeterminados de integrantes se distribuyen sin repetirse entre los equipos activos, incluso con tamaños personalizados.
- Sin cambios en cuentas, torneos reales, pagos o infraestructura. La nueva temática visual permanece como propuesta fuera del código.

## 3.13.0 — 2026-10-24

- El círculo de confirmaciones interpola llenado y vaciado durante 720 ms, conservando el progreso visible si llegan cambios seguidos.
- El círculo se reutiliza entre actualizaciones; filtros, edición y reloj no reinician la animación.
- Transiciones discretas en botones, cambios de estado e ícono de premio; se respeta la preferencia de movimiento reducido.
- Selector explícito de premio: dinero, regalo sorpresa, comida/bebida, tecnología, ropa/accesorios, experiencia y otro premio, además de sin premio.
- Cada categoría tiene un ícono SVG local y conserva su propio texto durante la sesión; cambiar de categoría no arrastra el importe de dinero a otro tipo.
- Los premios siguen identificados como ejemplos del simulador, sin afectar datos o cobros reales.

## 3.12.1 — 2026-10-24

- El encabezado del duelo muestra el tamaño real del cruce, por ejemplo 5v5 o 5v2.
- Editar los datos ilustrativos de la sala actualiza su texto sin reconstruir el formulario ni perder foco.

## 3.12.0 — 2026-10-24

- Sala de espera del simulador con el diseño A: cristal oscuro, fondo compartido, contador, premio opcional y equipos con nombres editables.
- Vista de sala separada de configuración y resultados, conservando la prueba en memoria al navegar.
- Asistencia por integrante, filtros Todos/Listos/Pendientes/No asiste y botón propio que cambia a Asistencia confirmada.
- El inicio exige la confirmación de todas las personas, también en equipos de tamaños distintos; la asistencia se bloquea al iniciar.
- Controles explícitos para simular estados, elegir desde qué jugador se mira y personalizar nombre, premio y juez de ejemplo.
- Sin recursos nuevos de AWS, sin cuentas ficticias persistidas ni premios reales; publicación real por equipos sigue pendiente.

## 3.11.1 — 2026-10-24

- Distribuciones personalizadas aceptan comas, guiones cortos/largos y separadores habituales; 5-2 se interpreta como equipos de cinco y dos.
- Se elimina el reparto predeterminado N−1 / 1 al seleccionar modo personalizado.
- Una distribución válida se aplica automáticamente antes de jugar; con resultados exige confirmación de reinicio.
- Validación al lado del campo y bloqueo de confirmaciones, inicio, resultados y podio mientras hay cambios pendientes o inválidos.
- Se oculta la llave anterior para evitar que contradiga el reparto aún no aplicado.

## 3.11.0 — 2026-10-24

- Confirmación explícita antes de guardar la victoria de un encuentro; cancelar y Escape no alteran resultados.
- Podio configurable de uno, dos o tres puestos, confirmación final y validación de rivales distintos.
- Tercer puesto en eliminación directa mediante un encuentro entre perdedores de semifinales; podio derivado en doble eliminación.
- Round Robin exige resolver empates explícitamente con un criterio escrito; prueba compartida permite asignar puestos manuales.
- Correcciones con advertencia de los encuentros dependientes que se anularían, reapertura de podio e historial local.
- Distribuciones personalizadas de equipos de tamaños diferentes, por ejemplo 4 contra 1 o 3/2/1, sin excluir jugadores del total.
- Reglas descriptivas opcionales y confirmación antes de reiniciar una prueba con resultados.
- Cambios limitados al simulador local; publicación real por equipos y permisos reales de jueces siguen pendientes.

## 3.10.0 — 2026-10-23

- El simulador parte del total de jugadores (2–64), calcula divisiones exactas y deriva el número de equipos.
- Tamaños de equipo dinámicos: incluye 10v10 y cualquier división exacta con al menos dos rivales, sin jugadores omitidos.
- Formatos filtrados según la cantidad de rivales: enfrentamiento directo para dos, suizo y prueba compartida desde tres.
- Ejemplo rápido de 20 jugadores en dos equipos de diez; integrantes y equipos editables.
- Round Robin conserva todo el calendario y muestra una ronda por vez para no saturar la interfaz.
- Los enlaces desde la creación real conservan hasta 64 jugadores. Publicar equipos reales sigue pendiente.

## 3.9.1 — 2026-10-23

- Se añade la opción 4v4 que faltaba en el selector del simulador.
- Ejemplo rápido «Partido 4v4 · 8 jugadores»: dos equipos con cuatro integrantes editables cada uno.
- Se aclara que cada casillero representa un equipo, independientemente de su tamaño.

## 3.9.0 — 2026-10-23

- Se elimina la etiqueta visible de borrador, conservando el guardado interno por cuenta.
- Se corrige la navegación hacia la etapa anterior cuando hay una publicación preparada.
- Se permite editar los datos como torneo nuevo sin modificar ni cancelar la solicitud original.
- Simulador local con jugadores ficticios editables, equipos 2v2/3v3/5v5, confirmaciones, cuenta regresiva y resultados simulados.
- Llaves interactivas y clasificación ficticia; sin llamadas a AWS, invitaciones, cobros ni cambios de puntos.
- Los torneos reales siguen siendo individuales; las vistas por equipos están identificadas como simulación.

## 3.8.0 — 2026-10-23

- Creación de torneos en dos etapas simples y una sala de espera real, inspiradas en el boceto de Figma.
- Datos, cupo, jurado, previsión de premio y portada opcional en una composición editorial clara.
- Selección visual de cuentas, fecha/zona horaria y modelos de llaves interactivos según formato y cupo.
- Portadas WebP optimizadas, almacenadas en privado y verificadas en servidor.
- Confirmaciones por señal WebSocket mínima por torneo, con relectura de respaldo; cuenta regresiva y progreso de roles.
- Borradores por cuenta y publicación idempotente; pagos y exenciones vigentes conservados.
- Compatibilidad con torneos anteriores; precios por tramos y fichas no implementados.


## 3.7.0 — Correcciones, exenciones y administración

- Encabezado de sesión sin falso estado de invitado y panel con recuperación del acceso.
- Fotos públicas en la selección, lectura consistente y reintento de imágenes.
- Creación gratuita permanente para el Creador y permiso revocable por cuenta desde Administración.
- Exenciones con motivo, revisión concurrente y auditoría; publicaciones gratuitas atómicas, sin cobros ni QR.
- Baja voluntaria compacta en Configuración de cuenta, con confirmación escrita y final.
- Sin cambios al sistema de puntos, ligas, logros ni formatos de torneo.

## 3.6.0 — Chat en tiempo real y protección de datos

- Avisos de mensajes filtrados por identidad, con lectura autorizada y respaldo ante cortes.
- Fotos nuevas optimizadas, índices para fotos e invitaciones y buscador con menos redibujados.
- Recuperación continua de tablas, protección de borrado, versionado S3 y retención de logs.
- Guía de presupuesto y operación alrededor de USD 20 mensuales.
# Versión 3.1.0

## 3.5.0 — Identidad visual panorámica

- Marca tipográfica prove.it CLUB, sin las barras anteriores, en todas las cabeceras.
- Fondo panorámico común y tarjetas con transparencia moderada y bordes suaves.
- Tema compartido en inicio, perfiles, creación y consulta de torneos, pagos, amigos y administración.
- Formularios, diálogos, búsquedas, notificaciones y chat adaptados al mismo estilo.
- Más opacidad en tablas y mensajes; menos desenfoque en móviles.
- Iconos de redes compactos en la identidad del perfil, con nombres accesibles.

## 3.4.0 — Ligas y recorrido del perfil

- Identidad con foto, bio y redes; fondo panorámico compartido y editor desplegable.
- Todas las cuentas empiezan sin liga. Ocho rangos con símbolos abstractos originales.
- XP calculada en servidor a partir de torneos confirmados y terminados desde el lanzamiento.
- Historial de participaciones y logros, sujetos a la privacidad del perfil.
- Primeros rangos rápidos y umbrales crecientes. Sin premios económicos automáticos.
- Reglas y límites documentados en LIGAS.md.

## 3.3.0 — Perfil, búsqueda y administración

- Administración compacta junto al logo. Gestión de emblemas personalizados, tarifas y reclamos dentro del panel.
- Identidad con emblemas junto al nick en perfiles y previews.
- Búsqueda unificada de personas y torneos desde la lupa, con acceso a amigos y solicitudes.
- Las fotos se muestran a todas las cuentas del club, también cuando el resto del perfil es privado.


## 3.2.0 — Registro inicial y correos únicos

- Alta por correo con nick y teléfono desde el inicio; Google dirige al perfil inicial antes de continuar.
- Reserva transaccional de nick y teléfono al completar el perfil; correo verificado obligatorio.
- Protección de alta en Cognito contra correos repetidos entre Google y email, sin distinguir mayúsculas y con reserva atómica de solicitudes simultáneas.
- Las identidades anteriores no se fusionan automáticamente ni se eliminan datos del club.


- Centro de administración exclusivo del Creador, con autorización comprobada por servidor.
- Cuentas de Cognito con y sin perfil, búsqueda por nick o correo y ficha de identidad, contacto y privacidad.
- Consulta paginada de perfiles, torneos, pagos, invitaciones, insignias, amistades, jueces, reclamos y tarifas.
- Salas de mensajes con lectura administrativa que exige un motivo, y registro de consultas.
- No se devuelven contraseñas, tokens ni claves de servicios; el panel no modifica ni elimina registros.

# Versión 3.0.0

- Perfiles privados por defecto, acceso por amistad recíproca y lecturas filtradas por servidor.
- Fotos con lectura autorizada y enlaces breves, redes opcionales y perfil visitable.
- Rol de juez voluntario, aceptación expresa y reaceptación ante cambios de reglas o premio.
- Reputación de 1 a 5 estrellas basada en votos de participantes, torneos arbitrados y reclamos administrativos por separado.
- Declaración de conflictos de interés, motivo para sanciones y resultados discutidos.
- Responsable y financiador del premio, estado pendiente o confirmado sin promesas de custodia.

# 2.13.2 — Chat más ágil y menos consultas

- Mensaje visible de inmediato como pendiente; confirmación con respuesta del servidor y reintento sin duplicados.
- El servidor devuelve el mensaje guardado: no se exige otra lectura para mostrar el envío.
- Actualizaciones incrementales y reconciliación periódica; render sólo de mensajes modificados.
- Buzón compartido: 1,5 segundos con chat activo y 4 segundos minimizado, con pausa al ocultar la pestaña y retroceso ante errores.
- Se evita reescribir la lista de amigos en cada envío; frecuencia y amistad tienen registros separados.
- Lecturas independientes en paralelo, consultas simultáneas deduplicadas y URLs de avatar compartidas.
- Consulta directa del perfil por ID, compatible con los perfiles antiguos, y caché breve por sesión.

# 2.13.1 — Enter y sonido de mensajes

- Enter envía y Shift + Enter inserta otra línea en chats privados y de torneo.
- Se conserva el bloqueo de doble envío y la edición mediante composición de teclado.
- Sonido suave para mensajes nuevos recibidos; no se reproduce al cargar historial ni por mensajes propios.
- Control de sonido en la bandeja con preferencia persistente.
- El audio se habilita tras una interacción del usuario, respetando las restricciones del navegador.

# 2.13.0 — Bandeja de mensajes

- Chat privado flotante y minimizable abajo a la derecha en todas las páginas.
- Contadores por conversación y total de mensajes recibidos sin leer, guardados en AWS.
- Marcado de lectura al ver el final de una conversación activa; minimizar conserva los no leídos.
- Enviar un mensaje no aumenta el contador propio; conteo y envío se guardan en la misma transacción.
- Se conserva la sala y la posición minimizada al navegar; no se guardan mensajes en sessionStorage.

# 2.12.0 — Amigos y chats

- Solicitudes de amistad con aceptación, rechazo, cancelación y eliminación.
- Máximo 20 amistades por cuenta; el Creador no tiene ese límite. Cupos transaccionales en AWS.
- Chat de texto entre amigos y chat privado del organizador e integrantes confirmados de cada torneo.
- Historial paginado, consultas con pestaña visible, control de frecuencia y reintentos sin duplicados.
- Tabla privada, acceso sólo por función con validación de identidad y estado de cuenta.

# 2.11.2 — Verificado y aros de perfil

- Roseta azul con tilde y nombre accesible en lugar de etiqueta de verificado.
- Aro dorado con animación suave para el Creador y azul para cuentas verificadas.
- Aros en encabezado, perfil, selección de personas y vistas previas; respeta movimiento reducido.
- Se retira Volver al inicio del perfil: el logo conserva el enlace al inicio.

# 2.11.1 — Avatar del encabezado contenido

- Restaura tamaño fijo y recorte circular del avatar en todas las páginas.
- Reserva dimensiones en la imagen y mantiene el tamaño adaptable en móviles.

# 2.11.0 — Cuentas verificadas y juez unificado

- Verificado y excepción privada de teléfono administrados por el Creador y ligados al sub de Cognito.
- Selector de Argentina, Chile, Paraguay, Uruguay, Perú y Brasil con prefijo automático.
- El juez también coordina el dinero en torneos nuevos; se conserva el historial anterior.
- Apartado de reputación como juez en perfil y vista previa, sin puntajes inventados.

# 2.10.0 — Premios y difusión de torneos

- Premio provisional destacado, editable por jueces confirmados o por el organizador en torneos sin juez.
- Hasta cuatro imágenes/videos privados y cinco enlaces HTTPS; límites comprobados en servidor.
- Guardado con revisión para evitar sobrescrituras; bloqueo al registrar al ganador.
- Compartir enlace, WhatsApp, Facebook y X; imagen vertical PNG para historias con QR del torneo.
- Las historias se descargan o comparten con las aplicaciones disponibles, sin publicación automática.

# 2.9.2 — Patrocinadores sin fondo

- Rehace Mila Express con PNG transparente, conservando la milanesa.
- Sustituye Black Line por su logo con celular y sólo el nombre, sin subtítulos.
- Elimina el marco y fondo de la tarjeta anterior; muestra ambos logos completos.

# 2.9.1 — Mila Express en patrocinadores

- Integra la imagen original en una tarjeta adaptable al sitio oscuro.
- Carga diferida y encuadre mediante CSS, sin modificar el original.

# 2.9.0 — Checkout Pro en producción

- Credenciales de producción separadas en secretos de Amplify; modo LIVE en las tres funciones.
- QR del checkout real y acceso de creación para cuentas completas.
- Rechazo de enlaces del entorno anterior y de vendedores ficticios en producción.
- El pago se comprueba en servidor antes de publicar el torneo.
- No se realiza un cobro real desde el agente; primera transacción por comprobar.

# 2.8.2 — Eliminación individual de torneos

- Retira el botón y el código de eliminación masiva.
- El administrador abre cualquier torneo sin invitación y lo elimina desde su detalle, uno por vez.

# 2.8.1 — Permisos de comprobaciones de baja

- Permiso ConditionCheckItem explícito en las funciones que comprueban bajas dentro de transacciones.
- Lecturas consistentes durante la limpieza de cuentas.

# 2.8.0 — Eliminación de torneos, cuentas e historial

- Organizador: retirar sus torneos y solicitudes; Creador: retirar cualquiera y limpieza general.
- Baja lógica recuperable de torneos; se bloquean resultados, respuestas y republicación por Webhook.
- Baja definitiva de la cuenta propia en Cognito, perfil, teléfono e insignias; fotos limpiadas por SDK antes de confirmar. Creador protegido en servidor.
- Historial competitivo y recibos retenidos; eliminar no reembolsa pagos.
- Búsquedas recientes con eliminación individual y general; sugerencias descartables por navegador.
- Compilación de frontend y comprobación TypeScript; no se eliminan cuentas reales para probar.

# 2.7.1 — Espera limitada y mensajes de pago

- Las consultas de cuenta, tarifa y perfiles tienen límite de espera y permiten reintentar.
- Los fallos de conexión ya no se confunden con una sesión cerrada.
- El modo TEST explica arriba del formulario por qué sólo el Creador puede crear torneos.
- Preparar el pago tiene un límite de 45 segundos y conserva el identificador al reintentar.
- Se mantiene la restricción TEST; no habilita cobros reales ni otras cuentas.

# 2.7.0 — Creación con pago automático (pruebas)

- Solicitudes privadas con precio fijado por servidor; no envían invitaciones antes del pago.
- Checkout Pro, QR local del enlace y consulta automática del estado.
- Webhook firmado y consulta a la API antes de habilitar torneo e invitaciones en una transacción.
- Tarifa administrable sólo por el Creador; precio inicial 100 centavos ARS.
- Modo TEST limitado al Creador; no habilita cobros reales.
- No procesa apuestas, premios, transferencias ni reembolsos.

# 2.6.1 — Carga inicial discreta

- Pantalla oscura con marca, animación suave y salida al completar sesión y contenido.
- Sin demora mínima; salida manual tras 4 s y automática a los 10 s si falla la carga.
- Compatible con movimiento reducido y vuelta desde el historial.
- Lecturas independientes de insignias y perfiles en paralelo en el torneo.

# 2.6.0 — Llaves interactivas y vista previa de perfiles

- Nombres interactivos con foto, nick, biografía e insignias públicas.
- Vista previa tras 500 ms de permanencia; apertura por teclado, clic y toque.
- Tarjeta fuera del área recortada de la llave, con cierre por Escape y al desplazar.
- Conexiones SVG según los cruces guardados; se resaltan los encuentros relacionados.
- No se consultan teléfonos ni correos. No cambia el sorteo ni se agregan resultados.

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
