import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true, // describe/it/expect without imports, same as Jest in the ExB client
    include: ['permit-filter/tests/**/*.test.ts']
  }
})
