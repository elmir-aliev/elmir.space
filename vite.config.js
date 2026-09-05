import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import designMode from './tools/design-mode/plugin.js';

export default defineConfig({
  plugins: [react(), designMode()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three';
          return null;
        },
      },
    },
  },
});
