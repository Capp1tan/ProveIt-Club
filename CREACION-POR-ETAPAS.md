# Actualización 3.14.0

Tema claro/oscuro compartido, propuesta de premio en la etapa 2 y sala final conectada a cuentas reales. Ver `TEMA-Y-SALA-REAL.md` para la implementación y sus límites.

# Crear torneos por etapas — v3.8.0

## El recorrido

1. **El desafío:** nombre, actividad, descripción breve, reglas, cupo (2–64), jurado y previsión de premio. Portada opcional con imagen propia; sin archivo se usa un diseño de ProveIt. El estilo editorial claro está limitado a esta pantalla.
2. **Preparar el encuentro:** invitar exactamente el cupo declarado, seleccionar jueces cuando corresponde, formato, modelo interactivo de llaves y horario con zona horaria. La tarifa vigente aparece antes de publicar. Las exenciones del administrador siguen vigentes. Este cambio no introduce precios por tramos ni fichas.
3. **Sala de espera:** después de habilitar el torneo, aparecen nombres/fotos, roles pendientes/aceptados/rechazados y cuenta regresiva. La aceptación de invitaciones genera una señal mínima por WebSocket que provoca una relectura autorizada. Una consulta cada 30 segundos y la vuelta a una pestaña visible cubren reconexiones y cambios de clientes anteriores.

Si corresponde un cobro se conserva el checkout antes de enviar invitaciones. Una cuenta exenta pasa directamente a la sala. No se confirma automáticamente a una persona por invitarla. El sorteo definitivo lo guarda AWS cuando se completan las aceptaciones; el modelo previo nunca es un sorteo real.

## Archivos principales

- `crear-torneo.html`: estructura y campos de las etapas 1 y 2.
- `tournament-creation.css`: estilo editorial y componentes de la sala.
- `src/tournament-create.js`: navegación, validaciones, selección y borrador por cuenta.
- `src/tournament-preview.js`: modelos locales con encuentros seleccionables. Round Robin muestra hasta cinco rondas para evitar un panel desmesurado; el sorteo real incluye todas.
- `src/tournament-cover.js`: optimización de la imagen en el navegador, subida privada al publicar y lectura temporal.
- `amplify/functions/tournament-cover.ts`: firma de URLs limitadas, validación de tamaño/ruta/propiedad y acceso a portadas publicadas.
- `amplify/functions/create-tournament/handler.ts`: valida los nuevos datos y conserva la publicación/pago idempotente.
- `amplify/data/lobby-signal.js`: filtro por torneo para señales mínimas sin enviar la invitación privada.
- `src/tournament-view.js`: ficha y sala de espera, con reglas/condiciones plegables.

## Privacidad, persistencia y límites

- El borrador queda en sessionStorage, separado por cuenta. No contiene teléfonos, correos ni secretos. La imagen sin publicar queda en memoria; recargar antes de subirla exige volver a seleccionarla.
- Las portadas JPG/PNG/WebP de hasta 5 MB se convierten localmente a WebP y un máximo de 1600 px en su lado mayor; el archivo subido debe ser de hasta 2 MB. AWS valida ruta y metadatos del objeto. Esto no incorpora moderación automática de contenido ni un escáner de archivos.
- Las claves son inmutables y pertenecen a la cuenta/torneo. El bucket sigue privado y las URLs duran 120 segundos. La subida ocurre al publicar. Si se abandona después de subir pero antes de crear puede quedar un objeto sin referencia; su limpieza no está automatizada en esta versión.
- Se añaden campos opcionales a Tournament (overview, coverPath, participantLimit, prizeExpected), manteniendo los torneos anteriores.
- Marcar que se prevé un premio no lo confirma ni promete custodia. Su anuncio por juez/organizador sigue usando el flujo existente y exige nueva aceptación cuando cambian las condiciones.
- No cambia la lógica de resultados. El sistema suizo conserva la limitación de rondas posteriores por puntaje sin automatizar. La llave inferior de doble eliminación está resumida en el modelo previo. Las reglas completas de cada competencia siguen siendo necesarias.
- No se crearon torneos de prueba, enviaron invitaciones a terceros ni realizaron cobros para este cambio. Se compilaron frontend y TypeScript del backend; eso no demuestra un ensayo completo con dos cuentas.

## Publicación

Publicar backend y frontend en el mismo despliegue de Amplify: el cliente nuevo usa answerTournamentInvitation/onTournamentLobby y las acciones COVER_UPLOAD/COVER_URL. El cliente anterior conserva respondToTournamentInvitation, de modo que pestañas viejas siguen pudiendo contestar. Las salas nuevas consultan también periódicamente para detectar esas respuestas.
