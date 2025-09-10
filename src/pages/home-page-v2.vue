<template>
  <div class="min-h-screen bg-accent">
    <!-- Header с приветствием -->
    <div class="bg-white border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4 py-6">
        <div>
          <h1 class="text-3xl font-bold text-primary">
            Добро пожаловать, {{ userName }}
          </h1>
          <p class="text-sm text-secondary mt-1">
            EPR System — управление видеооборудованием и мероприятиями
          </p>
        </div>
      </div>
    </div>

    <!-- Main Dashboard Content -->
    <div class="max-w-7xl mx-auto px-4 py-6">
      <BentoGrid columns="auto" gap="6">
        
        <!-- Модуль Оборудования - большая карточка -->
        <BentoCard 
          title="Оборудование" 
          size="2x2" 
          variant="default"
          :loading="isLoading"
          @click="navigateTo('/equipment')"
          class="cursor-pointer hover:shadow-lg transition-shadow"
        >
          <template #icon>
            <IconV2 name="package" size="md" color="primary" />
          </template>
          <template #actions>
            <ButtonV2 
              variant="ghost" 
              size="sm"
              @click.stop="navigateTo('/equipment/items')"
            >
              <template #icon>
                <IconV2 name="external-link" size="xs" />
              </template>
              Открыть
            </ButtonV2>
          </template>
          
          <div class="space-y-6">
            <!-- Основная статистика -->
            <div class="text-center p-6">
              <div class="text-4xl font-bold text-primary mb-2">
                {{ stats.equipmentTotal || '—' }}
              </div>
              <div class="text-sm text-secondary">Единиц оборудования</div>
            </div>
            
            <!-- Быстрые действия -->
            <div class="border-t border-secondary/10 pt-4 space-y-2">
              <ButtonV2 
                variant="ghost" 
                size="sm" 
                @click.stop="navigateTo('/equipment/items')"
                class="w-full justify-start"
              >
                <template #icon>
                  <IconV2 name="settings" size="xs" />
                </template>
                Управление оборудованием
              </ButtonV2>
              <ButtonV2 
                variant="ghost" 
                size="sm" 
                @click.stop="navigateTo('/equipment/lists')"
                class="w-full justify-start"
              >
                <template #icon>
                  <IconV2 name="list" size="xs" />
                </template>
                Списки оборудования
              </ButtonV2>
              <ButtonV2 
                variant="ghost" 
                size="sm" 
                @click.stop="navigateTo('/equipment/lists/create')"
                class="w-full justify-start"
              >
                <template #icon>
                  <IconV2 name="plus" size="xs" />
                </template>
                Создать новый список
              </ButtonV2>
            </div>
          </div>
        </BentoCard>

        <!-- Модуль Мероприятий - активная карточка -->
        <BentoCard 
          title="Мероприятия" 
          size="1x1" 
          variant="default"
          :loading="isLoading"
          @click="navigateTo('/events')"
          class="cursor-pointer hover:shadow-lg transition-shadow"
        >
          <template #icon>
            <IconV2 name="calendar" size="md" color="primary" />
          </template>
          <template #actions>
            <ButtonV2 
              variant="ghost" 
              size="sm"
              @click.stop="navigateTo('/events')"
            >
              <template #icon>
                <IconV2 name="external-link" size="xs" />
              </template>
              Открыть
            </ButtonV2>
          </template>
          
          <div class="text-center space-y-3">
            <div class="text-2xl font-bold text-primary">
              {{ stats.eventsTotal || '—' }}
            </div>
            <StatusBadgeV2 label="Доступно" variant="success" size="sm" />
            <p class="text-sm text-secondary">
              Планирование и управление мероприятиями
            </p>
          </div>
        </BentoCard>

        <BentoCard 
          title="Отчёты" 
          size="1x1" 
          variant="default"
          :disabled="true"
          class="opacity-60"
        >
          <template #icon>
            <IconV2 name="file-text" size="md" color="secondary" />
          </template>
          
          <div class="text-center space-y-3">
            <div class="text-2xl font-bold text-secondary">—</div>
            <StatusBadgeV2 label="В разработке" variant="warning" size="sm" />
            <p class="text-sm text-secondary">
              Аналитика и отчётность
            </p>
          </div>
        </BentoCard>

        <BentoCard 
          title="Пользователи" 
          size="1x1" 
          variant="default"
          :disabled="true"
          class="opacity-60"
        >
          <template #icon>
            <IconV2 name="users" size="md" color="secondary" />
          </template>
          
          <div class="text-center space-y-3">
            <div class="text-2xl font-bold text-secondary">—</div>
            <StatusBadgeV2 label="В разработке" variant="warning" size="sm" />
            <p class="text-sm text-secondary">
              Управление пользователями и ролями
            </p>
          </div>
        </BentoCard>

        <!-- Системная информация -->
        <BentoCard 
          title="Системная информация" 
          size="2x1" 
          variant="minimal"
        >
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div class="text-center">
              <div class="text-lg font-semibold text-primary">
                {{ authStore.user?.user_metadata?.name || currentUser?.name || 'Не указано' }}
              </div>
              <div class="text-sm text-secondary">Имя пользователя</div>
            </div>
            <div class="text-center">
              <div class="text-lg font-semibold text-primary">
                {{ currentUser?.role || 'Пользователь' }}
              </div>
              <div class="text-sm text-secondary">Ваша роль</div>
            </div>
            <div class="text-center">
              <div class="text-lg font-semibold text-primary">
                {{ new Date().toLocaleDateString('ru') }}
              </div>
              <div class="text-sm text-secondary">Сегодня</div>
            </div>
            <div class="text-center">
              <StatusBadgeV2 label="Онлайн" variant="success" size="sm" />
              <div class="text-sm text-secondary mt-1">Статус системы</div>
            </div>
          </div>
        </BentoCard>

        <!-- Последние мероприятия (если есть) -->
        <BentoCard 
          v-if="recentEvents.length > 0"
          title="Последние мероприятия" 
          size="2x1" 
          variant="default"
          scrollable
        >
          <template #actions>
            <ButtonV2 
              variant="ghost" 
              size="sm"
              @click="navigateTo('/events')"
            >
              Все мероприятия
            </ButtonV2>
          </template>
          
          <div class="space-y-3">
            <div 
              v-for="event in recentEvents.slice(0, 3)"
              :key="event.id"
              class="p-3 bg-accent/30 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
              @click="navigateTo(`/events/${event.id}`)"
            >
              <div class="flex items-start justify-between">
                <div class="flex-1">
                  <h4 class="font-medium text-primary">{{ event.name }}</h4>
                  <p class="text-sm text-secondary">{{ event.organizer }}</p>
                </div>
                <StatusBadgeV2 
                  :label="event.is_archived ? 'Архив' : 'Активно'"
                  :variant="event.is_archived ? 'inactive' : 'success'"
                  size="xs"
                />
              </div>
            </div>
          </div>
        </BentoCard>

        <!-- Помощь и поддержка -->
        <BentoCard 
          title="Помощь и поддержка" 
          size="1x1" 
          variant="minimal"
        >
          <div class="space-y-3">
            <ButtonV2 
              variant="ghost" 
              size="sm"
              @click="navigateTo('/ui-kit')"
              class="w-full justify-start"
            >
              <template #icon>
                <IconV2 name="palette" size="xs" />
              </template>
              UI Kit
            </ButtonV2>
            <p class="text-sm text-secondary">
              Документация по дизайн-системе и компонентам
            </p>
          </div>
        </BentoCard>

      </BentoGrid>
    </div>

    <!-- Notification System -->
    <NotificationV2 ref="notificationSystem" position="top-right" />
  </div>
</template>

<script setup>
/**
 * HomePage v2 — современный dashboard с UI Kit v2 + Bento дизайн
 * Модульная архитектура с акцентом на доступный модуль Оборудования
 */
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/app/store/auth-store'

// UI Kit v2
import { 
  ButtonV2,
  IconV2,
  StatusBadgeV2,
  NotificationV2
} from '@/shared/ui-v2'
import BentoGrid from '@/shared/ui-v2/layouts/BentoGrid.vue'
import BentoCard from '@/shared/ui-v2/layouts/BentoCard.vue'

// APIs
import { fetchDashboardStats, fetchRecentEvents } from '@/features/dashboard'

const router = useRouter()
const authStore = useAuthStore()

// Reactive state
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
const currentUser = ref(null)
const notificationSystem = ref(null)



// Computed
const userName = computed(() => {
  return currentUser.value?.name || 
         authStore.user?.user_metadata?.name || 
         authStore.user?.email?.split('@')[0] || 
         'Пользователь'
})

// Methods
function navigateTo(route) {
  router.push(route)
}



async function loadCurrentUser() {
  try {
    const userId = authStore.user?.id
    if (!userId) return
    
    // Динамический импорт API пользователей
    const { fetchUserById } = await import('@/features/users/api/userApi')
    const { data, error } = await fetchUserById(userId)
    if (error) throw new Error(error)
    currentUser.value = data
    
    console.log('✅ Загружены данные пользователя:', data)
  } catch (e) {
    console.warn('Не удалось загрузить данные пользователя:', e.message)
  }
}

async function loadDashboardData() {
  isLoading.value = true
  
  try {
    // Загружаем данные пользователя
    await loadCurrentUser()
    
    // Загружаем основную статистику
    const { data: statsData, error: statsError } = await fetchDashboardStats()
    if (statsError) {
      throw new Error(statsError.message)
    }
    stats.value = statsData

    // Загружаем последние мероприятия
    const { data: eventsData, error: eventsError } = await fetchRecentEvents()
    if (!eventsError && eventsData) {
      recentEvents.value = eventsData
    }

  } catch (err) {
    error.value = err.message
    notificationSystem.value?.add({
      type: 'error',
      title: 'Ошибка загрузки',
      message: err.message
    })
  } finally {
    isLoading.value = false
  }
}

// Lifecycle
onMounted(async () => {
  await loadDashboardData()
})
</script>