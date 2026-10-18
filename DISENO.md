# Tema visual compartido · 3.5.0

La referencia es la propuesta panorámica del perfil: marca tipográfica prove.it
CLUB, tarjetas oscuras con transparencia discreta y acentos lima. Las ocho
páginas cargan `visual-theme.css` y llevan la clase `proveit-theme` en el body.

## Qué se puede cambiar fácilmente

- `--glass`: fondo de las tarjetas comunes. Menos alfa = más transparencia.
- `--glass-dense`: fondo de formularios y tablas, donde importa más la lectura.
- `--glass-border`: claridad de los bordes.
- `--green`: acento de botones y marca.
- `body.proveit-theme::before`: fondo compartido y degradado que lo oscurece.
- `.brand`, `.brand-dot` y `.brand-club`: tamaño y espaciado del logo de texto.

El archivo está dividido por comentarios: navegación, tarjetas, inicio,
formularios, redes del perfil, chats y adaptación a pantallas pequeñas.
Los módulos originales siguen controlando apertura, cierres, estados,
validaciones y permisos. No se cambiaron reglas de ligas, precios, pagos,
cuentas ni el tratamiento de datos privados.

El paisaje utiliza el recurso WebP de ligas ya existente, de aproximadamente
65 KB. Los desenfoques son pequeños; en móviles se retiran de las tarjetas
grandes y se aumenta la opacidad. Se incluye respaldo para navegadores sin
backdrop-filter y preferencia de transparencia reducida.

La marca ahora es texto HTML, no una imagen: conserva nitidez al aumentar
el tamaño y el enlace de regreso al inicio. Se retiraron las barras de la
cabecera. Los logos de patrocinadores y las fotos de las cuentas se conservan.
