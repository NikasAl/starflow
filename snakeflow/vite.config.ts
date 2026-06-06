import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: mode === 'development',
    minify: 'esbuild',
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
        },
      },
    },
    assetsInlineLimit: 4096,
    cssCodeSplit: false,
  },
  server: {
    port: 3003,
    host: true,
  },
}));
