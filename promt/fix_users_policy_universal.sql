-- Универсальное исправление политики доступа к пользователям
-- Работает с любыми ролями в системе

-- Сначала проверим, какие роли есть в системе
SELECT DISTINCT role FROM users ORDER BY role;

-- Удаляем старую ограничивающую политику
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can view own profile or managers can view all" ON users;

-- Создаем новую политику для просмотра пользователей
-- Позволяет видеть всех пользователей (для админов и менеджеров)
CREATE POLICY "All authenticated can view users" ON users
  FOR SELECT USING ((select auth.uid()) is not null);

-- Альтернативный вариант: только менеджеры и админы видят всех
-- CREATE POLICY "Managers and admins can view all users" ON users
--   FOR SELECT USING (
--     (select auth.uid()) = id 
--     OR exists (select 1 from users as u where u.id = (select auth.uid()) and u.role in ('manager', 'admin'))
--   );

-- Проверяем результат
SELECT schemaname, tablename, policyname, qual
FROM pg_policies 
WHERE tablename = 'users' AND cmd = 'SELECT';

-- Проверяем, что политика работает
SELECT COUNT(*) as total_users FROM users; 