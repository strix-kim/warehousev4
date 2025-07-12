# 🚨 Критические исправления для миграции Event Store

## ⚡ Быстрые исправления (обязательные)

### 1. EventDetails.vue

#### Изменения в script setup:
```javascript
// ЗАМЕНИТЬ:
event.value = await eventStore.fetchEvent(eventId)

// НА:
const eventData = await eventStore.loadEventById(eventId, false)
event.value = eventData

// ЗАМЕНИТЬ:
await eventStore.archiveEventById(eventId)

// НА:
await eventStore.deleteEvent(eventId)

// ЗАМЕНИТЬ:
event.value = await eventStore.fetchEvent(eventId)

// НА:
const updatedEvent = await eventStore.loadEventById(eventId, false)
event.value = updatedEvent
```

#### Полный исправленный блок (строки 91 и 112, 133):
```javascript
// Строка 91 - в функции handleDeleteAndReport:
await eventStore.deleteEvent(eventId)

// Строка 112 - в функции afterEditSubmit:
const updatedEvent = await eventStore.loadEventById(eventId, false)
event.value = updatedEvent

// Строка 133 - в onMounted:
const eventData = await eventStore.loadEventById(eventId, false)
event.value = eventData
```

### 2. EventList.vue

#### Изменения в script setup:
```javascript
// ЗАМЕНИТЬ:
await eventStore.archiveEventById(event.id)

// НА:
await eventStore.deleteEvent(event.id)
```

#### Полный исправленный блок (строка 50):
```javascript
// В функции архивирования:
async function archiveEvent(event) {
  try {
    await eventStore.deleteEvent(event.id)
    // Остальная логика остается без изменений
  } catch (error) {
    console.error('Ошибка архивирования:', error)
  }
}
```

## 🔧 Дополнительные улучшения (рекомендуемые)

### 1. Использование детализированных состояний загрузки

#### EventFormModal.vue:
```javascript
// ЗАМЕНИТЬ:
const { loading: usersLoading } = storeToRefs(userStore)

// ДОБАВИТЬ:
const { loadingCreate, createError } = storeToRefs(eventStore)

// В шаблоне заменить:
:loading="loading"

// НА:
:loading="loadingCreate"

// И добавить отображение конкретной ошибки:
<div v-if="createError" class="text-red-600 text-sm mt-2">
  {{ createError }}
</div>
```

#### events-page.vue:
```javascript
// ДОБАВИТЬ к существующим storeToRefs:
const { loadingCreate, createError } = storeToRefs(eventStore)

// В шаблоне кнопки "Создать мероприятие":
:loading="loadingCreate"

// Добавить отображение ошибки создания где-то в интерфейсе
```

### 2. Оптимизация EventDetails.vue с currentEvent

#### Опциональное улучшение:
```javascript
// ДОБАВИТЬ к imports:
const { currentEvent } = storeToRefs(eventStore)

// ЗАМЕНИТЬ в onMounted:
await eventStore.loadEventById(eventId, true) // setCurrent = true

// ЗАМЕНИТЬ использование event.value:
// БЫЛО: event.value
// СТАЛО: currentEvent.value

// Удалить локальный ref event
```

## 📝 Чек-лист применения исправлений

### ✅ Обязательные изменения:
- [ ] EventDetails.vue - заменить `fetchEvent` → `loadEventById`
- [ ] EventDetails.vue - заменить `archiveEventById` → `deleteEvent`
- [ ] EventList.vue - заменить `archiveEventById` → `deleteEvent`

### ⚠️ Проверить после изменений:
- [ ] Загрузка списка мероприятий
- [ ] Создание нового мероприятия
- [ ] Переход к деталям мероприятия
- [ ] Архивирование мероприятия
- [ ] Переключение вкладок активные/архивные

### 🔍 Тестовые сценарии:
1. **Создание мероприятия:**
   - Открыть страницу мероприятий
   - Нажать "Создать мероприятие"
   - Заполнить форму
   - Сохранить
   - Проверить появление в списке

2. **Просмотр деталей:**
   - Кликнуть на мероприятие из списка
   - Проверить корректную загрузку данных
   - Проверить отображение всех полей

3. **Архивирование:**
   - На странице деталей мероприятия
   - Нажать кнопку архивирования
   - Проверить перенаправление на /reports
   - Проверить что мероприятие исчезло из активных

4. **Фильтрация:**
   - На странице мероприятий
   - Переключиться на вкладку "Архивные"
   - Проверить отображение архивных мероприятий

## 🚫 Что НЕ нужно менять:

### ✅ Эти файлы уже совместимы:
- `src/pages/events-page.vue` - использует правильные методы
- `src/features/event/components/EventFormModal.vue` - использует `createEvent`
- `src/features/event/components/EventDiagnostic.vue` - использует API напрямую
- `src/pages/mount-point-*.vue` - используют API напрямую

### ✅ Эти API методы остались без изменений:
- `fetchEvents()` - работает как раньше
- `fetchEventById()` - работает как раньше  
- `addEvent()` - улучшен, но совместим
- `updateEvent()` - улучшен, но совместим

## ⏱️ Временные затраты:

- **Критические исправления:** 30-45 минут
- **Тестирование основных путей:** 15-30 минут
- **Дополнительные улучшения:** 1-2 часа
- **Полное тестирование:** 30-45 минут

**Общее время:** 2-4 часа в зависимости от объема улучшений

## 🔄 Порядок применения:

1. **Backup:** Сохранить текущие файлы
2. **Критические исправления:** Применить обязательные изменения
3. **Базовое тестирование:** Проверить основные сценарии
4. **Commit:** Зафиксировать рабочую версию
5. **Улучшения:** Применить дополнительные улучшения
6. **Полное тестирование:** Проверить все сценарии
7. **Final commit:** Финальная версия

## ⚡ Экстренный откат:

Если что-то пошло не так:
```bash
# Откат конкретного файла:
git checkout HEAD~1 src/stores/event-store.js

# Или откат всех изменений:
git reset --hard HEAD~1
``` 