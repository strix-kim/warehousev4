<script setup>
/**
 * Основной layout приложения: навигация, адаптивность, управление состояниями
 * Использует современную дизайн-систему со светлой темой
 */
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { supabase, supabaseSession } from '@/shared/api/supabase'
import Layout from '@/shared/ui/templates/Layout.vue'
import Navbar from '@/shared/ui/organisms/Navbar.vue'

const router = useRouter()

// Навигационное меню
const menu = [
  { label: 'Главная', route: '/' },
  { label: 'Оборудование', route: '/equipment' },
  { label: 'Мероприятия', route: '/events' },
  { label: 'Отчёты', route: '/reports' },
  { label: 'Пользователи', route: '/users' },
]

// Данные пользователя
const userEmail = computed(() => supabaseSession.value?.user?.email)
const isLoggedIn = computed(() => !!supabaseSession.value?.user)

// Логика выхода
async function handleLogout() {
  try {
    await supabase.auth.signOut()
    router.push('/login')
  } catch (error) {
    console.error('Ошибка при выходе:', error)
  }
}

// Навигация
function handleNavigate(route) {
  router.push(route)
}
</script>

<template>
  <!-- Используем современный Layout с header слотом -->
  <Layout>
    <!-- Header с навигацией -->
    <template #header>
      <Navbar
        :menu="menu"
        :email="isLoggedIn ? userEmail : null"
        @navigate="handleNavigate"
        @logout="handleLogout"
      />
    </template>
    
    <!-- Основной контент -->
    <slot />
  </Layout>
</template>

 