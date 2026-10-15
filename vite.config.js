import { defineConfig } from 'vite';

// El sitio usa tres páginas HTML independientes: inicio, creación y perfil.
export default defineConfig({
  build: {
    rollupOptions: {
      input: ['index.html', 'crear-torneo.html', 'perfil.html'],
    },
  },
});

