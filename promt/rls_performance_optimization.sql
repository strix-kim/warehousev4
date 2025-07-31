-- Оптимизация производительности RLS политик
-- Заменяем auth.uid() и auth.role() на (select auth.uid()) и (select auth.role())
-- для предотвращения пересчета функций для каждой строки

-- Удаляем старые политики для users
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Admins can manage users" ON users;

-- Создаем оптимизированные политики для users
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING ((select auth.uid()) = id);

CREATE POLICY "Admins can insert users" ON users
  FOR INSERT WITH CHECK (exists (select 1 from users as u where u.id = (select auth.uid()) and u.role = 'admin'));

CREATE POLICY "Admins can update users" ON users
  FOR UPDATE USING (exists (select 1 from users as u where u.id = (select auth.uid()) and u.role = 'admin'));

CREATE POLICY "Admins can delete users" ON users
  FOR DELETE USING (exists (select 1 from users as u where u.id = (select auth.uid()) and u.role = 'admin'));

-- Удаляем старые политики для equipments
DROP POLICY IF EXISTS "All authenticated can read equipments" ON equipments;
DROP POLICY IF EXISTS "Engineers/Technicians can insert/update" ON equipments;
DROP POLICY IF EXISTS "Manager/Admin can delete equipments" ON equipments;

-- Создаем оптимизированные политики для equipments
CREATE POLICY "All authenticated can read equipments" ON equipments
  FOR SELECT USING ((select auth.uid()) is not null);

CREATE POLICY "Engineers/Technicians can insert equipments" ON equipments
  FOR INSERT WITH CHECK (
    exists (select 1 from users as u where u.id = (select auth.uid()) and u.role in ('video_engineer', 'technician', 'manager', 'admin'))
  );

CREATE POLICY "Engineers/Technicians can update equipments" ON equipments
  FOR UPDATE USING (
    exists (select 1 from users as u where u.id = (select auth.uid()) and u.role in ('video_engineer', 'technician', 'manager', 'admin'))
  );

CREATE POLICY "Manager/Admin can delete equipments" ON equipments
  FOR DELETE USING (
    exists (select 1 from users as u where u.id = (select auth.uid()) and u.role in ('manager', 'admin'))
  );

-- Удаляем старые политики для events
DROP POLICY IF EXISTS "Engineers can manage own events" ON events;

-- Создаем оптимизированные политики для events
CREATE POLICY "Engineers can select own events" ON events
  FOR SELECT USING (
    (select auth.uid()) = ANY(responsible_engineers)
    or exists (select 1 from users as u where u.id = (select auth.uid()) and u.role in ('manager', 'admin'))
  );

CREATE POLICY "Engineers can insert own events" ON events
  FOR INSERT WITH CHECK (
    (select auth.uid()) = ANY(responsible_engineers)
    or exists (select 1 from users as u where u.id = (select auth.uid()) and u.role in ('manager', 'admin'))
  );

CREATE POLICY "Engineers can update own events" ON events
  FOR UPDATE USING (
    (select auth.uid()) = ANY(responsible_engineers)
    or exists (select 1 from users as u where u.id = (select auth.uid()) and u.role in ('manager', 'admin'))
  );

CREATE POLICY "Engineers can delete own events" ON events
  FOR DELETE USING (
    (select auth.uid()) = ANY(responsible_engineers)
    or exists (select 1 from users as u where u.id = (select auth.uid()) and u.role in ('manager', 'admin'))
  );

-- Удаляем старые политики для mount_points
DROP POLICY IF EXISTS "Engineers can manage mount_points of their events" ON mount_points;

-- Создаем оптимизированные политики для mount_points
CREATE POLICY "Engineers can select mount_points of their events" ON mount_points
  FOR SELECT USING (
    exists (
      select 1 from events e
      where e.id = event_id
        and ((select auth.uid()) = ANY(e.responsible_engineers)
        or exists (select 1 from users as u where u.id = (select auth.uid()) and u.role in ('manager', 'admin')))
    )
  );

CREATE POLICY "Engineers can insert mount_points of their events" ON mount_points
  FOR INSERT WITH CHECK (
    exists (
      select 1 from events e
      where e.id = event_id
        and ((select auth.uid()) = ANY(e.responsible_engineers)
        or exists (select 1 from users as u where u.id = (select auth.uid()) and u.role in ('manager', 'admin')))
    )
  );

CREATE POLICY "Engineers can update mount_points of their events" ON mount_points
  FOR UPDATE USING (
    exists (
      select 1 from events e
      where e.id = event_id
        and ((select auth.uid()) = ANY(e.responsible_engineers)
        or exists (select 1 from users as u where u.id = (select auth.uid()) and u.role in ('manager', 'admin')))
    )
  );

CREATE POLICY "Engineers can delete mount_points of their events" ON mount_points
  FOR DELETE USING (
    exists (
      select 1 from events e
      where e.id = event_id
        and ((select auth.uid()) = ANY(e.responsible_engineers)
        or exists (select 1 from users as u where u.id = (select auth.uid()) and u.role in ('manager', 'admin')))
    )
  );

-- Удаляем старые политики для reports
DROP POLICY IF EXISTS "Access reports by event permission" ON reports;

-- Создаем оптимизированные политики для reports
CREATE POLICY "Access reports by event permission (select)" ON reports
  FOR SELECT USING (
    exists (
      select 1 from events e
      where e.id = event_id
        and ((select auth.uid()) = ANY(e.responsible_engineers)
        or exists (select 1 from users as u where u.id = (select auth.uid()) and u.role in ('manager', 'admin')))
    )
  );

CREATE POLICY "Access reports by event permission (insert)" ON reports
  FOR INSERT WITH CHECK (
    exists (
      select 1 from events e
      where e.id = event_id
        and ((select auth.uid()) = ANY(e.responsible_engineers)
        or exists (select 1 from users as u where u.id = (select auth.uid()) and u.role in ('manager', 'admin')))
    )
  );

CREATE POLICY "Access reports by event permission (update)" ON reports
  FOR UPDATE USING (
    exists (
      select 1 from events e
      where e.id = event_id
        and ((select auth.uid()) = ANY(e.responsible_engineers)
        or exists (select 1 from users as u where u.id = (select auth.uid()) and u.role in ('manager', 'admin')))
    )
  );

CREATE POLICY "Access reports by event permission (delete)" ON reports
  FOR DELETE USING (
    exists (
      select 1 from events e
      where e.id = event_id
        and ((select auth.uid()) = ANY(e.responsible_engineers)
        or exists (select 1 from users as u where u.id = (select auth.uid()) and u.role in ('manager', 'admin')))
    )
  );

-- Комментарии к оптимизации
COMMENT ON POLICY "Users can view own profile" ON users IS 'Оптимизированная политика с (select auth.uid()) для улучшения производительности';
COMMENT ON POLICY "Admins can insert users" ON users IS 'Оптимизированная политика с (select auth.uid()) для улучшения производительности';
COMMENT ON POLICY "Admins can update users" ON users IS 'Оптимизированная политика с (select auth.uid()) для улучшения производительности';
COMMENT ON POLICY "Admins can delete users" ON users IS 'Оптимизированная политика с (select auth.uid()) для улучшения производительности';
COMMENT ON POLICY "All authenticated can read equipments" ON equipments IS 'Оптимизированная политика с (select auth.uid()) для улучшения производительности';
COMMENT ON POLICY "Engineers/Technicians can insert equipments" ON equipments IS 'Оптимизированная политика с (select auth.uid()) для улучшения производительности';
COMMENT ON POLICY "Engineers/Technicians can update equipments" ON equipments IS 'Оптимизированная политика с (select auth.uid()) для улучшения производительности';
COMMENT ON POLICY "Manager/Admin can delete equipments" ON equipments IS 'Оптимизированная политика с (select auth.uid()) для улучшения производительности';
COMMENT ON POLICY "Engineers can select own events" ON events IS 'Оптимизированная политика с (select auth.uid()) для улучшения производительности';
COMMENT ON POLICY "Engineers can insert own events" ON events IS 'Оптимизированная политика с (select auth.uid()) для улучшения производительности';
COMMENT ON POLICY "Engineers can update own events" ON events IS 'Оптимизированная политика с (select auth.uid()) для улучшения производительности';
COMMENT ON POLICY "Engineers can delete own events" ON events IS 'Оптимизированная политика с (select auth.uid()) для улучшения производительности';
COMMENT ON POLICY "Engineers can select mount_points of their events" ON mount_points IS 'Оптимизированная политика с (select auth.uid()) для улучшения производительности';
COMMENT ON POLICY "Engineers can insert mount_points of their events" ON mount_points IS 'Оптимизированная политика с (select auth.uid()) для улучшения производительности';
COMMENT ON POLICY "Engineers can update mount_points of their events" ON mount_points IS 'Оптимизированная политика с (select auth.uid()) для улучшения производительности';
COMMENT ON POLICY "Engineers can delete mount_points of their events" ON mount_points IS 'Оптимизированная политика с (select auth.uid()) для улучшения производительности';
COMMENT ON POLICY "Access reports by event permission (select)" ON reports IS 'Оптимизированная политика с (select auth.uid()) для улучшения производительности';
COMMENT ON POLICY "Access reports by event permission (insert)" ON reports IS 'Оптимизированная политика с (select auth.uid()) для улучшения производительности';
COMMENT ON POLICY "Access reports by event permission (update)" ON reports IS 'Оптимизированная политика с (select auth.uid()) для улучшения производительности';
COMMENT ON POLICY "Access reports by event permission (delete)" ON reports IS 'Оптимизированная политика с (select auth.uid()) для улучшения производительности'; 