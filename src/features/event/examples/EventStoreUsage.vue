<template>
  <!--
    EventStoreUsage.vue — пример использования event store
    Демонстрирует все возможности: CRUD, фильтрация, состояния загрузки, обработка ошибок
  -->
  <div class="max-w-6xl mx-auto p-6 space-y-8">
    <header>
      <h1 class="text-3xl font-bold text-gray-900 mb-2">Пример использования Event Store</h1>
      <p class="text-gray-600">Демонстрация всех возможностей Pinia store для мероприятий</p>
    </header>
    
    <!-- Панель управления -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 class="text-xl font-semibold mb-4">Управление данными</h2>
      
      <div class="flex flex-wrap gap-4 mb-6">
        <Button
          label="Загрузить все"
          :loading="loading"
          @click="eventStore.loadEvents()"
        />
        <Button
          label="Загрузить активные"
          :loading="loading"
          @click="eventStore.loadActiveEvents()"
        />
        <Button
          label="Загрузить архивные"
          :loading="loading"
          @click="eventStore.loadArchivedEvents()"
        />
        <Button
          label="Получить статистику"
          @click="loadStats"
        />
        <Button
          label="Очистить ошибки"
          variant="secondary"
          @click="eventStore.clearErrors()"
        />
      </div>
      
      <!-- Фильтры -->
      <div class="flex items-center gap-4 mb-4">
        <label class="text-sm font-medium text-gray-700">Фильтр:</label>
        <select 
          v-model="selectedFilter"
          @change="eventStore.setArchiveFilter(selectedFilter)"
          class="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="all">Все мероприятия</option>
          <option value="active">Только активные</option>
          <option value="archived">Только архивные</option>
        </select>
      </div>
      
      <!-- Поиск -->
      <div class="flex items-center gap-4">
        <label class="text-sm font-medium text-gray-700">Поиск:</label>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Введите текст для поиска..."
          class="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
        />
        <Button
          label="Найти"
          size="sm"
          @click="performSearch"
        />
      </div>
    </div>
    
    <!-- Статистика и состояния -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Статистика -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 class="text-lg font-semibold mb-4">Статистика</h3>
        <div class="space-y-3">
          <div class="flex justify-between">
            <span class="text-gray-600">Всего:</span>
            <span class="font-semibold">{{ eventsStats.total }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-600">Активных:</span>
            <span class="font-semibold text-green-600">{{ eventsStats.active }} ({{ eventsStats.activePercentage }}%)</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-600">Архивных:</span>
            <span class="font-semibold text-red-600">{{ eventsStats.archived }} ({{ eventsStats.archivedPercentage }}%)</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-600">Отфильтровано:</span>
            <span class="font-semibold">{{ filteredEvents.length }}</span>
          </div>
        </div>
      </div>
      
      <!-- Состояния загрузки -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 class="text-lg font-semibold mb-4">Состояния загрузки</h3>
        <div class="space-y-3">
          <div class="flex justify-between items-center">
            <span class="text-gray-600">Общая загрузка:</span>
            <span :class="loading ? 'text-blue-600' : 'text-gray-400'">
              {{ loading ? '🔄' : '✅' }}
            </span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-gray-600">Создание:</span>
            <span :class="loadingCreate ? 'text-blue-600' : 'text-gray-400'">
              {{ loadingCreate ? '🔄' : '✅' }}
            </span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-gray-600">Обновление:</span>
            <span :class="loadingUpdate ? 'text-blue-600' : 'text-gray-400'">
              {{ loadingUpdate ? '🔄' : '✅' }}
            </span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-gray-600">Удаление:</span>
            <span :class="loadingDelete ? 'text-blue-600' : 'text-gray-400'">
              {{ loadingDelete ? '🔄' : '✅' }}
            </span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-gray-600">Любая операция:</span>
            <span :class="isLoading ? 'text-blue-600' : 'text-gray-400'">
              {{ isLoading ? '🔄' : '✅' }}
            </span>
          </div>
        </div>
      </div>
      
      <!-- Метаданные -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 class="text-lg font-semibold mb-4">Метаданные</h3>
        <div class="space-y-3">
          <div>
            <span class="text-gray-600 text-sm">Последняя загрузка:</span>
            <div class="text-sm font-mono">
              {{ lastFetch ? formatDate(lastFetch) : 'Не загружались' }}
            </div>
          </div>
          <div>
            <span class="text-gray-600 text-sm">Архивирование:</span>
            <div class="text-sm">
              {{ archivingSupported ? '✅ Поддерживается' : '❌ Не поддерживается' }}
            </div>
          </div>
          <div>
            <span class="text-gray-600 text-sm">Фильтр:</span>
            <div class="text-sm font-medium">{{ archiveFilter }}</div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Ошибки -->
    <div v-if="hasErrors" class="bg-red-50 border border-red-200 rounded-xl p-6">
      <h3 class="text-lg font-semibold text-red-800 mb-4">Ошибки</h3>
      <div class="space-y-2">
        <div v-if="error" class="text-red-700">
          <strong>Общая ошибка:</strong> {{ error }}
        </div>
        <div v-if="createError" class="text-red-700">
          <strong>Ошибка создания:</strong> {{ createError }}
        </div>
        <div v-if="updateError" class="text-red-700">
          <strong>Ошибка обновления:</strong> {{ updateError }}
        </div>
        <div v-if="deleteError" class="text-red-700">
          <strong>Ошибка удаления:</strong> {{ deleteError }}
        </div>
      </div>
    </div>
    
    <!-- Форма создания -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 class="text-lg font-semibold mb-4">Создать мероприятие</h3>
      <form @submit.prevent="createNewEvent" class="space-y-4">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <input
            v-model="newEvent.name"
            type="text"
            placeholder="Название мероприятия"
            class="px-3 py-2 border border-gray-300 rounded-lg"
            required
          />
          <input
            v-model="newEvent.organizer"
            type="text"
            placeholder="Организатор"
            class="px-3 py-2 border border-gray-300 rounded-lg"
            required
          />
          <input
            v-model="newEvent.location"
            type="text"
            placeholder="Локация"
            class="px-3 py-2 border border-gray-300 rounded-lg"
            required
          />
          <input
            v-model="newEvent.start_date"
            type="date"
            class="px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        <textarea
          v-model="newEvent.description"
          placeholder="Описание мероприятия"
          rows="3"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg"
        ></textarea>
        <Button
          type="submit"
          label="Создать мероприятие"
          :loading="loadingCreate"
          class="w-full"
        />
      </form>
    </div>
    
    <!-- Текущая запись -->
    <div v-if="currentEvent" class="bg-blue-50 border border-blue-200 rounded-xl p-6">
      <h3 class="text-lg font-semibold text-blue-800 mb-4">Текущая запись</h3>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <strong>ID:</strong> {{ currentEvent.id }}
        </div>
        <div>
          <strong>Название:</strong> {{ currentEvent.name }}
        </div>
        <div>
          <strong>Организатор:</strong> {{ currentEvent.organizer }}
        </div>
        <div>
          <strong>Локация:</strong> {{ currentEvent.location }}
        </div>
        <div>
          <strong>Статус:</strong> 
          <span :class="currentEvent.is_archived ? 'text-red-600' : 'text-green-600'">
            {{ currentEvent.is_archived ? 'Архивное' : 'Активное' }}
          </span>
        </div>
        <div>
          <strong>Создано:</strong> {{ formatDate(currentEvent.created_at) }}
        </div>
      </div>
      <div class="flex gap-2 mt-4">
        <Button
          label="Архивировать"
          size="sm"
          variant="secondary"
          :loading="loadingDelete"
          @click="eventStore.deleteEvent(currentEvent.id)"
          v-if="!currentEvent.is_archived"
        />
        <Button
          label="Восстановить"
          size="sm"
          variant="secondary"
          :loading="loadingUpdate"
          @click="eventStore.restoreEvent(currentEvent.id)"
          v-if="currentEvent.is_archived"
        />
        <Button
          label="Очистить"
          size="sm"
          variant="secondary"
          @click="eventStore.clearCurrentEvent()"
        />
      </div>
    </div>
    
    <!-- Список мероприятий -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 class="text-lg font-semibold mb-4">
        Мероприятия ({{ displayedEvents.length }})
      </h3>
      
      <div v-if="displayedEvents.length === 0" class="text-center py-8 text-gray-500">
        Мероприятия не найдены
      </div>
      
      <div v-else class="space-y-3">
        <div 
          v-for="event in displayedEvents" 
          :key="event.id"
          class="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
          @click="eventStore.setCurrentEvent(event)"
          :class="{ 'ring-2 ring-blue-500': currentEvent?.id === event.id }"
        >
          <div class="flex-1">
            <div class="flex items-center gap-3">
              <h4 class="font-medium">{{ event.name }}</h4>
              <span 
                class="px-2 py-1 text-xs font-bold rounded"
                :class="event.is_archived ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'"
              >
                {{ event.is_archived ? 'АРХИВ' : 'АКТИВНО' }}
              </span>
            </div>
            <div class="text-sm text-gray-600 mt-1">
              {{ event.organizer }} • {{ event.location }}
            </div>
          </div>
          <div class="text-xs text-gray-500">
            {{ formatDate(event.created_at) }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * EventStoreUsage — демонстрация всех возможностей event store
 * Показывает CRUD операции, фильтрацию, состояния загрузки, обработку ошибок
 */
import { ref, computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useEventStore } from '@/stores/event-store'
import { getEventsStats } from '@/features/event/eventApi'
import Button from '@/shared/ui/atoms/Button.vue'

// Store
const eventStore = useEventStore()
const {
  events,
  currentEvent,
  loading,
  loadingCurrent,
  loadingCreate,
  loadingUpdate,
  loadingDelete,
  error,
  createError,
  updateError,
  deleteError,
  archiveFilter,
  archivingSupported,
  lastFetch,
  filteredEvents,
  eventsStats,
  isLoading,
  hasErrors
} = storeToRefs(eventStore)

// Локальное состояние
const selectedFilter = ref('all')
const searchQuery = ref('')
const searchResults = ref([])
const isSearching = ref(false)
const statsData = ref(null)

// Форма нового мероприятия
const newEvent = ref({
  name: '',
  organizer: '',
  location: '',
  description: '',
  start_date: ''
})

// Computed
const displayedEvents = computed(() => {
  if (isSearching.value) {
    return searchResults.value
  }
  return filteredEvents.value
})

// Методы
const formatDate = (dateString) => {
  if (!dateString) return 'Не указано'
  return new Date(dateString).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const performSearch = async () => {
  if (!searchQuery.value.trim()) {
    isSearching.value = false
    return
  }
  
  isSearching.value = true
  searchResults.value = eventStore.searchEvents(searchQuery.value)
}

const createNewEvent = async () => {
  try {
    await eventStore.createEvent(newEvent.value)
    // Очищаем форму после успешного создания
    newEvent.value = {
      name: '',
      organizer: '',
      location: '',
      description: '',
      start_date: ''
    }
  } catch (error) {
    console.error('Ошибка создания мероприятия:', error)
  }
}

const loadStats = async () => {
  try {
    const { data } = await getEventsStats()
    statsData.value = data
    console.log('Статистика:', data)
  } catch (error) {
    console.error('Ошибка загрузки статистики:', error)
  }
}

// Загружаем данные при монтировании
onMounted(() => {
  eventStore.loadEvents()
})
</script> 