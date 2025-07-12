# 📚 Документация Event Store (Pinia)

## 🎯 Обзор

Event Store — полнофункциональный Pinia store для управления мероприятиями в проекте. Поддерживает все CRUD операции, фильтрацию по архивному статусу, управление текущей записью и детальную обработку состояний загрузки и ошибок.

## 📋 Структура данных мероприятия

```javascript
{
  id: "uuid",                          // Уникальный идентификатор
  name: "string",                      // Название мероприятия
  organizer: "string",                 // Организатор
  location: "string",                  // Место проведения
  description: "text",                 // Описание
  technical_task: "text",              // Техническое задание
  photos: ["string"],                  // Массив ссылок на фото
  setup_date: "date",                  // Дата монтажа
  start_date: "date",                  // Дата начала
  end_date: "date",                    // Дата окончания
  teardown_date: "date",               // Дата демонтажа
  mount_points_count: "integer",       // Количество точек монтажа
  responsible_engineers: ["uuid"],     // Ответственные инженеры
  created_at: "timestamp",             // Время создания
  is_archived: "boolean"               // Статус архивирования
}
```

## 🔧 Состояние Store

### Основные данные
```javascript
state: {
  events: [],                    // Список всех мероприятий
  currentEvent: null,            // Текущая выбранная запись
  
  // Состояния загрузки
  loading: false,                // Общая загрузка
  loadingCurrent: false,         // Загрузка текущей записи
  loadingCreate: false,          // Создание записи
  loadingUpdate: false,          // Обновление записи
  loadingDelete: false,          // Удаление записи
  
  // Состояния ошибок
  error: null,                   // Общая ошибка
  createError: null,             // Ошибка создания
  updateError: null,             // Ошибка обновления
  deleteError: null,             // Ошибка удаления
  
  // Фильтрация и настройки
  archiveFilter: 'all',          // 'all' | 'active' | 'archived'
  archivingSupported: null,      // Поддержка архивирования в БД
  
  // Метаданные
  lastFetch: null,               // Время последней загрузки
  totalCount: 0,                 // Общее количество записей
}
```

## 🎯 Getters (Вычисляемые свойства)

### Базовые getters
```javascript
// Активные мероприятия
eventStore.activeEvents

// Архивные мероприятия
eventStore.archivedEvents

// Отфильтрованные мероприятия согласно текущему фильтру
eventStore.filteredEvents

// Статистика по мероприятиям
eventStore.eventsStats
// Возвращает: { total, active, archived, activePercentage, archivedPercentage }
```

### Состояния
```javascript
// Проверка любой загрузки
eventStore.isLoading

// Проверка наличия ошибок
eventStore.hasErrors
```

### Поиск и фильтрация
```javascript
// Мероприятие по ID
eventStore.getEventById(id)

// Мероприятия по организатору
eventStore.getEventsByOrganizer(organizer)

// Мероприятия по локации
eventStore.getEventsByLocation(location)
```

## ⚙️ Actions (Методы)

### Управление ошибками
```javascript
// Очистка всех ошибок
eventStore.clearErrors()

// Очистка конкретной ошибки
eventStore.clearError('createError')
```

### Проверка архивирования
```javascript
// Проверка поддержки архивирования в БД
await eventStore.checkArchiving()
```

### Фильтрация
```javascript
// Установка фильтра архивирования
eventStore.setArchiveFilter('all')      // Все мероприятия
eventStore.setArchiveFilter('active')   // Только активные
eventStore.setArchiveFilter('archived') // Только архивные
```

### Загрузка данных
```javascript
// Загрузка всех мероприятий
await eventStore.loadEvents()

// Загрузка только активных мероприятий
await eventStore.loadActiveEvents()

// Загрузка только архивных мероприятий
await eventStore.loadArchivedEvents()

// Загрузка мероприятия по ID
await eventStore.loadEventById(id, setCurrent = true)
```

### Управление текущей записью
```javascript
// Установка текущей записи
eventStore.setCurrentEvent(event)

// Очистка текущей записи
eventStore.clearCurrentEvent()
```

### CRUD операции
```javascript
// Создание нового мероприятия
await eventStore.createEvent({
  name: 'Название',
  organizer: 'Организатор',
  location: 'Место',
  description: 'Описание',
  start_date: '2024-01-01'
})

// Обновление мероприятия
await eventStore.updateEvent(id, {
  name: 'Новое название',
  location: 'Новое место'
})

// Удаление мероприятия (архивирование)
await eventStore.deleteEvent(id)

// Восстановление мероприятия из архива
await eventStore.restoreEvent(id)
```

### Поиск
```javascript
// Поиск мероприятий по тексту
const results = eventStore.searchEvents('текст поиска')

// Поиск по конкретным полям
const results = eventStore.searchEvents('текст', ['name', 'organizer'])
```

### Утилиты
```javascript
// Обновление локального списка без перезагрузки
eventStore.refreshLocalData()

// Сброс состояния store
eventStore.resetStore()
```

## 📖 Примеры использования

### Базовое использование в компоненте
```vue
<script setup>
import { storeToRefs } from 'pinia'
import { useEventStore } from '@/stores/event-store'

const eventStore = useEventStore()
const { events, loading, error } = storeToRefs(eventStore)

// Загружаем данные при монтировании
onMounted(() => {
  eventStore.loadEvents()
})
</script>

<template>
  <div v-if="loading">Загрузка...</div>
  <div v-else-if="error">Ошибка: {{ error }}</div>
  <div v-else>
    <div v-for="event in events" :key="event.id">
      {{ event.name }}
    </div>
  </div>
</template>
```

### Создание мероприятия
```vue
<script setup>
const eventStore = useEventStore()
const { loadingCreate, createError } = storeToRefs(eventStore)

const newEvent = ref({
  name: '',
  organizer: '',
  location: '',
  description: ''
})

const createEvent = async () => {
  try {
    await eventStore.createEvent(newEvent.value)
    // Очищаем форму после успешного создания
    newEvent.value = { name: '', organizer: '', location: '', description: '' }
  } catch (error) {
    console.error('Ошибка создания:', error)
  }
}
</script>

<template>
  <form @submit.prevent="createEvent">
    <input v-model="newEvent.name" placeholder="Название" />
    <input v-model="newEvent.organizer" placeholder="Организатор" />
    <input v-model="newEvent.location" placeholder="Место" />
    <textarea v-model="newEvent.description" placeholder="Описание"></textarea>
    
    <button type="submit" :disabled="loadingCreate">
      {{ loadingCreate ? 'Создаём...' : 'Создать' }}
    </button>
    
    <div v-if="createError" class="error">{{ createError }}</div>
  </form>
</template>
```

### Фильтрация по статусу
```vue
<script setup>
const eventStore = useEventStore()
const { 
  filteredEvents, 
  activeEvents, 
  archivedEvents, 
  eventsStats 
} = storeToRefs(eventStore)

const filter = ref('all')

const setFilter = (newFilter) => {
  filter.value = newFilter
  eventStore.setArchiveFilter(newFilter)
}
</script>

<template>
  <div class="filters">
    <button @click="setFilter('all')">
      Все ({{ eventsStats.total }})
    </button>
    <button @click="setFilter('active')">
      Активные ({{ eventsStats.active }})
    </button>
    <button @click="setFilter('archived')">
      Архивные ({{ eventsStats.archived }})
    </button>
  </div>
  
  <div class="events-list">
    <div v-for="event in filteredEvents" :key="event.id">
      <h3>{{ event.name }}</h3>
      <span :class="event.is_archived ? 'archived' : 'active'">
        {{ event.is_archived ? 'АРХИВ' : 'АКТИВНО' }}
      </span>
    </div>
  </div>
</template>
```

### Работа с текущей записью
```vue
<script setup>
const eventStore = useEventStore()
const { currentEvent, loadingUpdate } = storeToRefs(eventStore)

const selectEvent = (event) => {
  eventStore.setCurrentEvent(event)
}

const archiveEvent = async () => {
  if (currentEvent.value) {
    await eventStore.deleteEvent(currentEvent.value.id)
  }
}

const restoreEvent = async () => {
  if (currentEvent.value) {
    await eventStore.restoreEvent(currentEvent.value.id)
  }
}
</script>

<template>
  <div class="events-list">
    <div 
      v-for="event in events" 
      :key="event.id"
      @click="selectEvent(event)"
      :class="{ 'selected': currentEvent?.id === event.id }"
    >
      {{ event.name }}
    </div>
  </div>
  
  <div v-if="currentEvent" class="current-event">
    <h3>{{ currentEvent.name }}</h3>
    <p>{{ currentEvent.description }}</p>
    
    <button 
      v-if="!currentEvent.is_archived"
      @click="archiveEvent"
      :disabled="loadingUpdate"
    >
      Архивировать
    </button>
    
    <button 
      v-if="currentEvent.is_archived"
      @click="restoreEvent"
      :disabled="loadingUpdate"
    >
      Восстановить
    </button>
  </div>
</template>
```

### Поиск мероприятий
```vue
<script setup>
const eventStore = useEventStore()
const searchQuery = ref('')
const searchResults = ref([])

const performSearch = () => {
  if (searchQuery.value.trim()) {
    searchResults.value = eventStore.searchEvents(
      searchQuery.value,
      ['name', 'organizer', 'location']
    )
  } else {
    searchResults.value = []
  }
}
</script>

<template>
  <input 
    v-model="searchQuery"
    @input="performSearch"
    placeholder="Поиск мероприятий..."
  />
  
  <div v-if="searchResults.length > 0">
    <h3>Результаты поиска ({{ searchResults.length }})</h3>
    <div v-for="event in searchResults" :key="event.id">
      {{ event.name }} - {{ event.organizer }}
    </div>
  </div>
</template>
```

## 🔍 Отладка и мониторинг

### Проверка состояний
```javascript
// Проверка всех состояний загрузки
console.log('Загрузка:', {
  general: eventStore.loading,
  create: eventStore.loadingCreate,
  update: eventStore.loadingUpdate,
  delete: eventStore.loadingDelete,
  anyLoading: eventStore.isLoading
})

// Проверка ошибок
console.log('Ошибки:', {
  general: eventStore.error,
  create: eventStore.createError,
  update: eventStore.updateError,
  delete: eventStore.deleteError,
  hasAnyErrors: eventStore.hasErrors
})

// Статистика
console.log('Статистика:', eventStore.eventsStats)
```

### Диагностика архивирования
```javascript
// Проверка поддержки архивирования
const supported = await eventStore.checkArchiving()
console.log('Архивирование поддерживается:', supported)

// Получение информации о фильтре
console.log('Текущий фильтр:', eventStore.archiveFilter)
console.log('Отфильтровано мероприятий:', eventStore.filteredEvents.length)
```

## ⚠️ Обработка ошибок

### Автоматическая обработка
Store автоматически обрабатывает:
- Отсутствие поля `is_archived` в БД
- Сетевые ошибки при запросах
- Ошибки валидации данных

### Ручная обработка
```javascript
try {
  await eventStore.createEvent(eventData)
} catch (error) {
  // Ошибка также сохраняется в eventStore.createError
  console.error('Не удалось создать мероприятие:', error)
  
  // Можно показать уведомление пользователю
  showNotification('Ошибка создания мероприятия: ' + error.message)
}

// Очистка ошибки после обработки
eventStore.clearError('createError')
```

## 🚀 Best Practices

### 1. Инициализация данных
```javascript
// В корневом компоненте или при входе в систему
onMounted(async () => {
  await eventStore.loadEvents()
})
```

### 2. Реактивное отслеживание
```javascript
// Используйте storeToRefs для реактивности
const { events, loading } = storeToRefs(eventStore)

// НЕ используйте деструктуризацию напрямую
// const { events, loading } = eventStore // ❌ Потеря реактивности
```

### 3. Обработка состояний загрузки
```javascript
// Показывайте соответствующие индикаторы для разных операций
const { loading, loadingCreate, loadingUpdate } = storeToRefs(eventStore)

// В шаблоне
<button :disabled="loadingCreate">Создать</button>
<button :disabled="loadingUpdate">Обновить</button>
```

### 4. Очистка ошибок
```javascript
// Очищайте ошибки перед новыми операциями
const createEvent = async () => {
  eventStore.clearError('createError')
  try {
    await eventStore.createEvent(data)
  } catch (error) {
    // Ошибка уже в store
  }
}
```

### 5. Использование текущей записи
```javascript
// Устанавливайте текущую запись для детального просмотра
const showEventDetails = (event) => {
  eventStore.setCurrentEvent(event)
  router.push(`/events/${event.id}`)
}

// Очищайте при уходе со страницы
onUnmounted(() => {
  eventStore.clearCurrentEvent()
})
```

## 📋 Совместимость

- **Vue 3.x**: Composition API, `<script setup>`
- **Pinia**: Для управления состоянием
- **Supabase**: PostgreSQL + RLS
- **TypeScript**: Поддерживается (опционально)

Store полностью совместим с существующей архитектурой проекта и следует принципам feature-sliced design. 