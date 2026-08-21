import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const requiredEnv = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']

// Гейт окружения: без ключей Supabase сборка обязана упасть здесь, а не уехать
// зелёным деплоем с логином, который отвечает «неверный пароль» на всё.
// loadEnv читает .env-файлы и подмешивает переменные процесса — то есть и то,
// что задано в настройках проекта Vercel.
function assertBuildEnv(mode: string) {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const missing = requiredEnv.filter((key) => !env[key]?.trim())
  if (missing.length) {
    throw new Error(
      `Сборка остановлена: не заданы переменные ${missing.join(', ')}. ` +
      'Локально — в .env (образец в .env.example), на проде — в настройках проекта Vercel.',
    )
  }
}

export default defineConfig(({ command, mode }) => {
  if (command === 'build') assertBuildEnv(mode)

  return {
    plugins: [react()],
    base: '/',
    build: {
      // Читаемый стек с прода: своего сборщика ошибок пока нет, карты — единственный источник
      sourcemap: true,
      chunkSizeWarningLimit: 250,
      rollupOptions: {
        output: {
          // Вендор отдельно: правка строки в приложении не должна сбрасывать
          // React и Supabase из кэша у всех сотрудников
          manualChunks(id) {
            if (!id.includes('node_modules')) return
            if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) return 'react-vendor'
            if (/[\\/]node_modules[\\/]@supabase[\\/]/.test(id)) return 'supabase'
            return
          },
        },
      },
    },
  }
})
