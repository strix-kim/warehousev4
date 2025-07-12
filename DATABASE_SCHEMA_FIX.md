# 🛠️ Исправление схемы базы данных

## ❌ **Проблема**

При попытке обновить мероприятие возникает ошибка **400 (Bad Request)**:

```
PATCH https://umbqiktyqlfqqgupxqdm.supabase.co/rest/v1/events?id=eq.6b7e75e5-0f3d-4c54-8d67-2c558b345f88&select=* 400 (Bad Request)
```

**Причина:** В таблице `events` отсутствуют поля `is_archived` и `created_at`, которые используются в коде.

## ✅ **Решение**

### **Шаг 1: Обновить схему базы данных**

1. Откройте **Supabase Dashboard**
2. Перейдите в **SQL Editor**
3. Выполните следующий SQL-скрипт:

```sql
-- Добавляем поле is_archived для архивирования мероприятий
ALTER TABLE events ADD COLUMN is_archived boolean NOT NULL DEFAULT false;

-- Добавляем поле created_at для отслеживания времени создания
ALTER TABLE events ADD COLUMN created_at timestamp with time zone NOT NULL DEFAULT now();

-- Создаем индексы для оптимизации запросов
CREATE INDEX idx_events_is_archived ON events(is_archived);
CREATE INDEX idx_events_created_at ON events(created_at);
```

### **Шаг 2: Проверить обновление**

Выполните проверочный запрос:

```sql
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'events' 
ORDER BY ordinal_position;
```

**Ожидаемый результат:** В списке должны появиться поля:
- `is_archived` (boolean, NOT NULL, default: false)
- `created_at` (timestamp with time zone, NOT NULL, default: now())

### **Шаг 3: Перезапустить приложение**

После обновления схемы БД:

1. Остановите dev-сервер (Ctrl+C)
2. Запустите заново: `npm run dev`
3. Попробуйте обновить мероприятие

## 📋 **Обновленная схема таблицы events**

```sql
create table events (
  id uuid primary key default gen_random_uuid(),
  name varchar(120) not null,
  organizer varchar(120) not null,
  location varchar(120) not null,
  description text,
  technical_task text,
  photos text[] default '{}',
  setup_date date,
  start_date date,
  end_date date,
  teardown_date date,
  mount_points_count integer not null default 0,
  responsible_engineers uuid[] not null,
  is_archived boolean not null default false,      -- ← НОВОЕ ПОЛЕ
  created_at timestamp with time zone default now() -- ← НОВОЕ ПОЛЕ
);
```

## 🎯 **Функциональность после исправления**

После обновления схемы БД будут работать:

- ✅ **Создание мероприятий** — с автоматическими `created_at` и `is_archived`
- ✅ **Редактирование мероприятий** — все поля обновляются корректно
- ✅ **Архивирование** — через поле `is_archived`
- ✅ **Фильтрация** — активные/архивные мероприятия
- ✅ **Сортировка** — по дате создания

## 🔧 **Техническая информация**

### **Что исправлено в коде:**
- ✅ Добавлено логирование в `updateEvent()` для отладки
- ✅ Восстановлены поля `is_archived` и `created_at` в API
- ✅ Улучшена обработка ошибок с детальной информацией

### **Файлы изменены:**
- `src/features/event/eventApi.js` — добавлено логирование и исправлена фильтрация полей
- `promt/supabase_schema_fix.sql` — SQL-скрипт для обновления схемы

---

**После выполнения этих шагов ошибка 400 должна исчезнуть!** 🎉 