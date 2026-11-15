import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// The art and sound are in src/assets/ and imported where they're used: import pop from '@audio/ui/pop.wav'.
export default defineConfig({
  server: { port: 5173, proxy: { '/api': 'http://localhost:3000' } }, // the API runs beside it (server/)
  resolve: {
    alias: {
      '@art': fileURLToPath(new URL('./src/assets/art', import.meta.url)),
      '@audio': fileURLToPath(new URL('./src/assets/audio', import.meta.url)),
    },
  },
  build: { assetsDir: 'build' }, // Vite's own output goes in dist/build/
});
