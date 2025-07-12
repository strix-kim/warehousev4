# Исправление ошибки валидации дат в PostgreSQL

## Проблема

При попытке обновить информацию о мероприятии возникала ошибка:
```
PATCH https://umbqiktyqlfqqgupxqdm.supabase.co/rest/v1/events?id=eq.6b7e75e5-0f3d-4c54-8d67-2c558b345f88&select=* 400 (Bad Request)
{code: '22007', details: null, hint: null, message: 'invalid input syntax for type date: ""'}
```

## Причина

PostgreSQL не принимает пустые строки (`""`) для полей типа `date`. Он ожидает либо `null`, либо валидную дату в правильном формате.

В форме `EventEditor.vue` поля дат могли быть пустыми строками, которые затем передавались в API без дополнительной обработки.

## Решение

### 1. Исправлена функция `updateEvent` в `src/features/event/eventApi.js`

Добавлена обработка пустых строк для полей дат:

```javascript
// КРИТИЧЕСКИ ВАЖНО: Очищаем пустые строки для полей дат, чтобы избежать ошибки PostgreSQL
// PostgreSQL не принимает пустые строки для типа date, только null или валидные даты
const dateFields = ['setup_date', 'start_date', 'end_date', 'teardown_date', 'created_at']
dateFields.forEach(field => {
  if (filteredUpdates[field] === '') {
    console.log(`🔧 Преобразуем пустую строку в null для поля ${field}`)
    filteredUpdates[field] = null
  }
})
```

### 2. Исправлена функция `addEvent` в `src/features/event/eventApi.js`

Добавлена аналогичная обработка для создания новых мероприятий:

```javascript
// КРИТИЧЕСКИ ВАЖНО: Очищаем пустые строки для полей дат, чтобы избежать ошибки PostgreSQL
// PostgreSQL не принимает пустые строки для типа date, только null или валидные даты
const dateFields = ['setup_date', 'start_date', 'end_date', 'teardown_date']
dateFields.forEach(field => {
  if (newEvent[field] === '') {
    console.log(`🔧 Преобразуем пустую строку в null для поля ${field} при создании`)
    newEvent[field] = null
  }
})
```

### 3. Улучшена форма `EventEditor.vue`

Добавлена функция `prepareFormData()` для предварительной очистки данных:

```javascript
/**
 * Подготавливает данные формы для отправки в API
 * Очищает пустые строки для полей дат, чтобы избежать ошибок PostgreSQL
 */
function prepareFormData() {
  const data = { ...form.value }
  
  // Очищаем пустые строки для полей дат - PostgreSQL не принимает пустые строки для типа date
  const dateFields = ['setup_date', 'start_date', 'end_date', 'teardown_date']
  dateFields.forEach(field => {
    if (data[field] === '') {
      data[field] = null
    }
  })
  
  return data
}
```

## Результат

✅ **Проблема решена**: Теперь пустые поля дат корректно преобразуются в `null` перед отправкой в PostgreSQL  
✅ **Обратная совместимость**: Решение работает как для создания, так и для обновления мероприятий  
✅ **Консистентность**: Обработка применена на всех уровнях - в форме и в API  
✅ **Логирование**: Добавлено подробное логирование для отладки  

## Тестирование

1. Проект собирается без ошибок: `npm run build` ✅
2. Форма теперь корректно обрабатывает пустые поля дат
3. API преобразует пустые строки в `null` перед отправкой в Supabase
4. PostgreSQL принимает `null` значения для полей типа `date`

## Дополнительные улучшения

Для дальнейшего улучшения рекомендуется:

1. **Валидация на фронтенде**: Добавить проверку формата дат в форме
2. **Типизация**: Использовать TypeScript для строгой типизации полей дат
3. **Компонент даты**: Создать специализированный компонент для ввода дат
4. **Тесты**: Добавить unit-тесты для функций обработки дат 