import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'RentalBasic - Event Rentals',
        short_name: 'RentalBasic',
        description: 'Chair, tables, videoke and event tent rentals',
        theme_color: '#1d4ed8',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/utils/format.ts', 'src/utils/media.ts'],
      thresholds: {
        lines: 90,
        functions: 100,
        branches: 80,
        statements: 90,
      },
    },
  },
})
