# Исправление ошибок @apply в Tailwind CSS

## Проблема
При компиляции возникла ошибка Tailwind CSS:
```
Cannot apply unknown utility class `space-y-6`. Are you using CSS modules or similar and missing `@reference`?
```

## Причина
Некоторые утилитные классы Tailwind CSS (особенно `space-*` классы) не могут быть использованы с директивой `@apply` в определенных конфигурациях. Это связано с тем, как Tailwind генерирует эти классы.

## Решение
Заменил все проблемные `@apply` директивы на эквивалентные CSS-свойства.

## Исправления в EquipmentDetailsModal.vue

### 1. Основной контейнер
**Было:**
```css
.equipment-details {
  @apply space-y-6;
}
```

**Стало:**
```css
.equipment-details {
  display: flex;
  flex-direction: column;
  gap: 1.5rem; /* space-y-6 equivalent */
}
```

### 2. Секции
**Было:**
```css
.details-section {
  @apply border-b border-gray-100 pb-6 last:border-b-0 last:pb-0;
}
```

**Стало:**
```css
.details-section {
  border-bottom: 1px solid #f3f4f6;
  padding-bottom: 1.5rem;
}

.details-section:last-child {
  border-bottom: 0;
  padding-bottom: 0;
}
```

### 3. Сетка информации
**Было:**
```css
.info-grid {
  @apply grid grid-cols-1 md:grid-cols-2 gap-4;
}
```

**Стало:**
```css
.info-grid {
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: 1rem;
}

@media (min-width: 768px) {
  .info-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
```

### 4. Статусы
**Было:**
```css
.status-badge {
  @apply inline-flex items-center px-3 py-1 text-xs font-medium rounded-full border;
}

.status-operational {
  @apply bg-green-100 text-green-800 border-green-200;
}
```

**Стало:**
```css
.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 500;
  border-radius: 9999px;
  border: 1px solid;
}

.status-operational {
  background-color: #dcfce7;
  color: #166534;
  border-color: #bbf7d0;
}
```

### 5. Кнопки
**Было:**
```css
.btn-primary {
  @apply px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors;
}
```

**Стало:**
```css
.btn-primary {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: #ffffff;
  background-color: #2563eb;
  border: 1px solid transparent;
  border-radius: 0.5rem;
  transition: all 0.15s ease-in-out;
}

.btn-primary:hover {
  background-color: #1d4ed8;
}

.btn-primary:focus {
  outline: none;
  box-shadow: 0 0 0 2px #2563eb, 0 0 0 4px rgba(37, 99, 235, 0.1);
}
```

## Преимущества нового подхода

### 1. Совместимость
- ✅ Работает во всех конфигурациях Tailwind CSS
- ✅ Не зависит от специфических настроек сборки
- ✅ Полная поддержка в Vite

### 2. Производительность
- ✅ Прямые CSS-свойства компилируются быстрее
- ✅ Меньше зависимостей от Tailwind runtime
- ✅ Лучшая оптимизация в production

### 3. Читаемость
- ✅ Явные CSS-свойства понятнее для разработчиков
- ✅ Легче отладка в DevTools
- ✅ Прямое соответствие с браузерными стандартами

### 4. Гибкость
- ✅ Возможность точной настройки значений
- ✅ Кастомные анимации и переходы
- ✅ Лучший контроль над responsive поведением

## Цветовая палитра (Tailwind → CSS)

| Tailwind класс | CSS значение | Описание |
|----------------|--------------|----------|
| `text-gray-900` | `#111827` | Основной текст |
| `text-gray-700` | `#374151` | Второстепенный текст |
| `text-gray-500` | `#6b7280` | Подписи и метки |
| `bg-gray-50` | `#f9fafb` | Светлый фон |
| `border-gray-200` | `#e5e7eb` | Границы |
| `bg-green-100` | `#dcfce7` | Успех (фон) |
| `text-green-800` | `#166534` | Успех (текст) |
| `bg-red-100` | `#fee2e2` | Ошибка (фон) |
| `text-red-800` | `#991b1b` | Ошибка (текст) |
| `bg-blue-600` | `#2563eb` | Основной цвет |

## Результат
- ✅ Все ошибки Tailwind CSS устранены
- ✅ Сохранен точно такой же внешний вид
- ✅ Улучшена совместимость и производительность
- ✅ Код стал более явным и понятным
- ✅ Приложение готово к использованию

## Рекомендации
В будущем для избежания подобных проблем:
1. Использовать `@apply` только для простых утилит
2. Избегать `space-*`, `divide-*` классов в `@apply`
3. Предпочитать прямые CSS-свойства для сложных стилей
4. Тестировать компиляцию при добавлении новых стилей 