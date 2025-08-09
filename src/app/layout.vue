<script setup>
/**
 * Основной layout EPR System v2 - UI Kit v2 + Bento стиль
 * Минималистичный дизайн с навигацией
 */
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/app/store/auth-store'

// UI Kit v2
import { 
  ButtonV2,
  IconV2,
  NotificationV2
} from '@/shared/ui-v2'

const router = useRouter()
const authStore = useAuthStore()

// Local state
const notificationSystem = ref(null)
// activeSubmenu больше не нужен - используем CSS :hover

// Навигационное меню с подразделами
const menu = [
  { label: 'Главная', route: '/' },
  { 
    label: 'Оборудование', 
    route: '/equipment',
    submenu: [
      { label: '📊 Обзор модуля', route: '/equipment' },
      { label: '🔧 Управление', route: '/equipment/items' },
      { label: '📋 Списки', route: '/equipment/lists' },
      { label: '➕ Создать список', route: '/equipment/lists/create' }
    ]
  },
  { label: 'Мероприятия', route: '/events' },
  { label: 'Отчёты', route: '/reports', disabled: true },
  { label: 'Пользователи', route: '/users', disabled: true },
]

// Данные пользователя через auth store
const userEmail = computed(() => authStore.user?.email)
const isLoggedIn = computed(() => authStore.isAuthenticated)



// Логика выхода через auth store
async function handleLogout() {
  try {
    console.log('🚪 Layout: выполняем logout через auth store')
    await authStore.logout()
    router.push('/login')
    console.log('✅ Layout: logout завершен, перенаправляем на /login')
  } catch (error) {
    console.error('❌ Layout: ошибка при выходе:', error)
  }
}

// Навигация
function handleNavigate(route) {
  const menuItem = menu.find(item => item.route === route)
  if (menuItem && menuItem.disabled) {
    return // Не переходим на отключенные страницы
  }
  router.push(route)
}

// Управление подменю теперь через CSS :hover
// JavaScript функции больше не нужны

// ❌ УДАЛЕНО: дублирующая auth подписка (уже есть в auth-store.js)
// Все auth logic теперь централизован в auth store

onMounted(() => {
  console.log('🏗️ Layout: монтирован (auth logic в auth-store.js)')
})

onUnmounted(() => {
  console.log('🧹 Layout: размонтирован')
})
</script>

<style scoped>
/* Навигационный dropdown - чистый CSS :hover */
.nav-dropdown {
  display: none;
}

/* Показываем dropdown при наведении на wrapper */
.nav-dropdown-wrapper:hover .nav-dropdown {
  display: block;
  animation: dropdown-fadeIn 0.15s ease-out;
}

/* Буферная зона для плавного перехода */
.nav-dropdown-wrapper::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  height: 4px;
  background: transparent;
  pointer-events: auto;
}

@keyframes dropdown-fadeIn {
  from {
    opacity: 0;
    transform: translateY(-2px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>

<template>
  <div class="min-h-screen bg-accent">
    <!-- Top Navigation -->
    <nav class="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div class="max-w-7xl mx-auto px-4">
        <div class="flex justify-between items-center h-16">
          <!-- Logo / Brand -->
          <div class="flex items-center gap-4">
            <h2 class="text-xl font-bold text-primary">EPR System</h2>
          </div>

          <!-- Navigation Menu -->
          <div class="hidden md:flex items-center gap-1">
            <template v-for="item in menu" :key="item.route">
              <!-- Простая кнопка (без подменю) -->
              <ButtonV2
                v-if="!item.submenu"
                variant="ghost"
                size="sm"
                @click="handleNavigate(item.route)"
                :class="{ 'bg-gray-100': $route.path === item.route }"
                :disabled="item.disabled"
                class="whitespace-nowrap"
              >
                {{ item.label }}
                <span
                  v-if="item.disabled"
                  class="ml-1 inline-block bg-warning text-white text-xs px-1.5 py-0.5 rounded-full"
                >
                  В разработке
                </span>
              </ButtonV2>
              
              <!-- Dropdown кнопка (с подменю) -->
              <div v-else class="relative nav-dropdown-wrapper">
                <ButtonV2
                  variant="ghost"
                  size="sm"
                  @click="handleNavigate(item.route)"
                  :class="{ 'bg-gray-100': $route.path.startsWith(item.route) }"
                >
                  {{ item.label }}
                  <template #icon>
                    <IconV2 name="chevron-down" size="xs" />
                  </template>
                </ButtonV2>
                
                <!-- Dropdown подменю -->
                <div 
                  class="absolute top-full left-0 bg-white border border-gray-200 rounded-lg shadow-lg py-2 min-w-48 z-50 nav-dropdown"
                >
                  <button
                    v-for="subitem in item.submenu"
                    :key="subitem.route"
                    @click="handleNavigate(subitem.route)"
                    class="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                    :class="{ 'bg-blue-50 text-blue-600': $route.path === subitem.route }"
                  >
                    {{ subitem.label }}
                  </button>
                </div>
              </div>
            </template>
          </div>

          <!-- User Menu -->
          <div class="flex items-center gap-3">
            <span v-if="isLoggedIn" class="text-sm text-secondary hidden sm:block">
              {{ userEmail }}
            </span>
            
            <ButtonV2
              v-if="isLoggedIn"
              variant="ghost"
              size="sm"
              @click="handleLogout"
            >
              Выйти
            </ButtonV2>
          </div>
        </div>
      </div>
    </nav>

    <!-- Mobile Navigation (if needed) -->
    <div class="md:hidden bg-white border-b border-gray-200">
      <div class="px-4 py-2 space-y-1">
                    <ButtonV2
              v-for="item in menu"
              :key="item.route"
              variant="ghost"
              size="sm"
              @click="handleNavigate(item.route)"
              :class="{ 'bg-gray-100': $route.path === item.route }"
              :disabled="item.disabled"
              class="w-full justify-start whitespace-nowrap"
            >
              {{ item.label }}
              <span
                v-if="item.disabled"
                class="ml-1 inline-block bg-warning text-white text-xs px-1.5 py-0.5 rounded-full"
              >
                В разработке
              </span>
            </ButtonV2>
      </div>
    </div>

    <!-- Main Content -->
    <main>
      <slot />
    </main>

    <!-- Notification System -->
    <NotificationV2 ref="notificationSystem" position="top-right" />
  </div>
</template>

 