-- Оптимизированные RLS политики для улучшения производительности
-- Заменяем auth.uid() и auth.role() на (select auth.uid()) и (select auth.role())
-- для предотвращения пересчета функций для каждой строки

-- Удаляем старые политики для equipments
DROP POLICY IF EXISTS "All authenticated can read equipments" ON equipments;
DROP POLICY IF EXISTS "Engineers/Technicians can insert equipments" ON equipments;
DROP POLICY IF EXISTS "Engineers/Technicians can update equipments" ON equipments;
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
DROP POLICY IF EXISTS "Engineers can select own events" ON events;
DROP POLICY IF EXISTS "Engineers can insert events" ON events;
DROP POLICY IF EXISTS "Engineers can update events" ON events;
DROP POLICY IF EXISTS "Engineers can delete events" ON events;

-- Создаем оптимизированные политики для events
CREATE POLICY "Engineers can select own events" ON events
  FOR SELECT USING (
    (select auth.uid()) = ANY(responsible_engineers)
    or exists (select 1 from users as u where u.id = (select auth.uid()) and u.role in ('manager', 'admin'))
  );

CREATE POLICY "Engineers can insert events" ON events
  FOR INSERT WITH CHECK (
    (select auth.uid()) = ANY(responsible_engineers)
    or exists (select 1 from users as u where u.id = (select auth.uid()) and u.role in ('manager', 'admin'))
  );

CREATE POLICY "Engineers can update events" ON events
  FOR UPDATE USING (
    (select auth.uid()) = ANY(responsible_engineers)
    or exists (select 1 from users as u where u.id = (select auth.uid()) and u.role in ('manager', 'admin'))
  );

CREATE POLICY "Engineers can delete events" ON events
  FOR DELETE USING (
    (select auth.uid()) = ANY(responsible_engineers)
    or exists (select 1 from users as u where u.id = (select auth.uid()) and u.role in ('manager', 'admin'))
  );

-- Удаляем старые политики для mount_points
DROP POLICY IF EXISTS "Engineers can select mount_points of their events" ON mount_points;
DROP POLICY IF EXISTS "Engineers can insert mount_points of their events" ON mount_points;
DROP POLICY IF EXISTS "Engineers can update mount_points of their events" ON mount_points;
DROP POLICY IF EXISTS "Engineers can delete mount_points of their events" ON mount_points;

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
DROP POLICY IF EXISTS "Access reports by event permission (select)" ON reports;
DROP POLICY IF EXISTS "Access reports by event permission (insert)" ON reports;
DROP POLICY IF EXISTS "Access reports by event permission (update)" ON reports;

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

-- Удаляем старые политики для users
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Admins can insert users" ON users;
DROP POLICY IF EXISTS "Admins can update users" ON users;
DROP POLICY IF EXISTS "Admins can delete users" ON users;

-- Создаем оптимизированные политики для users
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING ((select auth.uid()) = id);

CREATE POLICY "Admins can insert users" ON users
  FOR INSERT WITH CHECK (exists (select 1 from users as u where u.id = (select auth.uid()) and u.role = 'admin'));

CREATE POLICY "Admins can update users" ON users
  FOR UPDATE USING (exists (select 1 from users as u where u.id = (select auth.uid()) and u.role = 'admin'));

CREATE POLICY "Admins can delete users" ON users
  FOR DELETE USING (exists (select 1 from users as u where u.id = (select auth.uid()) and u.role = 'admin'));

-- Удаляем старые политики для equipment_lists
DROP POLICY IF EXISTS "Authenticated users can create equipment lists" ON equipment_lists;
DROP POLICY IF EXISTS "Users can update equipment lists" ON equipment_lists;
DROP POLICY IF EXISTS "Authenticated users can delete equipment lists" ON equipment_lists;

-- Создаем оптимизированные политики для equipment_lists
CREATE POLICY "Authenticated users can create equipment lists" ON equipment_lists
  FOR INSERT WITH CHECK ((select auth.role()) = 'authenticated');

CREATE POLICY "Users can update equipment lists" ON equipment_lists
  FOR UPDATE USING ((select auth.role()) = 'authenticated');

CREATE POLICY "Authenticated users can delete equipment lists" ON equipment_lists
  FOR DELETE USING ((select auth.role()) = 'authenticated');

-- Комментарий о оптимизации
COMMENT ON SCHEMA public IS 'RLS политики оптимизированы для улучшения производительности запросов'; 