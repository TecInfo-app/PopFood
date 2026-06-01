import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          acompanhamento: path.resolve(__dirname, 'acompanhamento.html'),
          cliente: path.resolve(__dirname, 'cliente.html'),
          clientes: path.resolve(__dirname, 'clientes.html'),
          motoboy: path.resolve(__dirname, 'motoboy.html'),
          pedidos: path.resolve(__dirname, 'pedidos.html'),
          perfil: path.resolve(__dirname, 'perfil.html'),
          relatorios: path.resolve(__dirname, 'relatorios.html'),
        }
      }
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
