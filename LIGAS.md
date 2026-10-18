# Ligas de ProveIt Club · 3.4.0

## Presentación

Perfil con foto, nick, emblemas y biografía; redes a la derecha. Debajo se muestra
únicamente la liga actual y la experiencia. El historial de participaciones ocupa
la columna izquierda y el de logros la derecha. El editor conserva todos los
campos existentes en un desplegable. El fondo de paisaje es común por ahora;
todavía no es una imagen personalizable por cada cuenta.

## Todos empiezan sin liga

La fecha de inicio es `2026-10-18T21:35:00.000Z`, constante `LEAGUE_START` del
archivo `amplify/functions/leagues.ts`. No se reinician ni borran cuentas.
Los torneos previos permanecen en el historial pero no conceden experiencia.
Sólo se toman eventos creados y terminados desde esa fecha.

## Progresión inicial, ajustable

| Liga | XP acumulada mínima |
|---|---:|
| Sin liga | 0 |
| Pañal con caca | 25 |
| Cartón mojado | 50 |
| Madera | 100 |
| Cobre | 350 |
| Hierro oxidado | 1.000 |
| Acero templado | 2.500 |
| Obsidiana | 6.000 |
| Leyenda | 15.000 |

Un torneo terminado concede 25 XP; ganar añade 10 XP. Con ello el primer
evento válido desbloquea Pañal. Dos eventos desbloquean Cartón y entre tres
y cuatro eventos permiten llegar a Madera. No es una clasificación de habilidad:
es la primera versión de progresión del club. La liga máxima no tiene un
requisito adicional de campeonato todavía. Los objetivos altos se pueden revisar
cuando exista suficiente actividad real para evaluar su dificultad.

Un evento cuenta una vez, con al menos dos participantes distintos aceptados,
ganador definitivo, sin reversión del cobro ni resultado por sanción. Las
invitaciones pendientes, jugar como juez y los eventos cancelados no conceden XP.
Máximo tres eventos por día UTC y uno con el mismo conjunto de rivales ese día.
Esto limita repeticiones sencillas; no demuestra que el encuentro haya ocurrido
ni sustituye moderación frente a acuerdos entre cuentas distintas.

## Logros y recompensas

Se muestran reconocimientos por primera participación, primera victoria y
5/10/25/50/100 torneos válidos. Son distinciones visuales, sin valor monetario.
No se conceden premios reales, descuentos o pagos automáticamente. Cualquier
recompensa económica futura deberá definirse y financiarse antes de ofrecerla.

## Privacidad y seguridad

`COMMUNITY_PROGRESS` verifica al dueño o la amistad recíproca/perfil público en
el servidor antes de leer y devolver el historial. Una consulta directa sin ese
permiso devuelve únicamente `{hidden:true}`. Los datos de contacto no participan
en esta respuesta. Las fotos conservan el acceso público dentro de las cuentas
del club existente. La reputación como juez sigue separada y conserva sus permisos.

No hay un campo de XP que el navegador pueda editar ni recompensas canjeables.
Los puntos se derivan de torneos vigentes: eliminar un evento o revertir su pago
puede cambiar la XP y los logros calculados. No se añade una tabla ni un escaneo
periódico: se consulta al abrir el perfil autorizado. El escaneo de torneos es
paginado; con crecimiento conviene sustituirlo por índices/eventos persistentes.

## Archivos principales

- `amplify/functions/leagues.ts`: requisitos, cálculo y lectura histórica.
- `amplify/functions/community.ts`: permisos de la consulta de progreso.
- `src/profile-leagues.js`: identidad, liga y ambos historiales.
- `src/profile-ui.js` y `src/profile-public.js`: integración propia/ajena.
- `leagues.css`: disposición, tamaño de símbolos y adaptación al móvil.
- `public/leagues/symbols.webp`: atlas transparente 4×2, orden de las ocho ligas.
- `public/leagues/profile-background.webp`: paisaje compartido del perfil.

Los gráficos se generaron con la herramienta integrada de imágenes y se
convirtieron a WebP para la web; no provienen de una librería de insignias ajena.
