-- Исправление политики доступа к пользователям
-- Добавляем возможность менеджерам и админам видеть всех пользователей

-- Удаляем старую ограничивающую политику
DROP POLICY IF EXISTS "Users can view own profile" ON users;

-- Создаем новую политику для просмотра пользователей
CREATE POLICY "Users can view own profile or managers can view all" ON users
  FOR SELECT USING (
    (select auth.uid()) = id 
    OR exists (select 1 from users as u where u.id = (select auth.uid()) and u.role in ('manager', 'admin'))
  );

-- Проверяем результат
SELECT schemaname, tablename, policyname, qual
FROM pg_policies 
WHERE tablename = 'users' AND cmd = 'SELECT'; 