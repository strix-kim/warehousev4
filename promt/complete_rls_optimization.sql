-- ПОЛНАЯ ОПТИМИЗАЦИЯ RLS ПОЛИТИК
-- Удаляем ВСЕ старые политики и создаем новые оптимизированные

-- ==========================================
-- ОЧИСТКА ВСЕХ СТАРЫХ ПОЛИТИК
-- ==========================================

-- Удаляем все политики для users
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Admins can manage users" ON users;
DROP POLICY IF EXISTS "Admins can insert users" ON users;
DROP POLICY IF EXISTS "Admins can update users" ON users;
DROP POLICY IF EXISTS "Admins can delete users" ON users;
DROP POLICY IF EXISTS "All can select users" ON users;

-- Удаляем все политики для equipments
DROP POLICY IF EXISTS "All authenticated can read equipments" ON equipments;
DROP POLICY IF EXISTS "Engineers/Technicians can insert equipments" ON equipments;
DROP POLICY IF EXISTS "Engineers/Technicians can update equipments" ON equipments;
DROP POLICY IF EXISTS "Manager/Admin can delete equipments" ON equipments;
DROP POLICY IF EXISTS "Engineers/Technicians can insert/update" ON equipments;
DROP POLICY IF EXISTS "Users can view equipment" ON equipments;
DROP POLICY IF EXISTS "Users can create equipment" ON equipments;
DROP POLICY IF EXISTS "Users can update equipment" ON equipments;
DROP POLICY IF EXISTS "Users can delete equipment" ON equipments;

-- Удаляем все политики для events
DROP POLICY IF EXISTS "Engineers can select own events" ON events;
DROP POLICY IF EXISTS "Engineers can insert events" ON events;
DROP POLICY IF EXISTS "Engineers can update events" ON events;
DROP POLICY IF EXISTS "Engineers can delete events" ON events;
DROP POLICY IF EXISTS "Engineers can manage own events" ON events;
DROP POLICY IF EXISTS "All can select events" ON events;

-- Удаляем все политики для mount_points
DROP POLICY IF EXISTS "Engineers can select mount_points of their events" ON mount_points;
DROP POLICY IF EXISTS "Engineers can insert mount_points of their events" ON mount_points;
DROP POLICY IF EXISTS "Engineers can update mount_points of their events" ON mount_points;
DROP POLICY IF EXISTS "Engineers can delete mount_points of their events" ON mount_points;
DROP POLICY IF EXISTS "Engineers can manage mount_points of their events" ON mount_points;

-- Удаляем все политики для reports
DROP POLICY IF EXISTS "Access reports by event permission (select)" ON reports;
DROP POLICY IF EXISTS "Access reports by event permission (insert)" ON reports;
DROP POLICY IF EXISTS "Access reports by event permission (update)" ON reports;
DROP POLICY IF EXISTS "Access reports by event permission (delete)" ON reports;
DROP POLICY IF EXISTS "Access reports by event permission" ON reports;

-- ==========================================
-- СОЗДАНИЕ НОВЫХ ОПТИМИЗИРОВАННЫХ ПОЛИТИК
-- ==========================================

-- RLS policies: USERS
CREATE POLICY "All authenticated can view users" ON users
  FOR SELECT USING ((select auth.uid()) is not null);

CREATE POLICY "Admins can insert users" ON users
  FOR INSERT WITH CHECK (exists (select 1 from users as u where u.id = (select auth.uid()) and u.role = 'admin'));

CREATE POLICY "Admins can update users" ON users
  FOR UPDATE USING (exists (select 1 from users as u where u.id = (select auth.uid()) and u.role = 'admin'));

CREATE POLICY "Admins can delete users" ON users
  FOR DELETE USING (exists (select 1 from users as u where u.id = (select auth.uid()) and u.role = 'admin'));

-- RLS policies: EQUIPMENTS
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

-- RLS policies: EVENTS
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

-- RLS policies: MOUNT_POINTS
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

-- RLS policies: REPORTS
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

-- ==========================================
-- КОММЕНТАРИИ К ОПТИМИЗАЦИИ
-- ==========================================

COMMENT ON POLICY "All authenticated can view users" ON users IS 'Оптимизированная политика: все аутентифицированные пользователи видят всех пользователей';
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