-- Обновление схемы mount_points для системы точек монтажа
-- Добавление поля technical_duties для хранения технических заданий

-- Добавить поле technical_duties в таблицу mount_points
ALTER TABLE mount_points ADD COLUMN IF NOT EXISTS technical_duties text[] DEFAULT '{}';

-- Создать индекс для быстрого поиска по event_id (если не существует)
CREATE INDEX IF NOT EXISTS idx_mount_points_event_id ON mount_points(event_id);

-- Создать индекс для поиска по ответственным инженерам
CREATE INDEX IF NOT EXISTS idx_mount_points_responsible_engineers ON mount_points USING GIN(responsible_engineers);

-- Обновить комментарии к таблице для документации
COMMENT ON TABLE mount_points IS 'Точки монтажа для мероприятий с назначенными инженерами и оборудованием';
COMMENT ON COLUMN mount_points.technical_duties IS 'Массив технических заданий и обязанностей для точки монтажа';
COMMENT ON COLUMN mount_points.responsible_engineers IS 'Массив UUID ответственных инженеров';
COMMENT ON COLUMN mount_points.equipment_plan IS 'Планируемое оборудование (UUID массив)';
COMMENT ON COLUMN mount_points.equipment_final IS 'Финальное оборудование (UUID массив)';
COMMENT ON COLUMN mount_points.equipment_fact IS 'Фактически использованное оборудование (UUID массив)'; 