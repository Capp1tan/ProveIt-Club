# ProveIt Club en buscadores

La única página pública preparada para Google por ahora es https://proveitclub.win/. La marca preferida es ProveIt Club, con ProveIt y Prove.it Club como alternativas. /index.html declara la misma URL canónica que /.

## Implementado

- Inicio con HTML y texto disponibles sin iniciar sesión y sin esperar a Cognito.
- Título, descripción, canonical y datos estructurados WebSite.
- robots.txt permite el rastreo y anuncia sitemap.xml.
- El sitemap incluye sólo la portada pública. Los paneles, perfiles, pagos y salas tienen noindex. Esto no sustituye los permisos de AWS.
- Sin listas de palabras clave artificiales, páginas falsas, puntuaciones inventadas ni promesas de premios inexistentes.

## Paso del propietario en Search Console

1. Entrar a https://search.google.com/search-console/ con la cuenta de Google elegida para administrar el sitio.
2. Revisar el selector de propiedades. Si proveitclub.win no está, agregar una propiedad Dominio para proveitclub.win y verificarla con el TXT exacto que Google indique en los DNS de Cloudflare (no reemplazar los registros existentes).
3. Una vez verificada, en Sitemaps enviar https://proveitclub.win/sitemap.xml.
4. Inspeccionar https://proveitclub.win/ y usar Probar URL publicada. Revisar si Google puede leerla; si es válida, pulsar Solicitar indexación.
5. Consultar el informe de Indexación para distinguir URL descubierta, rastreada, indexada o excluida. Una búsqueda site: por sí sola no confirma el estado.

La preparación técnica ayuda a descubrir y comprender la portada, pero Google decide cuándo indexarla y en qué posición mostrarla. No se ha verificado Search Console desde este proyecto. Pagar anuncios no es un requisito para indexarse: son procesos distintos.

Fuentes: https://developers.google.com/search/docs/fundamentals/get-on-google y https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl
