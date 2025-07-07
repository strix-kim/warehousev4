<script setup>
// Основной layout приложения: боковая навигация, верхнее меню, адаптивность.
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { supabase, supabaseSession } from '@/shared/api/supabase'

const sidebarVisible = ref(false)
const router = useRouter()

const menu = [
  { label: 'Главная', route: '/' },
  { label: 'Оборудование', route: '/equipment' },
  { label: 'Мероприятия', route: '/events' },
  { label: 'Отчёты', route: '/reports' },
  { label: 'Пользователи', route: '/users' },
]

const userEmail = computed(() => supabaseSession.value?.user?.email)
const isLoggedIn = computed(() => !!supabaseSession.value?.user)

// Logout и редирект на /login
async function logout() {
  await supabase.auth.signOut()
  router.push('/login')
}
</script>

<template>
  <header class="w-full flex items-center px-0 py-0 z-20 sticky top-0 select-none" style="backdrop-filter: blur(2px);">
    <div class="flex-1 flex items-center bg-gray-900/80 border-b border-white/10 h-14 pl-6 pr-2">
      <!-- Логотип и название -->
      <div class="flex items-center gap-2 mr-8">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-7 h-7 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4a2 2 0 001-1.73z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.27 6.96L12 12.01l8.73-5.05" />
        </svg>
        <span class="text-xl font-bold tracking-widest font-mono uppercase text-gray-100" style="letter-spacing:0.12em;">Argo Warehouse</span>
      </div>
      <!-- Навигация -->
      <nav class="flex gap-0.5 items-center">
        <template v-for="(item, idx) in menu" :key="item.label">
          <button
            @click="router.push(item.route)"
            class="px-3 py-2 font-mono uppercase text-sm tracking-wider text-gray-200 border-b-2 border-transparent hover:border-red-500 hover:text-red-500 transition-all duration-150 bg-transparent focus:outline-none"
          >
            {{ item.label }}
          </button>
          <span v-if="idx < menu.length - 1" class="text-gray-600 mx-1 select-none">|</span>
        </template>
      </nav>
      <!-- Spacer -->
      <div class="flex-1"></div>
      <!-- Пользователь и выход -->
      <div v-if="isLoggedIn" class="flex items-center gap-2 pr-6">
        <span class="text-xs font-mono text-gray-400">{{ userEmail }}</span>
        <button
          @click="logout"
          class="ml-2 px-2 py-1 text-red-500 font-semibold border-b-2 border-transparent hover:border-red-700 hover:text-red-700 bg-transparent transition-all duration-150 text-xs"
        >
          Выйти
        </button>
      </div>
    </div>
  </header>
  <main class="w-full">
    <slot />
  </main>
</template>

<!--
  Светлый, читаемый glassmorphism: backdrop-blur-lg, bg-white/70, border-gray-300, светлый фон.
  Кнопки: второстепенные — белые, акцентные — красные.
  Тексты: всегда тёмные.
  Минимализм, все скругления и blur сохраняются.
  Подробные комментарии на русском языке.
-->
<style scoped>
@media (min-width: 768px) {
  aside {
    display: none;
  }
}
</style> 