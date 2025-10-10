-- Миграция для добавления поддержки абстрактных списков оборудования
-- Дата: 2025-01-10
-- Описание: Добавляет поля для создания списков по типам оборудования (без привязки к конкретным единицам)

-- Добавляем новое поле для хранения абстрактных позиций оборудования
ALTER TABLE equipment_lists 
ADD COLUMN IF NOT EXISTS equipment_items JSONB DEFAULT '[]'::jsonb;

-- Добавляем поле для определения режима списка
ALTER TABLE equipment_lists 
ADD COLUMN IF NOT EXISTS list_mode VARCHAR(20) DEFAULT 'specific' CHECK (list_mode IN ('specific', 'abstract'));

-- Комментарии для документации
COMMENT ON COLUMN equipment_lists.equipment_items IS 
'Массив объектов с информацией об оборудовании для абстрактных списков. Формат: [{"model": "...", "brand": "...", "type": "...", "subtype": "...", "count": 3}]';

COMMENT ON COLUMN equipment_lists.list_mode IS 
'Режим списка: "specific" - конкретные единицы с equipment_ids, "abstract" - типы оборудования с equipment_items';

-- Создаем индекс для быстрого поиска по режиму
CREATE INDEX IF NOT EXISTS idx_equipment_lists_list_mode ON equipment_lists(list_mode);

-- Обновляем существующие записи - они все в режиме "specific"
UPDATE equipment_lists 
SET list_mode = 'specific' 
WHERE list_mode IS NULL;

