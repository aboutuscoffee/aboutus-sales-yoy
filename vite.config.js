import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/aboutus-sales-yoy/',
  server: { port: 5174 },
});
