import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const swVersionPlugin = () => ({
  name: 'sw-version',
  writeBundle({ dir }) {
    try {
      const fs = require('fs');
      const path = require('path');
      const swPath = path.join(dir, 'sw.js');
      const content = fs.readFileSync(swPath, 'utf8');
      fs.writeFileSync(swPath, content.replace('__SW_VERSION__', Date.now().toString(36)));
    } catch {}
  }
});

export default defineConfig({
  plugins: [react(), swVersionPlugin()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'recharts': ['recharts']
        }
      }
    }
  }
});
