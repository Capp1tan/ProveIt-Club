import { defineConfig } from 'vite';

function reactRouteFallback() {
  const rewrite = (req, _res, next) => {
    if (typeof req.url === 'string') {
      const parsed = new URL(req.url, 'http://vite.local');
      if ((parsed.pathname === '/react' || parsed.pathname.startsWith('/react/')) && !/\.[^/]+$/.test(parsed.pathname)) {
        req.url = `/react/index.html${parsed.search}`;
      }
    }
    next();
  };
  return {
    name: 'react-route-fallback',
    configureServer(server) { server.middlewares.use(rewrite); },
    configurePreviewServer(server) { server.middlewares.use(rewrite); },
  };
}

// Entradas HTML del sitio: inicio, cuenta y gestión de torneos.
export default defineConfig({
  plugins: [reactRouteFallback()],
  esbuild: {
    jsx: 'automatic',
  },
  build: {
    rollupOptions: {
      input: ['index.html', 'crear-torneo.html', 'simular-torneo.html', 'perfil.html', 'torneo.html', 'torneos.html', 'pago.html', 'amigos.html', 'admin.html', 'react/index.html'],
    },
  },
});



