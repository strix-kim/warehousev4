-- Проверка ролей пользователей в базе данных
-- Показывает все уникальные роли и количество пользователей с каждой ролью

-- Проверяем все уникальные роли
SELECT DISTINCT role FROM users ORDER BY role;

-- Подсчитываем количество пользователей по ролям
SELECT role, COUNT(*) as user_count 
FROM users 
GROUP BY role 
ORDER BY role;

-- Проверяем конкретного пользователя (замените на ваш ID)
SELECT id, email, role, name 
FROM users 
WHERE id = (select auth.uid());

-- Проверяем всех пользователей
SELECT id, email, role, name 
FROM users 
ORDER BY role, name; 