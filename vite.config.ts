/// <reference types="vitest/config" />
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  build: {
    rollupOptions: {
      output: {
        // Long-lived vendor chunks cache separately from app code.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react'
          if (/[\\/]node_modules[\\/](radix-ui|@radix-ui|cmdk|sonner|lucide-react)[\\/]/.test(id)) {
            return 'ui'
          }
          return 'vendor'
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'text', 'html'],
      include: ['src/**', 'mock-server/**'],
      exclude: [
        'src/shared/components/ui/**', // vendored shadcn/ui primitives
        'src/test/**',
        '**/__tests__/**',
        '**/*.test.*',
        'src/main.tsx',
        'src/**/*.d.ts',
        'src/types/**', // type-only modules
        'src/services/realtime/transport.ts', // interface only
        'mock-server/server.ts', // CLI entry; the server itself is tested
      ],
      thresholds: { statements: 90, branches: 85, functions: 90, lines: 90 },
    },
  },
})
