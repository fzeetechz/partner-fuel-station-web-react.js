import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({ plugins: [react(), tailwindcss()], server: { watch: { ignored: ['**/.browser-profile/**','**/test-results/**'] } }, build: { rollupOptions: { output: { manualChunks: { charts: ['recharts'], forms: ['react-hook-form','zod','@hookform/resolvers'], framework: ['react','react-dom','react-router-dom','@tanstack/react-query'] } } } } });
