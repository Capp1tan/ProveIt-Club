import { defineConfig } from 'vite';

const legacyPaths = new Map([
  ['/index.html', '/'],
  ['/crear-torneo.html', '/crear-torneo'],
  ['/simular-torneo.html', '/crear-torneo'],
  ['/perfil.html', '/perfil'],
  ['/torneo.html', '/torneo'],
  ['/torneos.html', '/torneos'],
  ['/pago.html', '/pago'],
  ['/amigos.html', '/amigos'],
  ['/admin.html', '/admin'],
]);

function appRouteFallback() {
  const rewrite = (req, res, next) => {
    if (typeof req.url !== 'string') return next();
    const parsed = new URL(req.url, 'http://vite.local');
    let destination = legacyPaths.get(parsed.pathname);
    if (parsed.pathname === '/react') destination = '/';
    else if (parsed.pathname.startsWith('/react/')) destination = parsed.pathname.slice('/react'.length) || '/';

    if (destination) {
      res.writeHead(301, { Location: `${destination}${parsed.search}` });
      res.end();
      return;
    }
    if (parsed.pathname !== '/index.html' && !/\.[^/]+$/.test(parsed.pathname)) {
      req.url = `/index.html${parsed.search}`;
    }
    next();
  };
  return {
    name: 'app-route-fallback',
    configureServer(server) { server.middlewares.use(rewrite); },
    configurePreviewServer(server) { server.middlewares.use(rewrite); },
  };
}

// Una sola entrada HTML: React vive en la raíz del dominio.
export default defineConfig({
  plugins: [appRouteFallback()],
  esbuild: {
    jsx: 'automatic',
  },
  build: {
    rollupOptions: {
      input: ['index.html'],
    },
  },
});



