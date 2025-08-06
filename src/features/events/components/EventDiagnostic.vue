<template>
  <!--
    EventDiagnostic.vue — диагностический компонент для проверки архивирования
    Помогает выявить проблемы с полем is_archived в БД
  -->
  <div class="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
    <h3 class="text-lg font-semibold text-gray-900 mb-4">🔍 Диагностика архивирования мероприятий</h3>
    
    <div class="space-y-4">
      <!-- Статус поддержки архивирования -->
      <div class="flex items-center gap-3 p-3 rounded-lg" :class="archivingSupportedClass">
        <div class="text-xl">{{ archivingSupportedIcon }}</div>
        <div>
          <div class="font-medium">{{ archivingSupportedText }}</div>
          <div class="text-sm opacity-75">{{ archivingSupportedDescription }}</div>
        </div>
      </div>
      
      <!-- Кнопки диагностики -->
      <div class="flex flex-wrap gap-3">
        <Button
          label="Проверить БД"
          variant="primary"
          size="sm"
          :loading="checking"
          @click="runDiagnostic"
        />
        <Button
          label="Загрузить все мероприятия"
          variant="secondary"
          size="sm"
          :loading="loadingAll"
          @click="loadAllEvents"
        />
        <Button
          label="Тест архивирования"
          variant="secondary"
          size="sm"
          :loading="testingArchive"
          @click="testArchiving"
        />
      </div>
      
      <!-- Результаты диагностики -->
      <div v-if="diagnosticResults.length > 0" class="space-y-2">
        <h4 class="font-medium text-gray-900">Результаты диагностики:</h4>
        <div 
          v-for="(result, index) in diagnosticResults" 
          :key="index"
          class="p-3 rounded-lg text-sm"
          :class="result.type === 'error' ? 'bg-red-50 text-red-700' : result.type === 'warning' ? 'bg-yellow-50 text-yellow-700' : 'bg-green-50 text-green-700'"
        >
          <strong>{{ result.title }}:</strong> {{ result.message }}
        </div>
      </div>
      
      <!-- Данные мероприятий -->
      <div v-if="events.length > 0" class="space-y-2">
        <h4 class="font-medium text-gray-900">Загруженные мероприятия ({{ events.length }}):</h4>
        <div class="max-h-40 overflow-y-auto space-y-1">
          <div 
            v-for="event in events" 
            :key="event.id"
            class="flex items-center justify-between p-2 bg-gray-50 rounded text-sm"
          >
            <span class="font-medium">{{ event.name }}</span>
            <span 
              class="px-2 py-1 rounded text-xs font-bold"
              :class="event.is_archived ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'"
            >
              {{ event.is_archived ? 'АРХИВ' : 'АКТИВНО' }}
            </span>
          </div>
        </div>
      </div>
      
      <!-- Инструкции по исправлению -->
      <div v-if="!archivingSupported" class="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 class="font-medium text-blue-900 mb-2">📋 Инструкции по исправлению:</h4>
        <ol class="text-sm text-blue-800 space-y-1 list-decimal list-inside">
          <li>Откройте <strong>Supabase SQL Editor</strong></li>
          <li>Выполните команду: <code class="bg-blue-100 px-1 rounded">ALTER TABLE events ADD COLUMN is_archived boolean NOT NULL DEFAULT false;</code></li>
          <li>Создайте индекс: <code class="bg-blue-100 px-1 rounded">CREATE INDEX idx_events_is_archived ON events(is_archived);</code></li>
          <li>Обновите страницу и повторите диагностику</li>
        </ol>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * EventDiagnostic — компонент для диагностики проблем с архивированием
 */
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useEventStore } from '@/features/events/store/event-store'
import { checkArchivingSupport, fetchEvents } from '@/features/events/api/eventApi'
import Button from '@/shared/ui/atoms/Button.vue'

// Store
const eventStore = useEventStore()
const { archivingSupported } = storeToRefs(eventStore)

// Локальное состояние
const checking = ref(false)
const loadingAll = ref(false)
const testingArchive = ref(false)
const diagnosticResults = ref([])
const events = ref([])

// Computed
const archivingSupportedClass = computed(() => {
  if (archivingSupported.value === null) return 'bg-gray-50'
  return archivingSupported.value ? 'bg-green-50' : 'bg-red-50'
})

const archivingSupportedIcon = computed(() => {
  if (archivingSupported.value === null) return '❓'
  return archivingSupported.value ? '✅' : '❌'
})

const archivingSupportedText = computed(() => {
  if (archivingSupported.value === null) return 'Статус архивирования неизвестен'
  return archivingSupported.value ? 'Архивирование поддерживается' : 'Архивирование НЕ поддерживается'
})

const archivingSupportedDescription = computed(() => {
  if (archivingSupported.value === null) return 'Нажмите "Проверить БД" для диагностики'
  return archivingSupported.value 
    ? 'Поле is_archived существует в таблице events'
    : 'Поле is_archived отсутствует в таблице events'
})

// Методы
const addResult = (type, title, message) => {
  diagnosticResults.value.push({ type, title, message })
}

const runDiagnostic = async () => {
  checking.value = true
  diagnosticResults.value = []
  
  try {
    // Проверяем поддержку архивирования
    await eventStore.checkArchiving()
    
    if (archivingSupported.value) {
      addResult('success', 'База данных', 'Поле is_archived найдено в таблице events')
    } else {
      addResult('error', 'База данных', 'Поле is_archived отсутствует в таблице events')
    }
    
    // Проверяем загрузку мероприятий
    const { data, error } = await fetchEvents()
    if (error) {
      addResult('error', 'Загрузка данных', error.message)
    } else {
      addResult('success', 'Загрузка данных', `Успешно загружено ${data.length} мероприятий`)
      
      // Анализируем данные
      const withArchiveField = data.filter(e => e.hasOwnProperty('is_archived'))
      const archivedCount = data.filter(e => e.is_archived === true).length
      const activeCount = data.filter(e => e.is_archived === false).length
      
      if (withArchiveField.length === data.length) {
        addResult('success', 'Структура данных', `Все записи содержат поле is_archived`)
        addResult('info', 'Статистика', `Активных: ${activeCount}, Архивных: ${archivedCount}`)
      } else {
        addResult('warning', 'Структура данных', `${data.length - withArchiveField.length} записей без поля is_archived`)
      }
    }
  } catch (error) {
    addResult('error', 'Ошибка диагностики', error.message)
  } finally {
    checking.value = false
  }
}

const loadAllEvents = async () => {
  loadingAll.value = true
  try {
    const { data, error } = await fetchEvents()
    if (error) throw error
    
    events.value = data.map(event => ({
      ...event,
      is_archived: event.is_archived ?? false // Значение по умолчанию если поле отсутствует
    }))
    
    addResult('success', 'Загрузка мероприятий', `Загружено ${events.value.length} мероприятий`)
  } catch (error) {
    addResult('error', 'Ошибка загрузки', error.message)
  } finally {
    loadingAll.value = false
  }
}

const testArchiving = async () => {
  testingArchive.value = true
  try {
    // Попытка создать тестовое мероприятие
    addResult('info', 'Тест архивирования', 'Функция находится в разработке')
  } catch (error) {
    addResult('error', 'Ошибка теста', error.message)
  } finally {
    testingArchive.value = false
  }
}
</script> 