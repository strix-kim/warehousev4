-- Миграция: связи events ↔ mount_points, индексы, триггер подсчёта
-- Дата: 2025-08-06

-- 1. Создаём внешнюю связь и каскадное удаление
-- Сначала удаляем старый FK (если был)
ALTER TABLE IF EXISTS mount_points
  DROP CONSTRAINT IF EXISTS mount_points_event_fk;

-- Затем добавляем новый FK с каскадным удалением
ALTER TABLE mount_points
  ADD CONSTRAINT mount_points_event_fk
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;

-- 2. Индексы для ускорения запросов
create index if not exists idx_mount_points_event on mount_points(event_id);
create index if not exists idx_events_archived on events(is_archived);

-- 3. Авто-подсчёт mount_points_count в таблице events
create or replace function update_mount_points_count() returns trigger as $$
begin
  update events
  set mount_points_count = (
      select count(*) from mount_points where event_id = new.event_id
  )
  where id = new.event_id;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_mount_points_count on mount_points;
create trigger trg_mount_points_count
  after insert or delete or update on mount_points
  for each row execute function update_mount_points_count();

-- 4. (Опционально) Добавляем статус точки монтажа
alter table if exists mount_points
  add column if not exists status text
    check (status in ('planned', 'in_progress', 'done')) default 'planned';
