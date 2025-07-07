-- Полный SQL-скрипт для Supabase/Postgres: создание таблиц и RLS-политик
-- Актуально для схемы warehousev4, production-стандарты, RLS, RBAC

-- Таблица пользователей
create table users (
  id uuid primary key default gen_random_uuid(),
  name varchar(100) not null,
  email varchar(120) not null unique,
  role varchar(32) not null check (role in ('video_engineer', 'technician', 'manager', 'admin')),
  shifts_count integer not null default 0
);

-- Таблица оборудования
create table equipments (
  id uuid primary key default gen_random_uuid(),
  model varchar(120) not null,
  brand varchar(80) not null,
  serial_number varchar(64) not null unique,
  quantity integer not null,
  status varchar(20) not null check (status in ('operational', 'broken', 'in_repair')),
  location varchar(120) not null,
  category varchar(80) not null,
  subcategory varchar(80) not null,
  tech_description text,
  description text
);

-- Таблица мероприятий
create table events (
  id uuid primary key default gen_random_uuid(),
  name varchar(120) not null,
  organizer varchar(120) not null,
  location varchar(120) not null,
  description text,
  technical_task text,
  photos text[] default '{}',
  setup_date date,
  start_date date,
  end_date date,
  teardown_date date,
  mount_points_count integer not null default 0,
  responsible_engineers uuid[] not null
);

-- Таблица точек монтажа
create table mount_points (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  name varchar(120) not null,
  responsible_engineers uuid[] not null,
  equipment_plan uuid[] not null,
  equipment_final uuid[] not null,
  equipment_fact uuid[] not null
);

-- Таблица отчётов
create table reports (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  generated_at timestamp with time zone not null default now(),
  content jsonb not null
);

-- Включаем RLS для всех таблиц
alter table users enable row level security;
alter table equipments enable row level security;
alter table events enable row level security;
alter table mount_points enable row level security;
alter table reports enable row level security;

-- RLS policies: USERS
create policy "Users can view own profile" on users
  for select using (auth.uid() = id);

create policy "Admins can insert users" on users
  for insert with check (exists (select 1 from users as u where u.id = auth.uid() and u.role = 'admin'));
create policy "Admins can update users" on users
  for update using (exists (select 1 from users as u where u.id = auth.uid() and u.role = 'admin'));
create policy "Admins can delete users" on users
  for delete using (exists (select 1 from users as u where u.id = auth.uid() and u.role = 'admin'));

-- RLS policies: EQUIPMENTS
create policy "All authenticated can read equipments" on equipments
  for select using (auth.uid() is not null);

create policy "Engineers/Technicians can insert equipments" on equipments
  for insert with check (
    exists (select 1 from users as u where u.id = auth.uid() and u.role in ('video_engineer', 'technician', 'manager', 'admin'))
  );
create policy "Engineers/Technicians can update equipments" on equipments
  for update using (
    exists (select 1 from users as u where u.id = auth.uid() and u.role in ('video_engineer', 'technician', 'manager', 'admin'))
  );
create policy "Manager/Admin can delete equipments" on equipments
  for delete using (
    exists (select 1 from users as u where u.id = auth.uid() and u.role in ('manager', 'admin'))
  );

-- RLS policies: EVENTS
create policy "Engineers can select own events" on events
  for select using (
    auth.uid() = ANY(responsible_engineers)
    or exists (select 1 from users as u where u.id = auth.uid() and u.role in ('manager', 'admin'))
  );
create policy "Engineers can insert events" on events
  for insert with check (
    auth.uid() = ANY(responsible_engineers)
    or exists (select 1 from users as u where u.id = auth.uid() and u.role in ('manager', 'admin'))
  );
create policy "Engineers can update events" on events
  for update using (
    auth.uid() = ANY(responsible_engineers)
    or exists (select 1 from users as u where u.id = auth.uid() and u.role in ('manager', 'admin'))
  );
create policy "Engineers can delete events" on events
  for delete using (
    auth.uid() = ANY(responsible_engineers)
    or exists (select 1 from users as u where u.id = auth.uid() and u.role in ('manager', 'admin'))
  );

-- RLS policies: MOUNT_POINTS
create policy "Engineers can select mount_points of their events" on mount_points
  for select using (
    exists (
      select 1 from events e
      where e.id = event_id
        and (auth.uid() = ANY(e.responsible_engineers)
        or exists (select 1 from users as u where u.id = auth.uid() and u.role in ('manager', 'admin')))
    )
  );
create policy "Engineers can insert mount_points of their events" on mount_points
  for insert with check (
    exists (
      select 1 from events e
      where e.id = event_id
        and (auth.uid() = ANY(e.responsible_engineers)
        or exists (select 1 from users as u where u.id = auth.uid() and u.role in ('manager', 'admin')))
    )
  );
create policy "Engineers can update mount_points of their events" on mount_points
  for update using (
    exists (
      select 1 from events e
      where e.id = event_id
        and (auth.uid() = ANY(e.responsible_engineers)
        or exists (select 1 from users as u where u.id = auth.uid() and u.role in ('manager', 'admin')))
    )
  );
create policy "Engineers can delete mount_points of their events" on mount_points
  for delete using (
    exists (
      select 1 from events e
      where e.id = event_id
        and (auth.uid() = ANY(e.responsible_engineers)
        or exists (select 1 from users as u where u.id = auth.uid() and u.role in ('manager', 'admin')))
    )
  );

-- RLS policies: REPORTS
create policy "Access reports by event permission (select)" on reports
  for select using (
    exists (
      select 1 from events e
      where e.id = event_id
        and (auth.uid() = ANY(e.responsible_engineers)
        or exists (select 1 from users as u where u.id = auth.uid() and u.role in ('manager', 'admin')))
    )
  );
create policy "Access reports by event permission (insert)" on reports
  for insert with check (
    exists (
      select 1 from events e
      where e.id = event_id
        and (auth.uid() = ANY(e.responsible_engineers)
        or exists (select 1 from users as u where u.id = auth.uid() and u.role in ('manager', 'admin')))
    )
  );
create policy "Access reports by event permission (update)" on reports
  for update using (
    exists (
      select 1 from events e
      where e.id = event_id
        and (auth.uid() = ANY(e.responsible_engineers)
        or exists (select 1 from users as u where u.id = auth.uid() and u.role in ('manager', 'admin')))
    )
  );
create policy "Access reports by event permission (delete)" on reports
  for delete using (
    exists (
      select 1 from events e
      where e.id = event_id
        and (auth.uid() = ANY(e.responsible_engineers)
        or exists (select 1 from users as u where u.id = auth.uid() and u.role in ('manager', 'admin')))
    )
  ); 