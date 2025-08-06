<script setup>
// Главный компонент приложения. Вся маршрутизация осуществляется через <router-view />.
import Layout from './app/layout.vue'
import { useRoute } from 'vue-router'
import { computed, ref, onMounted } from 'vue'
import { useAuthStore } from '@/app/store/auth-store'
import Spinner from '@/shared/ui/atoms/Spinner.vue'

const route = useRoute()
const authStore = useAuthStore()

// Состояние инициализации авторизации
const isAuthInitialized = ref(false)

// Определяем, нужно ли показывать Layout
const shouldShowLayout = computed(() => {
  // Не показываем Layout для публичных страниц (например, login)
  return !route.meta.public
})

// Инициализация авторизации при загрузке приложения
onMounted(async () => {
  try {
    await authStore.init()
  } finally {
    isAuthInitialized.value = true
  }
})
</script>

<template>
  <!-- Показываем спиннер до инициализации авторизации -->
  <div v-if="!isAuthInitialized" class="min-h-screen flex items-center justify-center bg-gray-50">
    <div class="text-center">
      <Spinner class="h-12 w-12 text-blue-600 mx-auto mb-4" />
      <p class="text-gray-600">Загрузка приложения...</p>
    </div>
  </div>
  
  <!-- Основной контент после инициализации -->
  <template v-else>
    <Layout v-if="shouldShowLayout">
    <router-view />
  </Layout>
  <template v-else>
    <router-view />
  </template>
  </template>
</template>

<style scoped>

</style>
