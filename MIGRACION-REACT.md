# Migración gradual a React

La aplicación React está aislada bajo `/react/`. Las rutas `.html` existentes siguen siendo las páginas actuales y no se cambian mientras se porta y valida cada flujo. La rama de trabajo es `codex/react-router-migration`; el respaldo y `main` quedan separados.

## Primera etapa incluida

- Vite compila un segundo punto de entrada en `react/index.html`.
- React 18.3 y React Router 7 se cargan desde `src/react-app/`.
- Las páginas React se dividen por ruta mediante `lazy()` y `Suspense`.
- `AuthProvider` centraliza el estado de sesión Cognito para las rutas React.
- El inicio React reproduce el carrusel difuminado, el salón de la fama, la actividad pública, las ligas y los patrocinadores.
- El cambio claro/oscuro React comparte `proveit:theme` con el sitio actual y respeta movimiento reducido.
- El directorio React consulta torneos y pagos de inscripción pendientes desde las APIs existentes; ya ofrece búsqueda, estados, orden y filtro de participación con caché en memoria y actualización periódica.
- `public/_redirects` permite abrir rutas internas de React directamente en Amplify Hosting.
- La creación React ya cubre las dos etapas, selección de participantes y jueces, formatos existentes, fecha, premio, portada con recorte, tarifa, borrador por cuenta y reintento idempotente.
- El perfil React permite editar nick, biografía, país, teléfono privado, privacidad, redes y foto; los perfiles públicos y su progreso consultan la API con sus reglas de privacidad. El perfil React aún enlaza a amistades y al historial legado.
- La ruta de acceso React implementa email/contraseña, alta con nick/país/teléfono, verificación de email, reenvío de código y recuperación de contraseña. Falta confirmar y ajustar el retorno OAuth de Google para que Cognito vuelva a una ruta React sin perder compatibilidad con el sitio publicado.
- La ruta de amistades React conserva solicitudes recibidas/enviadas, límite de amistad que informa el backend, búsqueda de perfiles y mensajes mediante la bandeja/chat real ya conectados a Amplify.
- La sala React conecta invitaciones, confirmaciones, juez y condiciones, premios, sorteo guardado, brackets, registro de resultados, comentarios al juez y chat de torneo a los servicios actuales. Los secretos y decisiones financieras permanecen del lado servidor.
- Se integraron la búsqueda global y las notificaciones en componentes React, conectados a las APIs actuales y con preferencias de lectura/sonido.
- El panel de administración se migró a componentes React para las 14 áreas. Las operaciones siguen validadas por el servidor.
- El perfil, la sala y los chats se sirven bajo rutas React, pero algunos elementos internos todavía se montan con módulos DOM existentes (progreso y redes del perfil, bracket/lobby/chat de la sala y motor de chat). La lógica de servicio de esos módulos se conserva mientras se reemplaza gradualmente la presentación.
- El resto de las URLs HTML sigue disponible como versión previa. Esto permite comparar y volver atrás sin modificar el origen publicado.

## Orden de migración y condición para reemplazar cada página

1. Verificar el retorno OAuth de Google y configurar callbacks Cognito para el entorno independiente React.
2. Reemplazar los montajes DOM que quedan en perfil, sala y chats por componentes React, conservando las APIs y permisos del servidor.
3. Completar revisión manual con cuentas de prueba para pagos (sin producir cobros), privacidad y autorización del torneo.
4. Auditar deep links, OAuth y retorno desde Mercado Pago bajo `/react/`.
5. Medir LCP, transferencia inicial, peticiones por sesión y navegación contra la versión actual antes de considerar el corte.

Una ruta se cambia en el sitio principal únicamente después de validar sus permisos y operaciones con Amplify, sus interacciones en teléfono y escritorio, y los enlaces directos. Las rutas principales —inicio, directorio, creación, perfil, acceso, amistades, pagos, sala, administración, búsqueda y notificaciones— ya existen en React. La migración integral todavía no está completa: faltan presentaciones internas de perfil/sala/chat, revisión manual de flujos sensibles y validación de OAuth/deep links. La SPA no está lista para publicarse como reemplazo.

## Verificación local

```sh
npm run build
npm run dev
```

Abrir `http://localhost:5173/react/` para la base React. El `build` conserva todas las páginas `.html` actuales y agrega `dist/react/index.html`; por ahora no se modifica el origen publicado.
