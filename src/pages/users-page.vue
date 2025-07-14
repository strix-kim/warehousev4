<script setup>
/**
 * users-page.vue — современная страница пользователей (только просмотр)
 * Фирменный стиль: градиентный фон, breadcrumbs, крупный заголовок, адаптивная сетка
 * Использует Pinia, Tailwind CSS, feature-sliced архитектуру
 * Все состояния: загрузка, ошибка, пусто
 */
import { onMounted } from 'vue'
import { useUserStore } from '@/stores/user-store'
import { storeToRefs } from 'pinia'
import Spinner from '@/shared/ui/atoms/Spinner.vue'
import UserCard from '@/features/users/components/UserCard.vue'
import EmptyState from '@/shared/ui/templates/EmptyState.vue'
import ErrorState from '@/shared/ui/templates/ErrorState.vue'
import Icon from '@/shared/ui/atoms/Icon.vue'

const userStore = useUserStore()
const { users, loading: isLoading, error: hasError } = storeToRefs(userStore)

onMounted(() => {
  userStore.loadUsers()
})
</script>

<template>
  <!-- Градиентный фон на всю ширину и высоту окна -->
  <div class="fixed inset-0 min-h-screen min-w-full bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 -z-10"></div>
  <div class="relative z-10">
    <div class="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-4 md:px-4 min-h-screen flex flex-col">
      
      <!-- Breadcrumbs -->
      <nav class="flex mb-6" aria-label="Breadcrumb">
        <ol class="inline-flex items-center space-x-1 md:space-x-3">
          <li>
            <button
              @click="$router.push('/')"
              class="inline-flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
            >
              <Icon name="ArrowLeft" set="lucide" size="sm" />
              На главную
            </button>
          </li>
          <li aria-current="page">
            <div class="inline-flex items-center gap-2">
              <Icon name="ChevronRight" set="lucide" size="sm" class="text-gray-400" />
              <span class="text-sm font-medium text-gray-500">Пользователи</span>
            </div>
          </li>
        </ol>
      </nav>

      <!-- Хедер: заголовок -->
      <div class="flex items-center gap-3 mb-8">
        <Icon name="Users" set="lucide" size="lg" class="text-blue-600" />
        <h1 class="text-3xl font-bold text-gray-900">Пользователи</h1>
      </div>

      <!-- Состояния -->
      <div v-if="isLoading" class="flex justify-center items-center py-16">
        <Spinner size="lg" />
      </div>
      <ErrorState v-else-if="hasError" :message="hasError" @retry="userStore.loadUsers()" />
      <EmptyState v-else-if="users.length === 0" message="Нет пользователей" description="Пользователи ещё не добавлены." />

      <!-- Сетка пользователей -->
      <div v-else class="grid gap-4" style="grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));">
        <UserCard
          v-for="user in users"
          :key="user.id"
          :user="user"
        />
      </div>
    </div>
  </div>
</template>

<!-- 
  users-page.vue — только просмотр
  - Градиентный фон, breadcrumbs, крупный заголовок
  - Состояния: загрузка, ошибка, пусто
  - Сетка карточек UserCard (адаптивно)
  - Только Tailwind CSS, accessibility, подробные комментарии
--> 