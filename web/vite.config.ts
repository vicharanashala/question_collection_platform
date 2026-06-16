import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],

  // ─── Aliases ───────────────────────────────────────────────────────────────
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  // ─── Dev server ────────────────────────────────────────────────────────────
  server: {
    port: 5173,
    proxy: {
      // Backend setGlobalPrefix('api/v1'), so /api/x → /api/v1/x
      '/api/auth': {
        target: 'http://localhost:3000/api/v1',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/auth/, '/auth'),
      },
      '/api/admin': {
        target: 'http://localhost:3000/api/v1',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/admin/, '/admin'),
      },
      '/api/curator': {
        target: 'http://localhost:3000/api/v1',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/curator/, '/admin'),
      },
      '/api/questions': {
        target: 'http://localhost:3000/api/v1',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/questions/, '/questions'),
      },
    },
  },

  // ─── Production build ──────────────────────────────────────────────────────
  build: {
    chunkSizeWarningLimit: 600,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react/')) return 'vendor-react'
          if (id.includes('node_modules/recharts/')) return 'vendor-charts'
          if (id.includes('node_modules/date-fns/')) return 'vendor-date-fns'
          if (id.includes('node_modules/lucide-react')) return 'vendor-icons'
          if (id.includes('node_modules/@radix-ui/')) return 'vendor-radix'
          if (
            id.includes('node_modules/class-variance-authority') ||
            id.includes('node_modules/clsx') ||
            id.includes('node_modules/tailwind-merge') ||
            id.includes('node_modules/sonner')
          ) {
            return 'vendor-ui'
          }
          if (id.includes('node_modules/react-router-dom')) return 'vendor-router'
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
      },
    },
  },

  // ─── Optimise deps ─────────────────────────────────────────────────────────
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'lucide-react',
      'recharts',
      'class-variance-authority',
      'clsx',
      'tailwind-merge',
      'sonner',
    ],
  },
})