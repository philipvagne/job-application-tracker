import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Fixed zone so week-boundary tests behave the same locally and in CI.
    env: { TZ: 'Europe/Stockholm' },
  },
})
