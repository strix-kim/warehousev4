-- Схема для таблицы списков оборудования
-- Создаем таблицу для хранения различных типов списков оборудования

CREATE TABLE IF NOT EXISTS equipment_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL CHECK (type IN ('security', 'report', 'custom')),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  mount_point_id UUID REFERENCES mount_points(id) ON DELETE SET NULL,
  equipment_ids UUID[] NOT NULL DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  is_archived BOOLEAN DEFAULT FALSE
);

-- Индексы для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_equipment_lists_event_id ON equipment_lists(event_id);
CREATE INDEX IF NOT EXISTS idx_equipment_lists_type ON equipment_lists(type);
CREATE INDEX IF NOT EXISTS idx_equipment_lists_created_at ON equipment_lists(created_at);
CREATE INDEX IF NOT EXISTS idx_equipment_lists_is_archived ON equipment_lists(is_archived);

-- Триггер для обновления updated_at
CREATE OR REPLACE FUNCTION update_equipment_lists_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_equipment_lists_updated_at
  BEFORE UPDATE ON equipment_lists
  FOR EACH ROW
  EXECUTE FUNCTION update_equipment_lists_updated_at();

-- Комментарии к таблице
COMMENT ON TABLE equipment_lists IS 'Списки оборудования для различных целей (охрана, отчеты, кастомные)';
COMMENT ON COLUMN equipment_lists.type IS 'Тип списка: security - для охраны, report - для отчетов, custom - кастомный';
COMMENT ON COLUMN equipment_lists.equipment_ids IS 'Массив ID оборудования в списке';
COMMENT ON COLUMN equipment_lists.metadata IS 'Дополнительные данные (статистика, настройки экспорта и т.д.)';
COMMENT ON COLUMN equipment_lists.is_archived IS 'Флаг архивирования списка'; 