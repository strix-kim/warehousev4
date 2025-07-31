-- Исправление политик для таблицы equipment
-- Удаляем старые политики с неоптимизированными auth функциями

-- Удаляем проблемные политики для equipments
DROP POLICY IF EXISTS "Users can view equipment" ON equipments;
DROP POLICY IF EXISTS "Users can create equipment" ON equipments;
DROP POLICY IF EXISTS "Users can update equipment" ON equipments;
DROP POLICY IF EXISTS "Users can delete equipment" ON equipments;

-- Проверяем, что политики удалены
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename = 'equipments' 
ORDER BY policyname; 