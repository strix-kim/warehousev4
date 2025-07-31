-- Проверка всех RLS политик в базе данных
-- Показывает все политики и их состояние

-- Проверяем все политики по таблицам
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Проверяем количество политик на таблицу
SELECT 
  tablename,
  COUNT(*) as policy_count
FROM pg_policies 
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- Проверяем политики с потенциальными проблемами производительности
SELECT 
  tablename,
  policyname,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'public'
  AND (
    qual LIKE '%auth.uid()%' 
    OR qual LIKE '%auth.role()%'
    OR with_check LIKE '%auth.uid()%' 
    OR with_check LIKE '%auth.role()%'
  )
ORDER BY tablename, policyname; 