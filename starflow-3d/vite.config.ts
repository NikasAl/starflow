import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Only generate sourcemaps in development
    sourcemap: mode === 'development',
    // Minification: esbuild (default) is faster, terser is smaller
    minify: 'esbuild',
    // Target modern Android WebView (Chrome 80+)
    target: 'es2020',
    // Smaller chunks — split Three.js into its own chunk
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
        },
      },
    },
    // Disable asset inlining for small assets (keep as separate files)
    assetsInlineLimit: 4096,
    // CSS code splitting
    cssCodeSplit: false,
  },
  server: {
    port: 3001,
    host: true,
  },
}));
