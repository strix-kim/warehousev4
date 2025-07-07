import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import path from 'path'

// Конфиг Vitest для тестирования Vue-компонентов и поддержки алиаса '@'
export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom', // эмулирует браузерное окружение
    globals: true, // позволяет использовать describe/it без импорта
    coverage: {
      reporter: ['text', 'html'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
}) 