# 🔍 Анализ проблемы с архивными мероприятиями

## 📋 Краткое описание проблемы

Архивные мероприятия не отображаются на странице событий. При переключении на вкладку "Архивные" пользователь видит пустой список, даже если в системе должны быть архивированные мероприятия.

## 🚨 Корневая причина

### **КРИТИЧЕСКАЯ ПРОБЛЕМА: Отсутствует поле `is_archived` в схеме БД**

В файле `promt/supabase_schema.sql` в таблице `events` **НЕТ поля `is_archived`**:

```sql
create table events (
  id uuid primary key default gen_random_uuid(),
  name varchar(120) not null,
  organizer varchar(120) not null,
  location varchar(120) not null,
  -- ... другие поля ...
  responsible_engineers uuid[] not null
  -- ❌ ОТСУТСТВУЕТ: is_archived boolean not null default false
);
```

## 📊 Конфликт между кодом и схемой

### Код предполагает наличие `is_archived`:
- `eventApi.js`: использует `{ is_archived: true }` для архивирования
- `event-store.js`: фильтрует по `!!ev.is_archived === !!isArchived`
- `EventCard.vue`: проверяет `event.is_archived` для стилизации
- `events-page.vue`: фильтрует по `!event.is_archived`

### БД не содержит поле:
- При запросах `event.is_archived` возвращает `undefined`
- Все мероприятия считаются активными: `!undefined` = `true`
- Архивные всегда пустые: `undefined` = `false`

## 🔧 Детальная диагностика

### 1. Логика фильтрации в новой архитектуре

```javascript
// events-page.vue
const activeEvents = computed(() => 
  events.value.filter(event => !event.is_archived) // !undefined = true (все попадают)
)

const archivedEvents = computed(() => 
  events.value.filter(event => event.is_archived) // undefined = false (всегда пусто)
)
```

### 2. Методы получения данных

```javascript
// eventApi.js
export async function fetchEvents() {
  return await supabase.from('events').select('*') // is_archived отсутствует в результате
}
```

### 3. Store обработка

```javascript
// event-store.js - старая логика с showArchived флагом не используется новой страницей
this.showArchived = val
this.loadEvents()
```

## 💡 Решения проблемы

### ✅ Решение 1: Исправить схему БД (РЕКОМЕНДУЕТСЯ)

#### Шаги:
1. **Добавить поле в таблицу events:**
```sql
ALTER TABLE events 
ADD COLUMN is_archived boolean NOT NULL DEFAULT false;
```

2. **Создать индекс для производительности:**
```sql
CREATE INDEX idx_events_is_archived ON events(is_archived);
```

3. **Добавить комментарий:**
```sql
COMMENT ON COLUMN events.is_archived IS 'Флаг архивного мероприятия. false = активное, true = архивное';
```

#### Готовый скрипт:
Создан файл `promt/supabase_schema_fix.sql` с полным скриптом исправления.

### ✅ Решение 2: Исправить код (ВРЕМЕННОЕ)

#### Обновлено в `eventApi.js`:
- Добавлены функции `fetchActiveEvents()` и `fetchArchivedEvents()`
- Добавлена функция `checkArchivingSupport()` для проверки поля
- Обработка ошибок при отсутствии поля `is_archived`

#### Обновлено в `event-store.js`:
- Добавлен getter `archivingSupported` для проверки поддержки
- Добавлены методы `loadActiveEvents()` и `loadArchivedEvents()`
- Fallback логика когда поле отсутствует

### 🔧 Решение 3: Диагностический инструмент

Создан компонент `EventDiagnostic.vue` для:
- Проверки наличия поля `is_archived` в БД
- Анализа структуры данных мероприятий
- Отображения инструкций по исправлению
- Тестирования функций архивирования

## 📋 Пошаговые инструкции по исправлению

### Вариант A: Исправление БД (рекомендуется)

1. **Откройте Supabase Dashboard**
2. **Перейдите в SQL Editor**
3. **Выполните команды:**
```sql
-- Добавить поле
ALTER TABLE events ADD COLUMN is_archived boolean NOT NULL DEFAULT false;

-- Создать индекс
CREATE INDEX idx_events_is_archived ON events(is_archived);

-- Проверить результат
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'events' AND column_name = 'is_archived';
```
4. **Обновите страницу приложения**
5. **Проверьте работу архивирования**

### Вариант B: Использование диагностики

1. **Откройте страницу мероприятий**
2. **Нажмите кнопку "Диагностика"**
3. **Нажмите "Проверить БД"**
4. **Следуйте инструкциям в панели диагностики**

## 🧪 Тестирование исправлений

### После исправления БД:
1. Создайте новое мероприятие
2. Архивируйте его через интерфейс
3. Проверьте переключение между вкладками "Активные"/"Архивные"
4. Убедитесь что счетчики на вкладках корректны

### Проверка через диагностику:
1. Используйте кнопку "Проверить БД" — должно показать ✅
2. Используйте "Загрузить все мероприятия" — проверьте статусы
3. Проверьте что все мероприятия содержат поле `is_archived`

## 📝 Обновленная архитектура

### Новая структура данных мероприятия:
```javascript
{
  id: "uuid",
  name: "string",
  organizer: "string", 
  location: "string",
  description: "text",
  technical_task: "text",
  photos: "string[]",
  setup_date: "date",
  start_date: "date", 
  end_date: "date",
  teardown_date: "date",
  mount_points_count: "integer",
  responsible_engineers: "uuid[]",
  is_archived: "boolean" // ← НОВОЕ ПОЛЕ
}
```

### Обновленные API методы:
- `fetchActiveEvents()` — только активные мероприятия
- `fetchArchivedEvents()` — только архивные мероприятия
- `checkArchivingSupport()` — проверка поддержки архивирования

### Обновленный Store:
- Geттеры `activeEvents` и `archivedEvents`
- Автоматическая проверка поддержки архивирования
- Fallback логика для совместимости

## 🎯 Ожидаемые результаты

После исправления:
- ✅ Вкладка "Архивные" отображает архивированные мероприятия
- ✅ Корректные счетчики на вкладках
- ✅ Функция архивирования работает корректно
- ✅ Восстановление из архива работает
- ✅ Визуальные индикаторы архивных мероприятий отображаются

## 🔍 Мониторинг и поддержка

- Используйте диагностический компонент для контроля состояния
- Проверяйте логи браузера на предмет ошибок с `is_archived`
- Мониторьте производительность запросов после добавления индекса
- Обновите документацию API после изменений схемы 