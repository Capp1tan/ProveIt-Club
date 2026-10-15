# Historial de versiones

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
