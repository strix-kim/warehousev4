-- Миграция для расширения функциональности точек монтажа
-- Добавляет поля: location, start_date
-- Обновляет структуру technical_duties с объектами и статусами

-- 1. Добавляем новые поля
ALTER TABLE mount_points 
ADD COLUMN location TEXT,
ADD COLUMN start_date DATE;

-- 2. Создаем временную таблицу для миграции technical_duties
CREATE TEMP TABLE temp_mount_points AS 
SELECT 
  id,
  CASE 
    WHEN technical_duties IS NOT NULL AND jsonb_array_length(technical_duties) > 0 THEN
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', generate_random_uuid()::text,
            'title', duty_text,
            'status', 'в работе'
          )
        )
        FROM jsonb_array_elements_text(technical_duties) AS duty_text
      )
    ELSE '[]'::jsonb
  END as new_technical_duties
FROM mount_points;

-- 3. Обновляем technical_duties в основной таблице
UPDATE mount_points 
SET technical_duties = temp.new_technical_duties
FROM temp_mount_points temp
WHERE mount_points.id = temp.id;

-- 4. Добавляем комментарии к новым полям
COMMENT ON COLUMN mount_points.location IS 'Локация точки монтажа (например: Зал А, Фойе, Сцена)';
COMMENT ON COLUMN mount_points.start_date IS 'Дата начала работы точки монтажа';
COMMENT ON COLUMN mount_points.technical_duties IS 'Массив технических заданий с объектами: {id, title, status}';

-- 5. Создаем индексы для производительности
CREATE INDEX IF NOT EXISTS idx_mount_points_location ON mount_points(location);
CREATE INDEX IF NOT EXISTS idx_mount_points_start_date ON mount_points(start_date);

-- 6. Добавляем проверочное ограничение для статусов technical_duties
ALTER TABLE mount_points 
ADD CONSTRAINT check_technical_duties_status 
CHECK (
  technical_duties IS NULL OR 
  (
    SELECT bool_and(
      duty->>'status' IN ('в работе', 'выполнено', 'проблема')
    )
    FROM jsonb_array_elements(technical_duties) AS duty
    WHERE jsonb_typeof(duty) = 'object'
  )
);

-- 7. Пример данных для тестирования (опционально)
-- INSERT INTO mount_points (name, location, start_date, technical_duties, responsible_engineers, event_id)
-- VALUES (
--   'Тестовая точка',
--   'Главный зал',
--   '2024-02-01',
--   '[
--     {"id": "1", "title": "Установка камер", "status": "в работе"},
--     {"id": "2", "title": "Настройка звука", "status": "выполнено"},
--     {"id": "3", "title": "Проверка освещения", "status": "проблема"}
--   ]'::jsonb,
--   '["user-id-1", "user-id-2"]'::jsonb,
--   'event-id-here'
-- ); 