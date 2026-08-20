-- =============================================================================
-- BASELINE: снимок прод-схемы Supabase (проект warehousev4, umbqiktyqlfqqgupxqdm)
-- Снят 2026-08-20 в сессии 2 через Supabase MCP по системному каталогу Postgres.
--
-- ЗАЧЕМ. DDL базовых таблиц никогда не лежал в git: первая запись в
-- supabase_migrations.schema_migrations датирована 19.08.2026, а проект живёт
-- с 22.06.2025 — всё, что старше, создавалось кликами в дашборде. Этот файл
-- закрывает дыру: из него база воссоздаётся с нуля.
--
-- КАК ЧИТАТЬ. Это НЕ миграция-изменение. К проду он уже "применён" по факту —
-- прод и есть его источник. Версия 00000000000000 выбрана так, чтобы он всегда
-- шёл первым, до миграций 20260819*.
--
-- ПОВТОРНЫЙ ПРОГОН БЕЗОПАСЕН: всё обёрнуто в if not exists / drop if exists.
-- На существующей базе файл ничего не меняет.
--
-- ЧЕГО ЗДЕСЬ НЕТ (живёт вне DDL, восстанавливается отдельно):
--   * данные (1481 позиция оборудования, 1391 запись движения);
--   * настройки Auth, Storage, хостинга;
--   * служебные схемы Supabase (auth, storage, realtime) — их ведёт платформа.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Схемы и расширения
-- -----------------------------------------------------------------------------

-- private прячет хелперы прав от PostgREST: схема не в exposed_schemas,
-- поэтому её функции нельзя вызвать из браузера, но политики их видят.
create schema if not exists private;
grant usage on schema private to authenticated;

-- В проде стоят только эти (остальные из каталога Supabase не установлены):
-- pgcrypto и uuid-ossp в extensions, pg_graphql в graphql,
-- supabase_vault в vault, pg_stat_statements в extensions, plpgsql в pg_catalog.
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;

-- -----------------------------------------------------------------------------
-- 1. Таблицы
-- -----------------------------------------------------------------------------

-- Профили сотрудников. ВНИМАНИЕ: users.id НЕ связан внешним ключом с auth.users —
-- совпадение id держится соглашением, а не базой. См. долг в backlog.md.
create table if not exists public.users (
  id uuid not null default gen_random_uuid(),
  name character varying(100) not null,
  email character varying(120) not null,
  role character varying(32) not null,
  shifts_count integer not null default 0
);

-- Склад. Серийная позиция и количественная различаются разбором serialnumber
-- на стороне приложения: колонок tracking_mode / inventory_code в базе нет.
create table if not exists public.equipment (
  id uuid not null default gen_random_uuid(),
  model text not null,
  brand text not null,
  serialnumber text not null,
  type text not null,
  subtype text not null,
  technicalspecification text,
  lengthinmeters text default 'N/A'::text,
  count integer default 1,
  availability text default 'available'::text,
  description text,
  location text not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Мероприятия, точки монтажа и отчёты — наследие Vue-версии. Продукт их не
-- использует, у роли authenticated нет на них ни одного гранта (см. раздел 7).
create table if not exists public.events (
  id uuid not null default gen_random_uuid(),
  name character varying(120) not null,
  organizer character varying(120) not null,
  location character varying(120) not null,
  description text,
  technical_task text,
  photos text[] default '{}'::text[],
  setup_date date,
  start_date date,
  end_date date,
  teardown_date date,
  mount_points_count integer not null default 0,
  responsible_engineers uuid[] not null,
  created_at timestamp with time zone default now(),
  is_archived boolean not null default false
);

create table if not exists public.mount_points (
  id uuid not null default gen_random_uuid(),
  event_id uuid not null,
  name character varying(120) not null,
  responsible_engineers uuid[] not null,
  equipment_plan uuid[] not null,
  equipment_final uuid[] not null,
  equipment_fact uuid[] not null,
  technical_duties jsonb,
  location text,
  start_date date,
  status text default 'planned'::text
);

create table if not exists public.reports (
  id uuid not null default gen_random_uuid(),
  event_id uuid not null,
  generated_at timestamp with time zone not null default now(),
  content jsonb not null,
  created_at timestamp with time zone default now()
);

-- Список оборудования — центральная сущность продукта.
-- equipment_ids и equipment_items — денормализованное наследие: реальный состав
-- живёт в equipment_reservation_items, эти две колонки RPC поддерживает для
-- обратной совместимости со старым клиентом.
create table if not exists public.equipment_lists (
  id uuid not null default gen_random_uuid(),
  name character varying(255) not null,
  description text,
  type character varying(50) not null,
  event_id uuid,
  mount_point_id uuid,
  equipment_ids uuid[] not null default '{}'::uuid[],
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  created_by uuid,
  is_archived boolean default false,
  equipment_items jsonb default '[]'::jsonb,
  list_mode character varying(20) default 'specific'::character varying,
  reservation_status text not null default 'draft'::text,
  reservation_start date,
  reservation_end date,
  confirmed_at timestamp with time zone,
  issued_at timestamp with time zone,
  returned_at timestamp with time zone,
  status_changed_at timestamp with time zone not null default now(),
  status_changed_by uuid,
  shortage_snapshot jsonb not null default '[]'::jsonb,
  client_name text,
  venue text
);

comment on table public.equipment_lists is
  'Списки оборудования для различных целей (охрана, отчеты, кастомные)';

-- Реальный состав списка. tracking_mode = planned означает строку-план без
-- привязки к единице склада (equipment_id null) — это разрешено CHECK-ом ниже.
create table if not exists public.equipment_reservation_items (
  id uuid not null default gen_random_uuid(),
  list_id uuid not null,
  equipment_id uuid,
  brand text not null,
  model text not null,
  type text not null,
  subtype text not null,
  tracking_mode text not null,
  requested_count integer not null default 1,
  created_by uuid not null default auth.uid(),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

-- Журнал этапов списка. Пишется ТОЛЬКО триггером private.log_reservation_status_change;
-- у authenticated есть грант на select и нет ни одной политики записи.
create table if not exists public.reservation_status_history (
  id uuid not null default gen_random_uuid(),
  list_id uuid not null,
  from_status text,
  to_status text not null,
  note text,
  shortage_snapshot jsonb not null default '[]'::jsonb,
  changed_by uuid,
  changed_at timestamp with time zone not null default now()
);

-- Журнал движения склада. Пишется ТОЛЬКО триггером private.log_equipment_change,
-- на тех же условиях, что и история этапов.
create table if not exists public.equipment_movements (
  id uuid not null default gen_random_uuid(),
  equipment_id uuid not null,
  list_id uuid,
  movement_type text not null,
  quantity_delta integer not null default 0,
  quantity_before integer,
  quantity_after integer,
  status_before text,
  status_after text,
  note text,
  changed_by uuid,
  changed_at timestamp with time zone not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

-- -----------------------------------------------------------------------------
-- 2. Ключи и ограничения
-- -----------------------------------------------------------------------------

do $$
begin
  -- Первичные ключи
  if not exists (select 1 from pg_constraint where conname = 'users_pkey') then
    alter table public.users add constraint users_pkey primary key (id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'equipment_pkey') then
    alter table public.equipment add constraint equipment_pkey primary key (id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'events_pkey') then
    alter table public.events add constraint events_pkey primary key (id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'mount_points_pkey') then
    alter table public.mount_points add constraint mount_points_pkey primary key (id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'reports_pkey') then
    alter table public.reports add constraint reports_pkey primary key (id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'equipment_lists_pkey') then
    alter table public.equipment_lists add constraint equipment_lists_pkey primary key (id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'equipment_reservation_items_pkey') then
    alter table public.equipment_reservation_items add constraint equipment_reservation_items_pkey primary key (id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'reservation_status_history_pkey') then
    alter table public.reservation_status_history add constraint reservation_status_history_pkey primary key (id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'equipment_movements_pkey') then
    alter table public.equipment_movements add constraint equipment_movements_pkey primary key (id);
  end if;

  -- Уникальность
  if not exists (select 1 from pg_constraint where conname = 'users_email_key') then
    alter table public.users add constraint users_email_key unique (email);
  end if;
  -- Одна единица склада не может попасть в один список дважды.
  -- NULL-и не конфликтуют, поэтому строк tracking_mode = 'planned' может быть много.
  if not exists (select 1 from pg_constraint where conname = 'equipment_reservation_items_list_equipment_key') then
    alter table public.equipment_reservation_items
      add constraint equipment_reservation_items_list_equipment_key unique (list_id, equipment_id);
  end if;

  -- Внешние ключи
  if not exists (select 1 from pg_constraint where conname = 'mount_points_event_id_fkey') then
    alter table public.mount_points add constraint mount_points_event_id_fkey
      foreign key (event_id) references public.events(id) on delete cascade;
  end if;
  -- Дубликат предыдущего ключа: та же пара колонок, то же поведение.
  -- Воспроизведён как есть, чтобы файл совпадал с продом; долг записан в backlog.md.
  if not exists (select 1 from pg_constraint where conname = 'mount_points_event_fk') then
    alter table public.mount_points add constraint mount_points_event_fk
      foreign key (event_id) references public.events(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'reports_event_id_fkey') then
    alter table public.reports add constraint reports_event_id_fkey
      foreign key (event_id) references public.events(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'equipment_lists_event_id_fkey') then
    alter table public.equipment_lists add constraint equipment_lists_event_id_fkey
      foreign key (event_id) references public.events(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'equipment_lists_mount_point_id_fkey') then
    alter table public.equipment_lists add constraint equipment_lists_mount_point_id_fkey
      foreign key (mount_point_id) references public.mount_points(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'equipment_lists_created_by_fkey') then
    alter table public.equipment_lists add constraint equipment_lists_created_by_fkey
      foreign key (created_by) references auth.users(id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'equipment_lists_status_changed_by_fkey') then
    alter table public.equipment_lists add constraint equipment_lists_status_changed_by_fkey
      foreign key (status_changed_by) references auth.users(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'equipment_reservation_items_list_id_fkey') then
    alter table public.equipment_reservation_items add constraint equipment_reservation_items_list_id_fkey
      foreign key (list_id) references public.equipment_lists(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'equipment_reservation_items_equipment_id_fkey') then
    alter table public.equipment_reservation_items add constraint equipment_reservation_items_equipment_id_fkey
      foreign key (equipment_id) references public.equipment(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'equipment_reservation_items_created_by_fkey') then
    alter table public.equipment_reservation_items add constraint equipment_reservation_items_created_by_fkey
      foreign key (created_by) references auth.users(id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'reservation_status_history_list_id_fkey') then
    alter table public.reservation_status_history add constraint reservation_status_history_list_id_fkey
      foreign key (list_id) references public.equipment_lists(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'reservation_status_history_changed_by_fkey') then
    alter table public.reservation_status_history add constraint reservation_status_history_changed_by_fkey
      foreign key (changed_by) references auth.users(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'equipment_movements_equipment_id_fkey') then
    alter table public.equipment_movements add constraint equipment_movements_equipment_id_fkey
      foreign key (equipment_id) references public.equipment(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'equipment_movements_list_id_fkey') then
    alter table public.equipment_movements add constraint equipment_movements_list_id_fkey
      foreign key (list_id) references public.equipment_lists(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'equipment_movements_changed_by_fkey') then
    alter table public.equipment_movements add constraint equipment_movements_changed_by_fkey
      foreign key (changed_by) references auth.users(id) on delete set null;
  end if;

  -- Проверки
  if not exists (select 1 from pg_constraint where conname = 'users_role_check') then
    alter table public.users add constraint users_role_check
      check ((role)::text = any ((array['video_engineer','technician','manager','admin'])::text[]));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'equipment_availability_check') then
    alter table public.equipment add constraint equipment_availability_check
      check (availability = any (array['available','unavailable','diagnostics','issued']));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'equipment_count_nonnegative_check') then
    alter table public.equipment add constraint equipment_count_nonnegative_check check (count >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'mount_points_status_check') then
    alter table public.mount_points add constraint mount_points_status_check
      check (status = any (array['planned','in_progress','done']));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'equipment_lists_list_mode_check') then
    alter table public.equipment_lists add constraint equipment_lists_list_mode_check
      check ((list_mode)::text = any ((array['specific','abstract'])::text[]));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'equipment_lists_reservation_status_check') then
    alter table public.equipment_lists add constraint equipment_lists_reservation_status_check
      check (reservation_status = any (array['draft','confirmed','issued','returned']));
  end if;
  -- Даты брони либо обе пусты, либо образуют корректный диапазон.
  if not exists (select 1 from pg_constraint where conname = 'equipment_lists_reservation_dates_check') then
    alter table public.equipment_lists add constraint equipment_lists_reservation_dates_check
      check (
        (reservation_start is null and reservation_end is null)
        or (reservation_start is not null and reservation_end is not null
            and reservation_start <= reservation_end)
      );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'equipment_reservation_items_tracking_check') then
    alter table public.equipment_reservation_items add constraint equipment_reservation_items_tracking_check
      check (tracking_mode = any (array['serialized','quantity','planned']));
  end if;
  -- Строка-план не ссылается на единицу склада; серийная и количественная обязаны.
  if not exists (select 1 from pg_constraint where conname = 'equipment_reservation_items_equipment_check') then
    alter table public.equipment_reservation_items add constraint equipment_reservation_items_equipment_check
      check (
        (tracking_mode = 'planned' and equipment_id is null)
        or (tracking_mode = any (array['serialized','quantity']) and equipment_id is not null)
      );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'equipment_reservation_items_count_check') then
    alter table public.equipment_reservation_items add constraint equipment_reservation_items_count_check
      check (requested_count > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'reservation_status_history_from_check') then
    alter table public.reservation_status_history add constraint reservation_status_history_from_check
      check (from_status is null or from_status = any (array['draft','confirmed','issued','returned']));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'reservation_status_history_to_check') then
    alter table public.reservation_status_history add constraint reservation_status_history_to_check
      check (to_status = any (array['draft','confirmed','issued','returned']));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'equipment_movements_type_check') then
    alter table public.equipment_movements add constraint equipment_movements_type_check
      check (movement_type = any (array[
        'created','quantity_changed','status_changed','quantity_and_status_changed',
        'status_normalized','issued','returned'
      ]));
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- 3. Индексы
--
-- ВНИМАНИЕ: уникального индекса на equipment.serialnumber в проде НЕТ —
-- idx_equipment_serialnumber обычный btree. Уникальность серийников держит
-- только клиент. Это открытая дыра, см. backlog.md; чинить её можно лишь
-- после физической сверки наклеек (в базе 11 повторяющихся серийников).
-- -----------------------------------------------------------------------------

create index if not exists idx_equipment_availability on public.equipment using btree (availability);
create index if not exists idx_equipment_brand on public.equipment using btree (brand);
create index if not exists idx_equipment_location on public.equipment using btree (location);
create index if not exists idx_equipment_model on public.equipment using btree (model);
create index if not exists idx_equipment_serialnumber on public.equipment using btree (serialnumber);
create index if not exists idx_equipment_subtype on public.equipment using btree (subtype);
create index if not exists idx_equipment_type on public.equipment using btree (type);

-- Полнотекстовый поиск по русскому словарю: модель, бренд, серийник, описание.
create index if not exists idx_equipment_search on public.equipment
  using gin (to_tsvector('russian'::regconfig,
    model || ' ' || brand || ' ' || serialnumber || ' ' || coalesce(description, '')));

create index if not exists idx_events_archived on public.events using btree (is_archived);

create index if not exists idx_mount_points_event on public.mount_points using btree (event_id);
create index if not exists idx_mount_points_location on public.mount_points using btree (location);
create index if not exists idx_mount_points_start_date on public.mount_points using btree (start_date);

create index if not exists reports_event_id_idx on public.reports using btree (event_id)
  where (event_id is not null);

create index if not exists idx_equipment_lists_created_at on public.equipment_lists using btree (created_at);
create index if not exists idx_equipment_lists_event_id on public.equipment_lists using btree (event_id);
create index if not exists idx_equipment_lists_is_archived on public.equipment_lists using btree (is_archived);
create index if not exists idx_equipment_lists_list_mode on public.equipment_lists using btree (list_mode);
create index if not exists idx_equipment_lists_type on public.equipment_lists using btree (type);
create index if not exists equipment_lists_created_by_idx on public.equipment_lists using btree (created_by);
create index if not exists equipment_lists_mount_point_id_idx on public.equipment_lists using btree (mount_point_id)
  where (mount_point_id is not null);
create index if not exists equipment_lists_status_changed_by_idx on public.equipment_lists using btree (status_changed_by)
  where (status_changed_by is not null);

-- Под запрос пересечения окон брони в reservation_shortages().
create index if not exists equipment_lists_reservation_window_idx on public.equipment_lists
  using btree (reservation_status, reservation_start, reservation_end)
  where (reservation_status = any (array['confirmed','issued']));

create index if not exists equipment_reservation_items_list_idx on public.equipment_reservation_items using btree (list_id);
create index if not exists equipment_reservation_items_created_by_idx on public.equipment_reservation_items using btree (created_by);
create index if not exists equipment_reservation_items_equipment_idx on public.equipment_reservation_items using btree (equipment_id)
  where (equipment_id is not null);

-- Группировка позиций по модели идёт по нормализованному тексту — тот же ключ,
-- по которому reservation_shortages() джойнит склад.
create index if not exists equipment_reservation_items_model_idx on public.equipment_reservation_items
  using btree (lower(btrim(brand)), lower(btrim(model)), lower(btrim(type)), lower(btrim(subtype)));

create index if not exists reservation_status_history_list_changed_idx on public.reservation_status_history
  using btree (list_id, changed_at desc);
create index if not exists reservation_status_history_changed_by_idx on public.reservation_status_history
  using btree (changed_by) where (changed_by is not null);

create index if not exists equipment_movements_equipment_changed_idx on public.equipment_movements
  using btree (equipment_id, changed_at desc);
create index if not exists equipment_movements_list_idx on public.equipment_movements using btree (list_id)
  where (list_id is not null);
create index if not exists equipment_movements_changed_by_idx on public.equipment_movements using btree (changed_by)
  where (changed_by is not null);

-- -----------------------------------------------------------------------------
-- 4. Функции схемы private
--
-- КАНОН, НАРУШАТЬ НЕЛЬЗЯ: is_app_member() и has_any_role() объявлены
-- SECURITY DEFINER именно потому, что у роли authenticated нет ни одного гранта
-- на public.users (раздел 7). Снимете definer — обе функции начнут возвращать
-- false, каждая политика через них закроется, и вход ляжет у всех пользователей.
-- -----------------------------------------------------------------------------

create or replace function private.is_app_member()
 returns boolean
 language sql
 stable security definer
 set search_path to ''
as $function$
  select exists (
    select 1
    from public.users u
    where u.id = (select auth.uid())
  );
$function$;

create or replace function private.has_any_role(allowed_roles text[])
 returns boolean
 language sql
 stable security definer
 set search_path to ''
as $function$
  select exists (
    select 1
    from public.users u
    where u.id = (select auth.uid())
      and u.role::text = any (allowed_roles)
  );
$function$;

-- Гвард жизненного цикла списка. Держится на сессионной переменной
-- argo.transition_allowed, которую выставляет только transition_equipment_list_status().
-- Прямой UPDATE из браузера пройти сквозь него не может.
create or replace function private.guard_reservation_list_update()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  if new.status_changed_at is distinct from old.status_changed_at
    or new.status_changed_by is distinct from old.status_changed_by
    or new.confirmed_at is distinct from old.confirmed_at
    or new.issued_at is distinct from old.issued_at
    or new.returned_at is distinct from old.returned_at
    or new.shortage_snapshot is distinct from old.shortage_snapshot then
    if current_setting('argo.transition_allowed', true) is distinct from 'true' then
      raise exception 'Reservation lifecycle fields are managed by transition_equipment_list_status()';
    end if;
  end if;

  if new.created_by is distinct from old.created_by then
    raise exception 'created_by cannot be changed';
  end if;

  if new.reservation_status is distinct from old.reservation_status
    and current_setting('argo.transition_allowed', true) is distinct from 'true' then
    raise exception 'Use transition_equipment_list_status() to change reservation status';
  end if;

  if old.reservation_status <> 'draft'
    and (
      new.reservation_start is distinct from old.reservation_start
      or new.reservation_end is distinct from old.reservation_end
      or new.equipment_ids is distinct from old.equipment_ids
      or new.equipment_items is distinct from old.equipment_items
      or new.list_mode is distinct from old.list_mode
    ) then
    raise exception 'Confirmed reservation contents and dates are immutable';
  end if;
  return new;
end;
$function$;

-- Журналирование движения склада. Тип движения берёт из argo.movement_type,
-- если его выставил переход статуса, иначе выводит из самих изменений.
create or replace function private.log_equipment_change()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  movement_kind text;
  movement_list_id uuid;
  movement_note text;
begin
  if tg_op = 'INSERT' then
    insert into public.equipment_movements (
      equipment_id, movement_type, quantity_delta, quantity_before, quantity_after,
      status_before, status_after, changed_by
    ) values (
      new.id, 'created', coalesce(new.count, 0), null, new.count,
      null, new.availability, (select auth.uid())
    );
    return new;
  end if;

  if new.count is not distinct from old.count
    and new.availability is not distinct from old.availability then
    return new;
  end if;

  movement_kind := nullif(current_setting('argo.movement_type', true), '');
  if movement_kind is null or movement_kind not in ('issued', 'returned') then
    movement_kind := case
      when new.count is distinct from old.count
        and new.availability is distinct from old.availability
        then 'quantity_and_status_changed'
      when new.count is distinct from old.count then 'quantity_changed'
      else 'status_changed'
    end;
  end if;

  begin
    movement_list_id := nullif(current_setting('argo.list_id', true), '')::uuid;
  exception when invalid_text_representation then
    movement_list_id := null;
  end;
  movement_note := nullif(current_setting('argo.transition_note', true), '');

  insert into public.equipment_movements (
    equipment_id, list_id, movement_type, quantity_delta,
    quantity_before, quantity_after, status_before, status_after,
    note, changed_by
  ) values (
    new.id, movement_list_id, movement_kind, coalesce(new.count, 0) - coalesce(old.count, 0),
    old.count, new.count, old.availability, new.availability,
    movement_note, (select auth.uid())
  );
  return new;
end;
$function$;

create or replace function private.log_reservation_status_change()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  if tg_op = 'INSERT' then
    insert into public.reservation_status_history (
      list_id, from_status, to_status, note, shortage_snapshot, changed_by
    ) values (
      new.id, null, new.reservation_status, 'Создан черновик',
      coalesce(new.shortage_snapshot, '[]'::jsonb), (select auth.uid())
    );
    return new;
  end if;

  if new.reservation_status is not distinct from old.reservation_status then
    return new;
  end if;

  insert into public.reservation_status_history (
    list_id, from_status, to_status, note, shortage_snapshot, changed_by
  ) values (
    new.id,
    old.reservation_status,
    new.reservation_status,
    nullif(current_setting('argo.transition_note', true), ''),
    coalesce(new.shortage_snapshot, '[]'::jsonb),
    (select auth.uid())
  );
  return new;
end;
$function$;

-- -----------------------------------------------------------------------------
-- 5. Функции схемы public
--
-- Все RPC — SECURITY INVOKER (definer нет ни у одной): они выполняются от имени
-- вызывающего, значит RLS-политики разделов 6–7 действуют и внутри них.
-- -----------------------------------------------------------------------------

create or replace function public.update_updated_at_column()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;

create or replace function public.update_equipment_lists_updated_at()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

create or replace function public.update_mount_points_count()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
declare
  affected_event_id uuid;
begin
  affected_event_id := coalesce(new.event_id, old.event_id);
  update public.events
  set mount_points_count = (
    select count(*) from public.mount_points where event_id = affected_event_id
  )
  where id = affected_event_id;
  return coalesce(new, old);
end;
$function$;

create or replace function public.validate_technical_duties_status()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
DECLARE
  duty jsonb;
BEGIN
  IF NEW.technical_duties IS NOT NULL THEN
    FOR duty IN SELECT * FROM jsonb_array_elements(NEW.technical_duties)
    LOOP
      IF duty->>'status' IS NULL OR duty->>'status' NOT IN ('в работе', 'выполнено', 'проблема') THEN
        RAISE EXCEPTION 'Недопустимый статус технического задания: %', duty->>'status';
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$function$;

-- Расчёт дефицита по списку.
-- ВНИМАНИЕ: склад джойнится по НОРМАЛИЗОВАННОМУ ТЕКСТУ brand/model/type/subtype,
-- а не по equipment_id. Позиция, чей текст разошёлся со складом хоть пробелом,
-- получит capacity = 0 и фантомную нехватку. Это следствие того, что RPC
-- сохраняет brand/model из клиентского JSON — открытая дыра, см. backlog.md.
create or replace function public.reservation_shortages(p_list_id uuid)
 returns table(brand text, model text, type text, subtype text, requested integer,
               capacity integer, reserved integer, available integer,
               specific_conflicts integer, shortage integer)
 language sql
 stable
 set search_path to ''
as $function$
  with target_list as (
    select id, reservation_start, reservation_end
    from public.equipment_lists
    where id = p_list_id
  ),
  target_groups as (
    select
      min(i.brand) as brand,
      min(i.model) as model,
      min(i.type) as type,
      min(i.subtype) as subtype,
      lower(btrim(i.brand)) as brand_key,
      lower(btrim(i.model)) as model_key,
      lower(btrim(i.type)) as type_key,
      lower(btrim(i.subtype)) as subtype_key,
      sum(i.requested_count)::integer as requested
    from public.equipment_reservation_items i
    where i.list_id = p_list_id
    group by
      lower(btrim(i.brand)), lower(btrim(i.model)),
      lower(btrim(i.type)), lower(btrim(i.subtype))
  ),
  inventory as (
    select
      lower(btrim(e.brand)) as brand_key,
      lower(btrim(e.model)) as model_key,
      lower(btrim(e.type)) as type_key,
      lower(btrim(e.subtype)) as subtype_key,
      sum(case when e.availability = 'available' then greatest(e.count, 0) else 0 end)::integer as capacity
    from public.equipment e
    group by
      lower(btrim(e.brand)), lower(btrim(e.model)),
      lower(btrim(e.type)), lower(btrim(e.subtype))
  ),
  other_reservations as (
    select
      lower(btrim(i.brand)) as brand_key,
      lower(btrim(i.model)) as model_key,
      lower(btrim(i.type)) as type_key,
      lower(btrim(i.subtype)) as subtype_key,
      sum(i.requested_count)::integer as reserved
    from public.equipment_reservation_items i
    join public.equipment_lists l on l.id = i.list_id
    cross join target_list t
    where l.id <> p_list_id
      and l.reservation_status = 'confirmed'
      and l.reservation_start is not null
      and l.reservation_end is not null
      and t.reservation_start is not null
      and t.reservation_end is not null
      and daterange(l.reservation_start, l.reservation_end, '[]')
        && daterange(t.reservation_start, t.reservation_end, '[]')
    group by
      lower(btrim(i.brand)), lower(btrim(i.model)),
      lower(btrim(i.type)), lower(btrim(i.subtype))
  ),
  conflicts as (
    select
      lower(btrim(i.brand)) as brand_key,
      lower(btrim(i.model)) as model_key,
      lower(btrim(i.type)) as type_key,
      lower(btrim(i.subtype)) as subtype_key,
      count(*)::integer as conflicts
    from public.equipment_reservation_items i
    join public.equipment e on e.id = i.equipment_id
    cross join target_list t
    where i.list_id = p_list_id
      and i.tracking_mode = 'serialized'
      and (
        e.availability <> 'available'
        or exists (
          select 1
          from public.equipment_reservation_items oi
          join public.equipment_lists ol on ol.id = oi.list_id
          where oi.equipment_id = i.equipment_id
            and oi.list_id <> p_list_id
            and ol.reservation_status = 'confirmed'
            and ol.reservation_start is not null
            and ol.reservation_end is not null
            and t.reservation_start is not null
            and t.reservation_end is not null
            and daterange(ol.reservation_start, ol.reservation_end, '[]')
              && daterange(t.reservation_start, t.reservation_end, '[]')
        )
      )
    group by
      lower(btrim(i.brand)), lower(btrim(i.model)),
      lower(btrim(i.type)), lower(btrim(i.subtype))
  )
  select
    g.brand,
    g.model,
    g.type,
    g.subtype,
    g.requested,
    coalesce(inv.capacity, 0)::integer as capacity,
    coalesce(r.reserved, 0)::integer as reserved,
    greatest(0, coalesce(inv.capacity, 0) - coalesce(r.reserved, 0))::integer as available,
    coalesce(c.conflicts, 0)::integer as specific_conflicts,
    greatest(
      0,
      g.requested - greatest(0, coalesce(inv.capacity, 0) - coalesce(r.reserved, 0)),
      coalesce(c.conflicts, 0)
    )::integer as shortage
  from target_groups g
  left join inventory inv using (brand_key, model_key, type_key, subtype_key)
  left join other_reservations r using (brand_key, model_key, type_key, subtype_key)
  left join conflicts c using (brand_key, model_key, type_key, subtype_key)
  order by g.type, g.brand, g.model;
$function$;

-- Создание списка со составом. Проверяет членство, имя, режим, парность дат,
-- непустоту состава и СУЩЕСТВОВАНИЕ equipment_id — но не сверяет brand/model
-- с реальной позицией и не сверяет requested_count с остатком.
create or replace function public.create_equipment_list_with_items(
  p_name text, p_description text, p_list_mode text,
  p_reservation_start date, p_reservation_end date, p_items jsonb)
 returns uuid
 language plpgsql
 set search_path to ''
as $function$
declare
  new_list_id uuid;
  legacy_ids uuid[];
  legacy_items jsonb;
begin
  if not (select private.is_app_member()) then
    raise exception 'Not an application member';
  end if;
  if nullif(btrim(p_name), '') is null then
    raise exception 'List name is required';
  end if;
  if p_list_mode not in ('specific', 'abstract') then
    raise exception 'Invalid list mode';
  end if;
  if (p_reservation_start is null) <> (p_reservation_end is null)
    or (p_reservation_start is not null and p_reservation_start > p_reservation_end) then
    raise exception 'Reservation dates must be both empty or form a valid range';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'At least one equipment item is required';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_items) item
    where coalesce(item->>'tracking_mode', '') in ('serialized', 'quantity')
      and (
        coalesce(item->>'equipment_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        or not exists (
          select 1 from public.equipment e where e.id = (item->>'equipment_id')::uuid
        )
      )
  ) then
    raise exception 'Serialized and quantity items require an existing equipment_id';
  end if;

  select coalesce(array_agg((item->>'equipment_id')::uuid), '{}'::uuid[])
  into legacy_ids
  from jsonb_array_elements(p_items) item
  where item->>'tracking_mode' = 'serialized';

  select coalesce(jsonb_agg(jsonb_build_object(
    'equipment_id', nullif(item->>'equipment_id', ''),
    'brand', item->>'brand',
    'model', item->>'model',
    'type', item->>'type',
    'subtype', item->>'subtype',
    'count', greatest(1, coalesce((item->>'count')::integer, 1)),
    'tracking_mode', item->>'tracking_mode'
  )), '[]'::jsonb)
  into legacy_items
  from jsonb_array_elements(p_items) item
  where item->>'tracking_mode' <> 'serialized';

  insert into public.equipment_lists (
    name, description, type, list_mode, equipment_ids, equipment_items,
    created_by, is_archived, metadata, reservation_status,
    reservation_start, reservation_end, status_changed_by
  ) values (
    btrim(p_name), nullif(btrim(p_description), ''), 'custom', p_list_mode,
    legacy_ids, legacy_items, (select auth.uid()), false,
    jsonb_build_object('source', 'argo-warehouse-react'), 'draft',
    p_reservation_start, p_reservation_end, (select auth.uid())
  ) returning id into new_list_id;

  insert into public.equipment_reservation_items (
    list_id, equipment_id, brand, model, type, subtype,
    tracking_mode, requested_count, created_by
  )
  select
    new_list_id,
    case when coalesce(item->>'equipment_id', '') ~* '^[0-9a-f-]{36}$'
      then (item->>'equipment_id')::uuid else null end,
    btrim(item->>'brand'),
    btrim(item->>'model'),
    btrim(item->>'type'),
    btrim(item->>'subtype'),
    item->>'tracking_mode',
    greatest(1, coalesce((item->>'count')::integer, 1)),
    (select auth.uid())
  from jsonb_array_elements(p_items) item;

  return new_list_id;
end;
$function$;

-- Обёртка над предыдущей: добавляет реквизиты документа (заказчик, площадка).
create or replace function public.create_equipment_list_document(
  p_name text, p_description text, p_client_name text, p_venue text,
  p_list_mode text, p_reservation_start date, p_reservation_end date, p_items jsonb)
 returns uuid
 language plpgsql
 set search_path to ''
as $function$
declare
  new_list_id uuid;
begin
  new_list_id := public.create_equipment_list_with_items(
    p_name,
    p_description,
    p_list_mode,
    p_reservation_start,
    p_reservation_end,
    p_items
  );

  update public.equipment_lists
  set
    client_name = nullif(btrim(p_client_name), ''),
    venue = nullif(btrim(p_venue), '')
  where id = new_list_id;

  if not found then
    raise exception 'Created equipment list could not be updated';
  end if;

  return new_list_id;
end;
$function$;

-- Редактирование сохранённого списка. Разрешено только в статусе draft;
-- состав пересобирается полностью (delete + insert).
create or replace function public.update_equipment_list_document(
  p_list_id uuid, p_name text, p_description text, p_client_name text, p_venue text,
  p_list_mode text, p_reservation_start date, p_reservation_end date, p_items jsonb)
 returns uuid
 language plpgsql
 set search_path to ''
as $function$
declare
  current_status text;
  legacy_ids uuid[];
  legacy_items jsonb;
begin
  if not (select private.is_app_member()) then
    raise exception 'Not an application member';
  end if;

  select reservation_status
  into current_status
  from public.equipment_lists
  where id = p_list_id
  for update;

  if not found then
    raise exception 'Equipment list not found';
  end if;
  if current_status <> 'draft' then
    raise exception 'Only draft equipment lists can be edited';
  end if;
  if nullif(btrim(p_name), '') is null then
    raise exception 'List name is required';
  end if;
  if p_list_mode not in ('specific', 'abstract') then
    raise exception 'Invalid list mode';
  end if;
  if (p_reservation_start is null) <> (p_reservation_end is null)
    or (p_reservation_start is not null and p_reservation_start > p_reservation_end) then
    raise exception 'Reservation dates must be both empty or form a valid range';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'At least one equipment item is required';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_items) item
    where coalesce(item->>'tracking_mode', '') in ('serialized', 'quantity')
      and (
        coalesce(item->>'equipment_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        or not exists (
          select 1 from public.equipment e where e.id = (item->>'equipment_id')::uuid
        )
      )
  ) then
    raise exception 'Serialized and quantity items require an existing equipment_id';
  end if;

  select coalesce(array_agg((item->>'equipment_id')::uuid), '{}'::uuid[])
  into legacy_ids
  from jsonb_array_elements(p_items) item
  where item->>'tracking_mode' = 'serialized';

  select coalesce(jsonb_agg(jsonb_build_object(
    'equipment_id', nullif(item->>'equipment_id', ''),
    'brand', item->>'brand',
    'model', item->>'model',
    'type', item->>'type',
    'subtype', item->>'subtype',
    'count', greatest(1, coalesce((item->>'count')::integer, 1)),
    'tracking_mode', item->>'tracking_mode'
  )), '[]'::jsonb)
  into legacy_items
  from jsonb_array_elements(p_items) item
  where item->>'tracking_mode' <> 'serialized';

  update public.equipment_lists
  set
    name = btrim(p_name),
    description = nullif(btrim(p_description), ''),
    client_name = nullif(btrim(p_client_name), ''),
    venue = nullif(btrim(p_venue), ''),
    list_mode = p_list_mode,
    equipment_ids = legacy_ids,
    equipment_items = legacy_items,
    reservation_start = p_reservation_start,
    reservation_end = p_reservation_end
  where id = p_list_id;

  delete from public.equipment_reservation_items
  where list_id = p_list_id;

  insert into public.equipment_reservation_items (
    list_id, equipment_id, brand, model, type, subtype,
    tracking_mode, requested_count, created_by
  )
  select
    p_list_id,
    case when coalesce(item->>'equipment_id', '') ~* '^[0-9a-f-]{36}$'
      then (item->>'equipment_id')::uuid else null end,
    btrim(item->>'brand'),
    btrim(item->>'model'),
    btrim(item->>'type'),
    btrim(item->>'subtype'),
    item->>'tracking_mode',
    greatest(1, coalesce((item->>'count')::integer, 1)),
    (select auth.uid())
  from jsonb_array_elements(p_items) item;

  return p_list_id;
end;
$function$;

-- Единственный законный способ сменить статус списка. Разрешает только
-- draft → confirmed → issued → returned, физически двигает склад на выдаче
-- и возврате и снимает блокировки строк оборудования через FOR UPDATE.
create or replace function public.transition_equipment_list_status(
  p_list_id uuid, p_target_status text, p_note text default null::text)
 returns jsonb
 language plpgsql
 set search_path to ''
as $function$
declare
  current_list public.equipment_lists%rowtype;
  shortages jsonb := '[]'::jsonb;
begin
  if not (select private.is_app_member()) then
    raise exception 'Not an application member';
  end if;

  select * into current_list
  from public.equipment_lists
  where id = p_list_id
  for update;
  if not found then raise exception 'Equipment list not found'; end if;

  if not (
    (current_list.reservation_status = 'draft' and p_target_status = 'confirmed')
    or (current_list.reservation_status = 'confirmed' and p_target_status = 'issued')
    or (current_list.reservation_status = 'issued' and p_target_status = 'returned')
  ) then
    raise exception 'Invalid reservation transition: % -> %', current_list.reservation_status, p_target_status;
  end if;

  if p_target_status = 'confirmed' then
    if current_list.reservation_start is null or current_list.reservation_end is null then
      raise exception 'Reservation dates are required before confirmation';
    end if;
    select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb)
    into shortages
    from public.reservation_shortages(p_list_id) s
    where s.shortage > 0;

    perform set_config('argo.transition_allowed', 'true', true);
    perform set_config('argo.transition_note', coalesce(p_note, ''), true);
    update public.equipment_lists
    set reservation_status = 'confirmed', confirmed_at = now(),
        status_changed_at = now(), status_changed_by = (select auth.uid()),
        shortage_snapshot = shortages
    where id = p_list_id;

  elsif p_target_status = 'issued' then
    if current_list.list_mode <> 'specific' then
      raise exception 'A model plan must be converted to a specific list before issue';
    end if;
    if exists (
      select 1 from public.equipment_reservation_items i
      where i.list_id = p_list_id and i.tracking_mode = 'planned'
    ) then
      raise exception 'All planned model quantities must be assigned before issue';
    end if;
    perform e.id
    from public.equipment e
    join public.equipment_reservation_items i on i.equipment_id = e.id
    where i.list_id = p_list_id
    order by e.id
    for update of e;

    if exists (
      select 1
      from public.equipment_reservation_items i
      join public.equipment e on e.id = i.equipment_id
      where i.list_id = p_list_id
        and (
          (i.tracking_mode = 'serialized' and e.availability <> 'available')
          or (i.tracking_mode = 'quantity'
            and (e.availability <> 'available' or e.count < i.requested_count))
        )
    ) then
      raise exception 'Some equipment is no longer physically available';
    end if;

    perform set_config('argo.movement_type', 'issued', true);
    perform set_config('argo.list_id', p_list_id::text, true);
    perform set_config('argo.transition_note', coalesce(p_note, ''), true);
    update public.equipment e
    set availability = 'issued'
    from public.equipment_reservation_items i
    where i.list_id = p_list_id
      and i.equipment_id = e.id
      and i.tracking_mode = 'serialized';
    update public.equipment e
    set count = e.count - i.requested_count,
        availability = case when e.count - i.requested_count = 0 then 'unavailable' else 'available' end
    from public.equipment_reservation_items i
    where i.list_id = p_list_id
      and i.equipment_id = e.id
      and i.tracking_mode = 'quantity';

    perform set_config('argo.transition_allowed', 'true', true);
    update public.equipment_lists
    set reservation_status = 'issued', issued_at = now(),
        status_changed_at = now(), status_changed_by = (select auth.uid()),
        shortage_snapshot = '[]'::jsonb
    where id = p_list_id;

  elsif p_target_status = 'returned' then
    perform e.id
    from public.equipment e
    join public.equipment_reservation_items i on i.equipment_id = e.id
    where i.list_id = p_list_id
    order by e.id
    for update of e;

    perform set_config('argo.movement_type', 'returned', true);
    perform set_config('argo.list_id', p_list_id::text, true);
    perform set_config('argo.transition_note', coalesce(p_note, ''), true);
    update public.equipment e
    set availability = 'available'
    from public.equipment_reservation_items i
    where i.list_id = p_list_id
      and i.equipment_id = e.id
      and i.tracking_mode = 'serialized';
    update public.equipment e
    set count = e.count + i.requested_count,
        availability = 'available'
    from public.equipment_reservation_items i
    where i.list_id = p_list_id
      and i.equipment_id = e.id
      and i.tracking_mode = 'quantity';

    perform set_config('argo.transition_allowed', 'true', true);
    update public.equipment_lists
    set reservation_status = 'returned', returned_at = now(),
        status_changed_at = now(), status_changed_by = (select auth.uid()),
        shortage_snapshot = '[]'::jsonb
    where id = p_list_id;
  end if;

  perform set_config('argo.transition_allowed', '', true);
  perform set_config('argo.movement_type', '', true);
  perform set_config('argo.list_id', '', true);
  perform set_config('argo.transition_note', '', true);

  return jsonb_build_object(
    'id', p_list_id,
    'status', p_target_status,
    'shortages', shortages
  );
end;
$function$;

-- Правка модели целиком: описательные поля разъезжаются по ВСЕМ единицам той же
-- пары бренд+модель, а статус, размещение и количество — только по выбранной.
create or replace function public.update_equipment_model_and_unit(
  p_equipment_id uuid, p_brand text, p_model text, p_type text, p_subtype text,
  p_technicalspecification text, p_lengthinmeters text, p_description text,
  p_availability text, p_location text, p_count integer)
 returns jsonb
 language plpgsql
 set search_path to ''
as $function$
declare
  current_brand text;
  current_model text;
  updated_units integer;
begin
  if not (select private.has_any_role(array['technician', 'manager', 'admin'])) then
    raise exception 'Only the inventory team can edit equipment';
  end if;

  select e.brand, e.model
  into current_brand, current_model
  from public.equipment e
  where e.id = p_equipment_id;

  if not found then
    raise exception 'Equipment was not found';
  end if;

  if nullif(btrim(p_brand), '') is null
    or nullif(btrim(p_model), '') is null
    or nullif(btrim(p_type), '') is null
    or nullif(btrim(p_subtype), '') is null then
    raise exception 'Brand, model, category and subcategory are required';
  end if;

  if p_availability not in ('available', 'unavailable', 'diagnostics', 'issued') then
    raise exception 'Unsupported equipment status';
  end if;

  if p_count < 0 then
    raise exception 'Equipment count cannot be negative';
  end if;

  update public.equipment e
  set
    brand = btrim(p_brand),
    model = btrim(p_model),
    type = btrim(p_type),
    subtype = btrim(p_subtype),
    technicalspecification = nullif(btrim(p_technicalspecification), ''),
    lengthinmeters = coalesce(nullif(btrim(p_lengthinmeters), ''), 'N/A'),
    description = nullif(btrim(p_description), ''),
    updated_at = now()
  where lower(btrim(e.brand)) = lower(btrim(current_brand))
    and lower(btrim(e.model)) = lower(btrim(current_model));

  get diagnostics updated_units = row_count;

  update public.equipment e
  set
    availability = p_availability,
    location = nullif(btrim(p_location), ''),
    count = p_count,
    updated_at = now()
  where e.id = p_equipment_id;

  return jsonb_build_object(
    'equipment_id', p_equipment_id,
    'updated_model_units', updated_units
  );
end;
$function$;

-- -----------------------------------------------------------------------------
-- 6. Триггеры
--
-- ВНИМАНИЕ: на mount_points висят ЧЕТЫРЕ триггера пересчёта, три из которых
-- (mount_point_insert / update / delete) полностью перекрываются четвёртым
-- (trg_mount_points_count). Воспроизведено как в проде; долг в backlog.md.
-- -----------------------------------------------------------------------------

drop trigger if exists update_equipment_updated_at on public.equipment;
create trigger update_equipment_updated_at
  before update on public.equipment
  for each row execute function public.update_updated_at_column();

drop trigger if exists trg_equipment_movement_history on public.equipment;
create trigger trg_equipment_movement_history
  after insert or update of count, availability on public.equipment
  for each row execute function private.log_equipment_change();

drop trigger if exists trigger_update_equipment_lists_updated_at on public.equipment_lists;
create trigger trigger_update_equipment_lists_updated_at
  before update on public.equipment_lists
  for each row execute function public.update_equipment_lists_updated_at();

drop trigger if exists trg_guard_reservation_list_update on public.equipment_lists;
create trigger trg_guard_reservation_list_update
  before update on public.equipment_lists
  for each row execute function private.guard_reservation_list_update();

drop trigger if exists trg_reservation_status_history on public.equipment_lists;
create trigger trg_reservation_status_history
  after insert or update on public.equipment_lists
  for each row execute function private.log_reservation_status_change();

drop trigger if exists mount_point_insert on public.mount_points;
create trigger mount_point_insert
  after insert on public.mount_points
  for each row execute function public.update_mount_points_count();

drop trigger if exists mount_point_update on public.mount_points;
create trigger mount_point_update
  after update of event_id on public.mount_points
  for each row execute function public.update_mount_points_count();

drop trigger if exists mount_point_delete on public.mount_points;
create trigger mount_point_delete
  after delete on public.mount_points
  for each row execute function public.update_mount_points_count();

drop trigger if exists trg_mount_points_count on public.mount_points;
create trigger trg_mount_points_count
  after insert or delete or update on public.mount_points
  for each row execute function public.update_mount_points_count();

drop trigger if exists trg_validate_technical_duties_status on public.mount_points;
create trigger trg_validate_technical_duties_status
  before insert or update on public.mount_points
  for each row execute function public.validate_technical_duties_status();

-- -----------------------------------------------------------------------------
-- 7. Права и RLS
--
-- Гранты идут ДО политик: RLS фильтрует строки только после того, как роль
-- получила право на таблицу. Нет гранта — нет доступа, и политика уже неважна.
--
-- КАНОН: у authenticated НЕТ НИ ОДНОГО ГРАНТА на public.users. Политики
-- users_* ниже воспроизведены как в проде, но фактически недостижимы: прочитать
-- таблицу из браузера нельзя. Роль пользователя приложение узнаёт только через
-- private.is_app_member() / private.has_any_role() (SECURITY DEFINER, раздел 4).
-- events, mount_points и reports закрыты так же — это наследие Vue-версии.
-- -----------------------------------------------------------------------------

alter table public.users enable row level security;
alter table public.equipment enable row level security;
alter table public.events enable row level security;
alter table public.mount_points enable row level security;
alter table public.reports enable row level security;
alter table public.equipment_lists enable row level security;
alter table public.equipment_reservation_items enable row level security;
alter table public.reservation_status_history enable row level security;
alter table public.equipment_movements enable row level security;

revoke all on public.users from anon, authenticated;
revoke all on public.events from anon, authenticated;
revoke all on public.mount_points from anon, authenticated;
revoke all on public.reports from anon, authenticated;

grant select, insert, update, delete on public.equipment to authenticated;
grant select, insert, update, delete on public.equipment_lists to authenticated;
grant select, insert, update, delete on public.equipment_reservation_items to authenticated;

-- Журналы только на чтение: их наполняют триггеры, а не клиент.
-- revoke обязателен: на чистой базе дефолтные привилегии Supabase выдали бы
-- authenticated полный набор прав на новую таблицу, и клиент смог бы писать историю.
revoke all on public.reservation_status_history from anon, authenticated;
revoke all on public.equipment_movements from anon, authenticated;
grant select on public.reservation_status_history to authenticated;
grant select on public.equipment_movements to authenticated;

grant execute on function public.reservation_shortages(uuid) to authenticated;
grant execute on function public.create_equipment_list_with_items(text, text, text, date, date, jsonb) to authenticated;
grant execute on function public.create_equipment_list_document(text, text, text, text, text, date, date, jsonb) to authenticated;
grant execute on function public.update_equipment_list_document(uuid, text, text, text, text, text, date, date, jsonb) to authenticated;
grant execute on function public.transition_equipment_list_status(uuid, text, text) to authenticated;
grant execute on function public.update_equipment_model_and_unit(uuid, text, text, text, text, text, text, text, text, text, integer) to authenticated;

-- users: политики воспроизведены ради полноты снимка, но без грантов не работают.
drop policy if exists users_select_for_members on public.users;
create policy users_select_for_members on public.users
  for select to authenticated
  using ((select private.is_app_member()));

drop policy if exists users_insert_for_admins on public.users;
create policy users_insert_for_admins on public.users
  for insert to authenticated
  with check ((select private.has_any_role(array['admin'])));

drop policy if exists users_update_for_admins on public.users;
create policy users_update_for_admins on public.users
  for update to authenticated
  using ((select private.has_any_role(array['admin'])))
  with check ((select private.has_any_role(array['admin'])));

drop policy if exists users_delete_for_admins on public.users;
create policy users_delete_for_admins on public.users
  for delete to authenticated
  using ((select private.has_any_role(array['admin'])));

-- equipment: смотрят все члены приложения, правит только инвентарная команда.
drop policy if exists equipment_select_for_members on public.equipment;
create policy equipment_select_for_members on public.equipment
  for select to authenticated
  using ((select private.is_app_member()));

drop policy if exists equipment_insert_for_inventory_team on public.equipment;
create policy equipment_insert_for_inventory_team on public.equipment
  for insert to authenticated
  with check ((select private.has_any_role(array['technician','manager','admin'])));

drop policy if exists equipment_update_for_inventory_team on public.equipment;
create policy equipment_update_for_inventory_team on public.equipment
  for update to authenticated
  using ((select private.has_any_role(array['technician','manager','admin'])))
  with check ((select private.has_any_role(array['technician','manager','admin'])));

drop policy if exists equipment_delete_for_admins on public.equipment;
create policy equipment_delete_for_admins on public.equipment
  for delete to authenticated
  using ((select private.has_any_role(array['admin'])));

-- events / mount_points / reports: политики Vue-версии, недостижимы без грантов.
drop policy if exists events_select_for_assigned_team on public.events;
create policy events_select_for_assigned_team on public.events
  for select to authenticated
  using (
    ((select auth.uid()) = any (responsible_engineers))
    or (select private.has_any_role(array['manager','admin']))
  );

drop policy if exists events_insert_for_assigned_team on public.events;
create policy events_insert_for_assigned_team on public.events
  for insert to authenticated
  with check (
    ((select auth.uid()) = any (responsible_engineers))
    or (select private.has_any_role(array['manager','admin']))
  );

drop policy if exists events_update_for_assigned_team on public.events;
create policy events_update_for_assigned_team on public.events
  for update to authenticated
  using (
    ((select auth.uid()) = any (responsible_engineers))
    or (select private.has_any_role(array['manager','admin']))
  )
  with check (
    ((select auth.uid()) = any (responsible_engineers))
    or (select private.has_any_role(array['manager','admin']))
  );

drop policy if exists events_delete_for_assigned_team on public.events;
create policy events_delete_for_assigned_team on public.events
  for delete to authenticated
  using (
    ((select auth.uid()) = any (responsible_engineers))
    or (select private.has_any_role(array['manager','admin']))
  );

drop policy if exists mount_points_select_by_event on public.mount_points;
create policy mount_points_select_by_event on public.mount_points
  for select to authenticated
  using (exists (select 1 from public.events e where e.id = mount_points.event_id));

drop policy if exists mount_points_insert_by_event on public.mount_points;
create policy mount_points_insert_by_event on public.mount_points
  for insert to authenticated
  with check (exists (select 1 from public.events e where e.id = mount_points.event_id));

drop policy if exists mount_points_update_by_event on public.mount_points;
create policy mount_points_update_by_event on public.mount_points
  for update to authenticated
  using (exists (select 1 from public.events e where e.id = mount_points.event_id))
  with check (exists (select 1 from public.events e where e.id = mount_points.event_id));

drop policy if exists mount_points_delete_by_event on public.mount_points;
create policy mount_points_delete_by_event on public.mount_points
  for delete to authenticated
  using (exists (select 1 from public.events e where e.id = mount_points.event_id));

drop policy if exists reports_select_by_event on public.reports;
create policy reports_select_by_event on public.reports
  for select to authenticated
  using (exists (select 1 from public.events e where e.id = reports.event_id));

drop policy if exists reports_insert_by_event on public.reports;
create policy reports_insert_by_event on public.reports
  for insert to authenticated
  with check (exists (select 1 from public.events e where e.id = reports.event_id));

drop policy if exists reports_update_by_event on public.reports;
create policy reports_update_by_event on public.reports
  for update to authenticated
  using (exists (select 1 from public.events e where e.id = reports.event_id))
  with check (exists (select 1 from public.events e where e.id = reports.event_id));

drop policy if exists reports_delete_by_event on public.reports;
create policy reports_delete_by_event on public.reports
  for delete to authenticated
  using (exists (select 1 from public.events e where e.id = reports.event_id));

-- equipment_lists: видят и правят все члены приложения, включая чужие списки.
-- Вставлять можно только собственный черновик с пустыми датами этапов;
-- всё остальное держит триггер trg_guard_reservation_list_update.
drop policy if exists equipment_lists_select_for_members on public.equipment_lists;
create policy equipment_lists_select_for_members on public.equipment_lists
  for select to authenticated
  using ((select private.is_app_member()));

drop policy if exists equipment_lists_insert_for_members on public.equipment_lists;
create policy equipment_lists_insert_for_members on public.equipment_lists
  for insert to authenticated
  with check (
    (select private.is_app_member())
    and created_by = (select auth.uid())
    and reservation_status = 'draft'
    and confirmed_at is null
    and issued_at is null
    and returned_at is null
  );

drop policy if exists equipment_lists_update_for_members on public.equipment_lists;
create policy equipment_lists_update_for_members on public.equipment_lists
  for update to authenticated
  using ((select private.is_app_member()))
  with check ((select private.is_app_member()));

-- Удаление списка захардкожено на один почтовый адрес. Это НЕ роль и не
-- членство: смена почты владельца отберёт право. Долг записан в backlog.md.
drop policy if exists equipment_lists_delete_for_default_account on public.equipment_lists;
create policy equipment_lists_delete_for_default_account on public.equipment_lists
  for delete to authenticated
  using (
    (select private.is_app_member())
    and ((select auth.jwt()) ->> 'email') = 'argo@argomedia.uz'
  );

-- Состав списка правится только пока список в черновике.
drop policy if exists reservation_items_select_for_members on public.equipment_reservation_items;
create policy reservation_items_select_for_members on public.equipment_reservation_items
  for select to authenticated
  using ((select private.is_app_member()));

drop policy if exists reservation_items_insert_for_drafts on public.equipment_reservation_items;
create policy reservation_items_insert_for_drafts on public.equipment_reservation_items
  for insert to authenticated
  with check (
    (select private.is_app_member())
    and created_by = (select auth.uid())
    and exists (
      select 1 from public.equipment_lists l
      where l.id = equipment_reservation_items.list_id
        and l.reservation_status = 'draft'
    )
  );

drop policy if exists reservation_items_update_for_drafts on public.equipment_reservation_items;
create policy reservation_items_update_for_drafts on public.equipment_reservation_items
  for update to authenticated
  using (
    (select private.is_app_member())
    and exists (
      select 1 from public.equipment_lists l
      where l.id = equipment_reservation_items.list_id
        and l.reservation_status = 'draft'
    )
  )
  with check (
    (select private.is_app_member())
    and exists (
      select 1 from public.equipment_lists l
      where l.id = equipment_reservation_items.list_id
        and l.reservation_status = 'draft'
    )
  );

drop policy if exists reservation_items_delete_for_drafts on public.equipment_reservation_items;
create policy reservation_items_delete_for_drafts on public.equipment_reservation_items
  for delete to authenticated
  using (
    (select private.is_app_member())
    and exists (
      select 1 from public.equipment_lists l
      where l.id = equipment_reservation_items.list_id
        and l.reservation_status = 'draft'
    )
  );

-- Журналы: одна политика на чтение, политик записи нет намеренно.
drop policy if exists reservation_history_select_for_members on public.reservation_status_history;
create policy reservation_history_select_for_members on public.reservation_status_history
  for select to authenticated
  using ((select private.is_app_member()));

drop policy if exists equipment_movements_select_for_members on public.equipment_movements;
create policy equipment_movements_select_for_members on public.equipment_movements
  for select to authenticated
  using ((select private.is_app_member()));
