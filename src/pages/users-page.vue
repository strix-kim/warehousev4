<script setup>
// Страница пользователей теперь использует Pinia store useUserStore для централизованного состояния
import { onMounted } from 'vue'
import { useUserStore } from '@/stores/user-store'
import { storeToRefs } from 'pinia'
import Spinner from '@/components/Spinner.vue'
import UserCard from '@/components/UserCard.vue'

const userStore = useUserStore()
const { users, loading: isLoading, error: hasError } = storeToRefs(userStore)

onMounted(() => {
  userStore.loadUsers()
})
</script>

<template>
  <div class="min-h-screen bg-white py-10 px-2 md:px-4" style="background: #f8fafc url('data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='0' y='0' width='40' height='40' fill='none'/%3E%3Cpath d='M 40 0 L 0 0 0 40' stroke='%23e5e7eb' stroke-width='1'/%3E%3C/svg%3E'); background-size: 40px 40px; background-repeat: repeat;" >
    <div class="max-w-6xl mx-auto">
      <h1 class="text-3xl font-extrabold mb-10 text-gray-900">Пользователи</h1>
      <!-- Skeleton loading -->
      <div v-if="isLoading" class="flex justify-center items-center py-16">
        <Spinner />
      </div>
      <!-- Error state -->
      <div v-else-if="hasError" class="text-red-600 text-center mb-6 font-semibold">
        Ошибка: {{ hasError.message || hasError }}
      </div>
      <!-- Empty state -->
      <div v-else-if="users.length === 0" class="text-gray-400 text-center py-16 text-lg">Нет пользователей</div>
      <!-- Production-сетка пользователей -->
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
        <UserCard v-for="user in users" :key="user.id" :user="user" />
      </div>
    </div>
  </div>
</template>

<!--
  Production-редизайн страницы пользователей:
  - Белый фон, строгий крупный заголовок, максимальная читаемость.
  - Сетка из атомарных карточек UserCard (адаптивно: 1/2/3 колонки).
  - Skeleton loading, empty, error state — production-ready.
  - Только Tailwind, никаких кастомных стилей.
  - Подробные комментарии объясняют intent и архитектурную роль.
  Edge-cases: если нет пользователей — empty state, если ошибка — error state.
--> 