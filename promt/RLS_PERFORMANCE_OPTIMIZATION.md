# Оптимизация производительности RLS политик

## Проблема

**Описание:** RLS политики в таблице `public.equipment` (и других таблицах) содержат вызовы `auth.uid()` и `auth.role()`, которые пересчитываются для каждой строки, что приводит к неоптимальной производительности запросов при больших объемах данных.

**Симптомы:**
- Медленные запросы к таблицам с RLS
- Высокая нагрузка на CPU при выполнении запросов
- Снижение производительности при увеличении количества строк

## Причина

PostgreSQL пересчитывает функции `auth.uid()` и `auth.role()` для каждой строки в RLS политиках, что создает дополнительную нагрузку на процессор и замедляет выполнение запросов.

## Решение

### **Основной принцип:**
Заменить прямые вызовы `auth.uid()` и `auth.role()` на подзапросы `(select auth.uid())` и `(select auth.role())`.

### **Важное примечание:**
В PostgreSQL RLS политиках **нельзя использовать** `FOR ALL` или `FOR INSERT, UPDATE` - нужно создавать отдельные политики для каждого действия (SELECT, INSERT, UPDATE, DELETE).

### **Примеры оптимизации:**

#### ❌ Неоптимизированная политика:
```sql
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);
```

#### ✅ Оптимизированная политика:
```sql
CREATE POLICY "All authenticated can view users" ON users
  FOR SELECT USING ((select auth.uid()) is not null);
```

#### ❌ Неоптимизированная политика:
```sql
CREATE POLICY "Engineers can select own events" ON events
  FOR SELECT USING (
    auth.uid() = ANY(responsible_engineers)
    or exists (select 1 from users as u where u.id = auth.uid() and u.role in ('manager', 'admin'))
  );
```

#### ✅ Оптимизированная политика:
```sql
CREATE POLICY "Engineers can select own events" ON events
  FOR SELECT USING (
    (select auth.uid()) = ANY(responsible_engineers)
    or exists (select 1 from users as u where u.id = (select auth.uid()) and u.role in ('manager', 'admin'))
  );
```

## Применение исправлений

### **Файлы, которые были обновлены:**

1. **`promt/data_schema_prompt.yaml.yaml`** - Обновлены RLS политики в схеме данных
2. **`promt/complete_rls_optimization.sql`** - Полный скрипт очистки и оптимизации (РЕКОМЕНДУЕТСЯ)
3. **`promt/rls_performance_optimization.sql`** - Альтернативный скрипт оптимизации
4. **`promt/fix_equipment_policies.sql`** - Удаление проблемных политик для equipment
5. **`promt/fix_users_policy.sql`** - Исправление политики доступа к пользователям
6. **`promt/fix_users_policy_universal.sql`** - Универсальное исправление политики пользователей
7. **`promt/check_user_roles.sql`** - Проверка ролей пользователей в базе данных
8. **`promt/check_policies.sql`** - Проверка всех RLS политик в базе данных

### **Для применения в базе данных:**

**РЕКОМЕНДУЕТСЯ:** Выполните полный скрипт `promt/complete_rls_optimization.sql` в вашей Supabase базе данных:

```bash
# Через Supabase CLI
supabase db reset --linked

# Или через SQL Editor в Supabase Dashboard
# Скопируйте содержимое файла complete_rls_optimization.sql
```

**Этот скрипт:**
- Удаляет ВСЕ старые политики (включая дублирующие)
- Создает новые оптимизированные политики
- Решает проблемы с производительностью и дублированием

**Для оставшихся предупреждений equipment:**
Выполните `promt/fix_equipment_policies.sql` для удаления старых политик "Users can view equipment", "Users can create equipment" и т.д.

## Проверка оптимизации

### **До оптимизации:**
```sql
-- Запрос может быть медленным
SELECT * FROM equipments WHERE category = 'camera';
```

### **После оптимизации:**
```sql
-- Запрос должен выполняться быстрее
SELECT * FROM equipments WHERE category = 'camera';
```

## Мониторинг производительности

### **Полезные запросы для мониторинга:**

```sql
-- Проверка времени выполнения запросов
EXPLAIN ANALYZE SELECT * FROM equipments LIMIT 100;

-- Проверка использования индексов
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
WHERE tablename = 'equipments';
```

## Анализ проблем Supabase

### **Проблемы с производительностью:**
- `auth.uid()` и `auth.role()` пересчитываются для каждой строки
- Решение: замена на `(select auth.uid())` и `(select auth.role())`

### **Проблемы с дублирующими политиками:**
- Множественные политики для одних и тех же действий
- Конфликты между старыми и новыми политиками
- Решение: полная очистка всех старых политик

### **Проблемные таблицы:**
- **events** - множественные политики для SELECT, INSERT, UPDATE, DELETE
- **users** - множественные политики для SELECT
- **equipment** - старые политики с неоптимизированными auth функциями

## Дополнительные рекомендации

1. **Индексы:** Убедитесь, что на столбцах, используемых в RLS политиках, созданы индексы
2. **Мониторинг:** Регулярно проверяйте производительность запросов
3. **Тестирование:** Протестируйте оптимизации на тестовой среде перед применением в продакшене
4. **Очистка:** Используйте `complete_rls_optimization.sql` для полной очистки и оптимизации

## Связанные файлы

- `promt/supabase_schema.sql` - Уже содержит оптимизированные политики
- `promt/optimized_rls_policies.sql` - Альтернативный набор оптимизированных политик
- `promt/equipment_lists_rls_policies.sql` - Политики для equipment_lists (уже оптимизированы) 