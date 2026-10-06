import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Masaüstü uygulamasının arayüzü. Electron dosyayı file:// ile açtığı için göreli yollar (base: './').
export default defineConfig({
  root: 'src/renderer',
  base: './',
  plugins: [react(), tailwindcss()],
  // Docker içinde Windows klasörü bağlandığında dosya değişikliği olayları gelmez, yoklama gerekir
  server: { port: 5199, strictPort: true, host: true, watch: process.env.VITE_POLL ? { usePolling: true, interval: 300 } : undefined },
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
  },
});
