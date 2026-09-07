import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
    alias: {
      '@': path.resolve(__dirname, './src'),
      'figma:asset/b1d4ebe7933805fb4c8794d05e542e1ce37db26e.png': path.resolve(__dirname, './src/assets/b1d4ebe7933805fb4c8794d05e542e1ce37db26e.png'),
      'figma:asset/819394a5391d24198a8e0461bd44cc5ad28fff0a.png': path.resolve(__dirname, './src/assets/819394a5391d24198a8e0461bd44cc5ad28fff0a.png'),
    },
  },
  build: {
    target: 'esnext',
    outDir: 'build',
  },
  server: {
    port: 3000,
    open: true,
    proxy: {
      // Uncomment when backend is on 3001:
      // '/api': { target: 'http://localhost:3001', changeOrigin: true, rewrite: (path) => path.replace(/^\/api/, '') }
    },
  },
  preview: {
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      'sector-nine-production.up.railway.app',
      'sectornine-production.up.railway.app',
    ],
  },
});
