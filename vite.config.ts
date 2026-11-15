import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base نسبي ليعمل التطبيق تحت أي مسار على GitHub Pages
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 5173 },
});
