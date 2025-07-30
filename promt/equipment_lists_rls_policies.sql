-- RLS политики для таблицы equipment_lists
-- Включаем RLS для таблицы
ALTER TABLE equipment_lists ENABLE ROW LEVEL SECURITY;

-- Политика для чтения: пользователи могут читать все списки
CREATE POLICY "Users can view all equipment lists" ON equipment_lists
  FOR SELECT USING (true);

-- Политика для создания: авторизованные пользователи могут создавать списки
CREATE POLICY "Authenticated users can create equipment lists" ON equipment_lists
  FOR INSERT WITH CHECK ((select auth.role()) = 'authenticated');

-- Политика для обновления: пользователи могут обновлять свои списки или все списки
CREATE POLICY "Users can update equipment lists" ON equipment_lists
  FOR UPDATE USING ((select auth.role()) = 'authenticated');

-- Политика для удаления: авторизованные пользователи могут удалять списки
CREATE POLICY "Authenticated users can delete equipment lists" ON equipment_lists
  FOR DELETE USING ((select auth.role()) = 'authenticated');

-- Альтернативная политика с привязкой к создателю (если нужно ограничить доступ)
-- CREATE POLICY "Users can only manage their own lists" ON equipment_lists
--   FOR ALL USING ((select auth.uid()) = created_by);

-- Комментарии к политикам
COMMENT ON POLICY "Users can view all equipment lists" ON equipment_lists IS 'Разрешает всем пользователям просматривать списки оборудования';
COMMENT ON POLICY "Authenticated users can create equipment lists" ON equipment_lists IS 'Разрешает авторизованным пользователям создавать списки';
COMMENT ON POLICY "Users can update equipment lists" ON equipment_lists IS 'Разрешает авторизованным пользователям обновлять списки';
COMMENT ON POLICY "Authenticated users can delete equipment lists" ON equipment_lists IS 'Разрешает авторизованным пользователям удалять списки'; 