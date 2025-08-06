<script setup>
/**
 * HomePage — современная главная страница с dashboard
 * Использует обновленную дизайн-систему: светлая тема, единая типографика, адаптивность
 * Поддерживает все UI состояния: loading, error, offline, forbidden
 */
import { ref, onMounted, computed, watch } from 'vue'
import { fetchDashboardStats, fetchRecentEvents } from '@/features/dashboard';
import { supabaseSession } from '@/shared/api/supabase'
import Layout from '@/shared/ui/templates/Layout.vue'
import Button from '@/shared/ui/atoms/Button.vue'
import Card from '@/shared/ui/molecules/Card.vue'
import Icon from '@/shared/ui/atoms/Icon.vue'
import Spinner from '@/shared/ui/atoms/Spinner.vue'
import ErrorState from '@/shared/ui/templates/ErrorState.vue'
import ForbiddenState from '@/shared/ui/templates/ForbiddenState.vue'
import OfflineState from '@/shared/ui/templates/OfflineState.vue'
import { useRouter } from 'vue-router'
import { fetchUserById } from '@/features/users/api/userApi'
import SkeletonStatCard from '@/shared/ui/molecules/SkeletonStatCard.vue'

// Состояния данных
const stats = ref({
  equipmentTotal: null,
  equipmentAvailable: null,
  eventsTotal: null,
  eventsActive: null,
  reportsTotal: null,
  reportsRecent: null,
  usersTotal: null,
  usersActive: null
})

const recentEvents = ref([])
const isLoading = ref(true)
const error = ref(null)
const isOffline = ref(!navigator.onLine)
const currentUser = ref(null)
const router = useRouter()
const showUserName = ref(false)
const showRecentEvents = ref(false)

watch(currentUser, (val) => {
  if (val && val.name) {
    showUserName.value = true
  }
})

// Пользователь и роли
const userName = computed(() => currentUser.value?.name || 'Пользователь')
const userRole = computed(() => currentUser.value?.role)
const isAdmin = computed(() => ['admin', 'manager'].includes(userRole.value))
const isForbidden = computed(() => error.value?.includes('403') || error.value?.includes('Forbidden'))

// Показывать секцию "Последние мероприятия" только после загрузки данных
watch(recentEvents, (val) => {
  if (val && val.length > 0) {
    // Небольшая задержка для плавности анимации
    setTimeout(() => {
      showRecentEvents.value = true
    }, 300)
  }
})

// Загрузка данных пользователя
async function loadCurrentUser() {
  const userId = supabaseSession.value?.user?.id
  if (!userId) return
  
  try {
    const { data, error } = await fetchUserById(userId)
    if (error) throw new Error(error)
    currentUser.value = data
  } catch (e) {
    console.warn('Не удалось загрузить данные пользователя:', e.message)
  }
}

// Загрузка статистики dashboard
async function loadDashboardStats() {
  isLoading.value = true
  error.value = null
  const { data, error: fetchError } = await fetchDashboardStats()
  if (fetchError) {
    error.value = fetchError.message || 'Ошибка загрузки данных'
  } else {
    stats.value = data
  }
  isLoading.value = false
}

// Загрузка последних мероприятий
async function loadRecentEvents() {
  const { data, error: fetchError } = await fetchRecentEvents()
  if (fetchError) {
    console.warn('Не удалось загрузить последние мероприятия:', fetchError.message)
  } else {
    recentEvents.value = data || []
  }
}

// Навигация
// Быстрые действия (только публичные, без adminOnly)
const quickActions = [
  { label: 'Создать мероприятие', icon: { name: 'Calendar', set: 'lucide' }, route: '/events', variant: 'primary' },
  { label: 'Добавить оборудование', icon: { name: 'Video', set: 'lucide' }, route: '/equipment', variant: 'primary' }
]

function navigateTo(route) {
  router.push(route)
}

function handleRetry() {
  error.value = null
  loadDashboardStats()
  loadRecentEvents()
}

// Обработчик онлайн/оффлайн
function updateOnlineStatus() {
  isOffline.value = !navigator.onLine
}

// Инициализация
onMounted(async () => {
  window.addEventListener('online', updateOnlineStatus)
  window.addEventListener('offline', updateOnlineStatus)
  
  await loadCurrentUser()
  await Promise.all([
    loadDashboardStats(),
    loadRecentEvents()
  ])
})

const statsLoaded = computed(() =>
  stats.value &&
  stats.value.equipmentTotal !== null &&
  stats.value.eventsTotal !== null &&
  stats.value.reportsTotal !== null &&
  stats.value.usersTotal !== null
)
</script>

<template>
  <!-- Современная главная страница с единым дизайном -->
  <Layout>
    <!-- Приветствие и быстрые действия -->
    <div class="mb-10">
      <div class="mb-8">
        <!-- Крупный заголовок, усиленная иерархия -->
        <h1 class="text-4xl font-extrabold text-gray-900 mb-3">
          Добро пожаловать,
          <transition
            enter-active-class="transition-opacity transition-transform duration-500 ease-out"
            enter-from-class="opacity-0 translate-y-2"
            enter-to-class="opacity-100 translate-y-0"
          >
            <span v-if="showUserName" class="inline-block">{{ userName }}</span>
          </transition>
        </h1>
        <p class="text-base text-gray-400">
          Управление видеооборудованием и мероприятиями
        </p>
      </div>
      <!-- Быстрые действия с SVG-иконками -->
      <div class="flex flex-wrap gap-4">
        <!-- Публичные действия -->
        <Button
          v-for="action in quickActions"
          :key="action.route"
          :variant="action.variant"
          size="md"
          @click="navigateTo(action.route)"
          class="inline-flex items-center gap-2 px-6 py-3 text-base font-semibold"
        >
          <Icon v-if="action.icon" :name="action.icon.name" :set="action.icon.set" size="md" />
          {{ action.label }}
        </Button>
        <!-- Кнопка для админа появляется плавно -->
        <transition
          enter-active-class="transition-opacity transition-transform duration-500 ease-out"
          enter-from-class="opacity-0 translate-y-2"
          enter-to-class="opacity-100 translate-y-0"
        >
          <Button
            v-if="isAdmin"
            :variant="'secondary'"
            size="md"
            @click="navigateTo('/users')"
            class="inline-flex items-center gap-2 px-6 py-3 text-base font-semibold"
          >
            <Icon name="Users" set="lucide" size="md" />
            Управление пользователями
          </Button>
        </transition>
      </div>
    </div>

    <!-- Состояния ошибок и offline -->
    <ForbiddenState 
      v-if="isForbidden"
      message="Нет доступа к данным"
      description="Обратитесь к администратору для получения прав доступа"
    />
    
    <OfflineState 
      v-if="isOffline"
      message="Нет соединения с интернетом"
      description="Проверьте подключение и попробуйте снова"
    />
    
    <ErrorState 
      v-if="error"
      :message="error"
      description="Попробуйте обновить страницу или повторить запрос"
    >
      <Button
        label="Повторить"
        variant="primary"
        @click="handleRetry"
        class="mt-4"
      />
    </ErrorState>

    <!-- Основной контент: всегда показывать, даже если isLoading (тогда в grid будут skeleton-карточки) -->
    <div class="space-y-8">
      <!-- Статистические карточки -->
      <section class="mb-10">
        <h2 class="text-2xl font-bold text-gray-900 mb-8">Обзор системы</h2>
        <div class="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-8">
          <template v-if="isLoading">
            <SkeletonStatCard v-for="i in 4" :key="i" />
          </template>
          <template v-else>
            <!-- Оборудование -->
            <Card variant="default" size="md" :interactive="true" @click="navigateTo('/equipment')">
              <template #header>
                <Icon name="Video" set="lucide" size="lg" class="text-blue-400 mb-2" />
              </template>
              <h3 class="text-lg font-semibold text-gray-900 mb-2">Оборудование</h3>
              <div class="text-3xl font-bold text-gray-900 mb-1">
                {{ stats.equipmentTotal || '—' }}
              </div>
              <p class="text-sm text-gray-400">
                {{ stats.equipmentAvailable || 0 }} доступно
              </p>
            </Card>
            <!-- Мероприятия -->
            <Card variant="default" size="md" :interactive="true" @click="navigateTo('/events')">
              <template #header>
                <Icon name="Calendar" set="lucide" size="lg" class="text-green-400 mb-2" />
              </template>
              <h3 class="text-lg font-semibold text-gray-900 mb-2">Мероприятия</h3>
              <div class="text-3xl font-bold text-gray-900 mb-1">
                {{ stats.eventsTotal || '—' }}
              </div>
              <p class="text-sm text-gray-400">
                {{ stats.eventsActive || 0 }} активных
              </p>
            </Card>
            <!-- Отчёты -->
            <Card variant="default" size="md" :interactive="true" @click="navigateTo('/reports')">
              <template #header>
                <Icon name="FileText" set="lucide" size="lg" class="text-purple-400 mb-2" />
              </template>
              <h3 class="text-lg font-semibold text-gray-900 mb-2">Отчёты</h3>
              <div class="text-3xl font-bold text-gray-900 mb-1">
                {{ stats.reportsTotal || '—' }}
              </div>
              <p class="text-sm text-gray-400">
                {{ stats.reportsRecent || 0 }} за неделю
              </p>
            </Card>
            <!-- Пользователи (только для админов) -->
            <Card 
              v-if="isAdmin" 
              variant="default" 
              size="md" 
              :interactive="true" 
              @click="navigateTo('/users')"
            >
              <template #header>
                <Icon name="Users" set="lucide" size="lg" class="text-orange-400 mb-2" />
              </template>
              <h3 class="text-lg font-semibold text-gray-900 mb-2">Пользователи</h3>
              <div class="text-3xl font-bold text-gray-900 mb-1">
                {{ stats.usersTotal || '—' }}
              </div>
              <p class="text-sm text-gray-400">
                {{ stats.usersActive || 0 }} активных
              </p>
            </Card>
          </template>
        </div>
      </section>

      <!-- Последние мероприятия с плавным появлением -->
      <transition
        enter-active-class="transition-opacity transition-transform duration-700 ease-out"
        enter-from-class="opacity-0 translate-y-4"
        enter-to-class="opacity-100 translate-y-0"
      >
        <section v-if="showRecentEvents && recentEvents.length > 0">
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-xl font-semibold text-gray-900">Последние мероприятия</h2>
            <Button
              variant="ghost"
              size="sm"
              @click="navigateTo('/events')"
              class="text-blue-600 hover:text-blue-700"
            >
              Показать все →
            </Button>
          </div>
          
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card
              v-for="event in recentEvents"
              :key="event.id"
              variant="outlined"
              size="md"
              :interactive="true"
              @click="navigateTo(`/events/${event.id}`)"
            >
              <div class="space-y-3">
                <div class="flex items-start justify-between">
                  <h3 class="font-semibold text-gray-900 text-base leading-tight">
                    {{ event.name }}
                  </h3>
                  <span 
                    v-if="event.is_archived" 
                    class="inline-flex px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full"
                  >
                    Архив
                  </span>
                </div>
                
                <div class="text-sm text-gray-600">
                  <p class="mb-1">
                    <span class="font-medium">Организатор:</span> {{ event.organizer }}
                  </p>
                  <p class="text-gray-500">
                    {{ event.start_date }}
                    <span v-if="event.end_date"> — {{ event.end_date }}</span>
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </section>
      </transition>
    </div>
  </Layout>
</template> 