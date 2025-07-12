-- Исправление схемы: добавление недостающих полей в таблицу events
-- Выполнить в Supabase SQL Editor

-- Добавляем поле is_archived для архивирования мероприятий
ALTER TABLE events ADD COLUMN is_archived boolean NOT NULL DEFAULT false;

-- Добавляем поле created_at для отслеживания времени создания
ALTER TABLE events ADD COLUMN created_at timestamp with time zone NOT NULL DEFAULT now();

-- Создаем индексы для оптимизации запросов
CREATE INDEX idx_events_is_archived ON events(is_archived);
CREATE INDEX idx_events_created_at ON events(created_at);

-- Проверяем структуру таблицы
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'events' 
ORDER BY ordinal_position; 