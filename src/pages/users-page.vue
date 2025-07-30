<script setup>
/**
 * users-page.vue — современная страница пользователей
 * АДАПТИРОВАНО: приведено к единообразному дизайну с другими страницами
 * Фирменный стиль: фоновый паттерн, breadcrumbs, статистика, фильтры
 * Только просмотр, без CRUD
 * Использует Pinia, Tailwind CSS, feature-sliced архитектуру
 * Все состояния: загрузка, ошибка, пусто
 */
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user-store'
import { storeToRefs } from 'pinia'
import Spinner from '@/shared/ui/atoms/Spinner.vue'
import UserCard from '@/features/users/components/UserCard.vue'
import EmptyState from '@/shared/ui/templates/EmptyState.vue'
import ErrorState from '@/shared/ui/templates/ErrorState.vue'
import Icon from '@/shared/ui/atoms/Icon.vue'
import Card from '@/shared/ui/molecules/Card.vue'

const router = useRouter()
const userStore = useUserStore()
const { users, loading: isLoading, error: hasError } = storeToRefs(userStore)

// Состояние фильтров
const searchQuery = ref('')
const selectedRole = ref('all')

// Computed свойства
const filteredUsers = computed(() => {
  let filtered = users.value

  // Фильтр по поиску
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(user => 
      user.name?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query) ||
      user.role?.toLowerCase().includes(query)
    )
  }

  // Фильтр по роли
  if (selectedRole.value !== 'all') {
    filtered = filtered.filter(user => user.role === selectedRole.value)
  }

  return filtered
})

// Статистика
const statistics = computed(() => {
  const totalUsers = users.value.length
  const adminUsers = users.value.filter(user => user.role === 'admin').length
  const managerUsers = users.value.filter(user => user.role === 'manager').length
  const activeUsers = users.value.filter(user => user.is_active !== false).length
  
  return [
    {
      title: 'Всего пользователей',
      value: totalUsers,
      icon: 'Users',
      color: 'bg-blue-500'
    },
    {
      title: 'Администраторы',
      value: adminUsers,
      icon: 'Shield',
      color: 'bg-red-500'
    },
    {
      title: 'Менеджеры',
      value: managerUsers,
      icon: 'UserCheck',
      color: 'bg-green-500'
    },
    {
      title: 'Активные',
      value: activeUsers,
      icon: 'CheckCircle',
      color: 'bg-purple-500'
    }
  ]
})

onMounted(() => {
  userStore.loadUsers()
})
</script>

<template>
  <!--
    Страница пользователей
    Архитектура: фоновый паттерн + breadcrumbs + заголовок + статистика + фильтры + сетка
    АДАПТИРОВАНО: приведено к единообразному дизайну с другими страницами
  -->
  <div class="min-h-screen bg-gray-50">
    <!-- Фоновый паттерн -->
    <div class="absolute inset-0 w-full h-full pointer-events-none select-none opacity-40 z-0" aria-hidden="true">
      <div style="width:100%;height:100%;background-image:url('data:image/svg+xml,%3Csvg width=\'40\' height=\'40\' viewBox=\'0 0 40 40\' fill=\'none\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Crect x=\'0\' y=\'0\' width=\'40\' height=\'40\' fill=\'none\'/%3E%3Cpath d=\'M 40 0 L 0 0 0 40\' stroke=\'%23e5e7eb\' stroke-width=\'1\'/%3E%3C/svg%3E');background-size:40px 40px;background-repeat:repeat;"></div>
    </div>

    <!-- Основной контейнер -->
    <div class="relative z-10 max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-4">
      <!-- Breadcrumbs -->
      <nav class="flex items-center mb-6" aria-label="Breadcrumb">
        <ol class="inline-flex items-center space-x-1 md:space-x-3">
          <li class="inline-flex items-center">
            <button 
              @click="router.push('/')"
              class="inline-flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
            >
              <Icon name="Home" set="lucide" size="sm" />
              Главная
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

      <!-- Заголовок страницы -->
      <div class="mb-8">
        <div class="flex items-center gap-3">
          <Icon name="Users" set="lucide" size="lg" class="text-blue-600" />
          <h1 class="text-3xl font-bold text-gray-900">Пользователи</h1>
        </div>
        <p class="mt-2 text-sm text-gray-600">
          Управление пользователями системы и их ролями
        </p>
      </div>

      <!-- Статистические карточки -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card
          v-for="stat in statistics"
          :key="stat.title"
          class="text-center"
        >
          <div class="flex items-center justify-center">
            <div class="flex-shrink-0">
              <div class="flex items-center justify-center h-12 w-12 rounded-md text-white" :class="stat.color">
                <Icon :name="stat.icon" set="lucide" size="md" />
              </div>
            </div>
            <div class="ml-4">
              <p class="text-sm font-medium text-gray-500">{{ stat.title }}</p>
              <p class="text-2xl font-semibold text-gray-900">{{ stat.value }}</p>
            </div>
          </div>
        </Card>
      </div>

      <!-- Фильтры и поиск -->
      <div class="mb-8 space-y-4">
        <!-- Фильтры -->
        <div class="flex flex-col sm:flex-row gap-4">
          <!-- Поиск -->
          <div class="flex-1">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Поиск по имени, email или роли..."
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <!-- Фильтр по роли -->
          <select
            v-model="selectedRole"
            class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">Все роли</option>
            <option value="admin">Администраторы</option>
            <option value="manager">Менеджеры</option>
            <option value="user">Пользователи</option>
          </select>
        </div>
      </div>

      <!-- Состояния -->
      <div v-if="isLoading" class="flex justify-center items-center py-16">
        <div class="text-center">
          <Spinner class="h-8 w-8 text-blue-600 mx-auto mb-4" />
          <p class="text-gray-600">Загрузка пользователей...</p>
        </div>
      </div>

      <ErrorState 
        v-else-if="hasError" 
        :message="hasError" 
        description="Не удалось загрузить пользователей"
        class="my-12"
      >
        <button
          @click="userStore.loadUsers()"
          class="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Повторить попытку
        </button>
      </ErrorState>

      <EmptyState 
        v-else-if="filteredUsers.length === 0" 
        message="Пользователи не найдены"
        description="Попробуйте изменить фильтры или добавьте нового пользователя"
        icon="👥"
        class="my-12"
      />

      <!-- Сетка пользователей -->
      <div v-else class="grid gap-4" style="grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));">
        <UserCard
          v-for="user in filteredUsers"
          :key="user.id"
          :user="user"
        />
      </div>
    </div>
  </div>
</template>

<!-- 
  users-page.vue — только просмотр
  - Фоновый паттерн, breadcrumbs, статистика, фильтры
  - Состояния: загрузка, ошибка, пусто
  - Сетка карточек UserCard (адаптивно)
  - Только Tailwind CSS, accessibility, подробные комментарии
--> 