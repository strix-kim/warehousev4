import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import path from 'path' // Для настройки алиасов

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'), // Алиас '@' указывает на папку src
    },
  },
  build: {
    // Настройки для стабильной работы динамических импортов на Vercel
    rollupOptions: {
      output: {
        // Предотвращаем создание слишком мелких чанков
        manualChunks: {
          'vendor': ['vue', 'vue-router', 'pinia'],
          'ui': ['@vueuse/core', 'lodash-es'],
          'equipment': [
            '@/features/equipment/api/equipment-api',
            '@/features/equipment/api/equipment-lists-api',
            '@/features/equipment/api/equipment-external-data-api'
          ]
        }
      }
    },
    // Увеличиваем лимит для предупреждений о размере чанков
    chunkSizeWarningLimit: 1000
  },
  // Убеждаемся, что base URL правильный для Vercel
  base: '/',
})
