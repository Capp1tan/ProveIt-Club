import { defineConfig } from 'vite';

// Entradas HTML del sitio: inicio, cuenta y gestión de torneos.
export default defineConfig({
  build: {
    rollupOptions: {
      input: ['index.html', 'crear-torneo.html', 'perfil.html', 'torneo.html', 'torneos.html', 'pago.html', 'amigos.html'],
    },
  },
});



