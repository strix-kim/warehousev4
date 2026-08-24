-- Распределение по залам (с20): план мероприятия → залы → позиции с сотрудником.
-- Своя сущность плана, без FK на equipment_lists: залы расставляют до того, как
-- собран список оборудования, и живут они по разным календарям.

create table if not exists public.hall_plans (
  id uuid primary key default gen_random_uuid(),

  name text not null check (btrim(name) <> ''),

  -- Даты необязательны: план часто заводят раньше, чем известны числа.
  -- Открытый конец легален (event_to null), обратный порядок — нет.
  event_from date,
  event_to date,

  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint hall_plans_dates_check check (
    (event_from is null and event_to is null)
    or (event_from is not null and (event_to is null or event_to >= event_from))
  )
);

comment on table public.hall_plans is
  'Планы распределения по залам: шапка мероприятия; залы — halls, позиции — hall_positions.';

-- Зал плана. Цвет хранится готовым к подстановке в CSS, в нижнем регистре —
-- клиент сравнивает его со своей палитрой строкой, а не парсит.
-- sort_order без UNIQUE: перестановка стрелками меняет два числа местами,
-- уникальность превратила бы обмен в трёхшаговый танец.
create table if not exists public.halls (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.hall_plans(id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  color text not null check (color ~ '^#[0-9a-f]{6}$'),
  sort_order integer not null default 0,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),

  -- Ключ-мишень для составного FK из hall_positions: он и держит позицию
  -- в границах своего плана (см. hall_positions_hall_fkey).
  constraint halls_id_plan_id_key unique (id, plan_id)
);

create index if not exists halls_plan_id_idx on public.halls (plan_id);

-- Позиция в зале: «Камера 1», роль, один сотрудник. Отдельной таблицы назначений
-- нет — одна позиция это ровно один человек, поэтому employee_id колонкой.
-- Один и тот же сотрудник МОЖЕТ стоять в нескольких залах одного плана
-- (решение прораба, с20): руководитель ведёт все залы сразу — UNIQUE не заводим.
create table if not exists public.hall_positions (
  id uuid primary key default gen_random_uuid(),
  hall_id uuid not null,
  plan_id uuid not null,
  name text not null check (btrim(name) <> ''),
  role text not null default 'technician'
    check (role in ('technician', 'operator', 'other')),
  sort_order integer not null default 0,
  -- Сотрудника удалили — позиция остаётся вакантной, а не исчезает вместе с планом.
  employee_id uuid references public.employees(id) on delete set null,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),

  -- Составной FK: plan_id позиции обязан совпадать с plan_id её зала.
  -- Подмена plan_id в обход интерфейса даст 23503, а не осиротевшую строку.
  constraint hall_positions_hall_fkey
    foreign key (hall_id, plan_id) references public.halls(id, plan_id)
    on delete cascade
);

create index if not exists hall_positions_hall_id_idx
  on public.hall_positions (hall_id);
create index if not exists hall_positions_plan_id_idx
  on public.hall_positions (plan_id);
create index if not exists hall_positions_employee_id_idx
  on public.hall_positions (employee_id);

-- Нормализация при записи: база авторитетна, клиентский trim — только UX.
-- Имя у залов и позиций устроено одинаково, поэтому функция одна на обе таблицы.
create or replace function public.normalize_hall_name()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.name := btrim(new.name);
  return new;
end;
$$;

revoke all on function public.normalize_hall_name() from public, anon;

drop trigger if exists trg_normalize_hall_name on public.halls;
create trigger trg_normalize_hall_name
  before insert or update on public.halls
  for each row execute function public.normalize_hall_name();

drop trigger if exists trg_normalize_hall_name on public.hall_positions;
create trigger trg_normalize_hall_name
  before insert or update on public.hall_positions
  for each row execute function public.normalize_hall_name();

-- «Изменён hh:mm» на карточке плана должен реагировать на правку любой позиции,
-- поэтому updated_at плана двигает база, а не клиент: у залов и позиций своего
-- updated_at нет. Функция security invoker — пишущему нужен UPDATE на hall_plans
-- (грант и политика ниже это дают).
create or replace function public.touch_hall_plan()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.hall_plans
    set updated_at = now()
    where id = coalesce(new.plan_id, old.plan_id);
  return null;
end;
$$;

revoke all on function public.touch_hall_plan() from public, anon;

drop trigger if exists trg_touch_hall_plan on public.halls;
create trigger trg_touch_hall_plan
  after insert or update or delete on public.halls
  for each row execute function public.touch_hall_plan();

drop trigger if exists trg_touch_hall_plan on public.hall_positions;
create trigger trg_touch_hall_plan
  after insert or update or delete on public.hall_positions
  for each row execute function public.touch_hall_plan();

-- updated_at самого плана — существующим общим триггером проекта.
drop trigger if exists update_hall_plans_updated_at on public.hall_plans;
create trigger update_hall_plans_updated_at
  before update on public.hall_plans
  for each row execute function public.update_updated_at_column();

-- RLS: читает член приложения, пишет technician/manager/admin.
-- Отход от канона с17/с18, названный вслух в плане и подтверждённый прорабом:
-- DELETE получает staff на всех трёх таблицах, включая сам план. План — рабочая
-- расстановка на одно мероприятие, а не персональные данные; отдавать удаление
-- отсутствующему в проде admin значило бы оставить мусор навсегда.
alter table public.hall_plans enable row level security;
alter table public.halls enable row level security;
alter table public.hall_positions enable row level security;

drop policy if exists hall_plans_select_for_members on public.hall_plans;
create policy hall_plans_select_for_members on public.hall_plans
  for select to authenticated
  using (private.is_app_member());

drop policy if exists hall_plans_insert_for_staff on public.hall_plans;
create policy hall_plans_insert_for_staff on public.hall_plans
  for insert to authenticated
  with check (
    private.has_any_role(array['technician', 'manager', 'admin'])
    and created_by = auth.uid()
  );

drop policy if exists hall_plans_update_for_staff on public.hall_plans;
create policy hall_plans_update_for_staff on public.hall_plans
  for update to authenticated
  using (private.has_any_role(array['technician', 'manager', 'admin']))
  with check (private.has_any_role(array['technician', 'manager', 'admin']));

drop policy if exists hall_plans_delete_for_staff on public.hall_plans;
create policy hall_plans_delete_for_staff on public.hall_plans
  for delete to authenticated
  using (private.has_any_role(array['technician', 'manager', 'admin']));

drop policy if exists halls_select_for_members on public.halls;
create policy halls_select_for_members on public.halls
  for select to authenticated
  using (private.is_app_member());

drop policy if exists halls_insert_for_staff on public.halls;
create policy halls_insert_for_staff on public.halls
  for insert to authenticated
  with check (
    private.has_any_role(array['technician', 'manager', 'admin'])
    and created_by = auth.uid()
  );

drop policy if exists halls_update_for_staff on public.halls;
create policy halls_update_for_staff on public.halls
  for update to authenticated
  using (private.has_any_role(array['technician', 'manager', 'admin']))
  with check (private.has_any_role(array['technician', 'manager', 'admin']));

drop policy if exists halls_delete_for_staff on public.halls;
create policy halls_delete_for_staff on public.halls
  for delete to authenticated
  using (private.has_any_role(array['technician', 'manager', 'admin']));

drop policy if exists hall_positions_select_for_members on public.hall_positions;
create policy hall_positions_select_for_members on public.hall_positions
  for select to authenticated
  using (private.is_app_member());

drop policy if exists hall_positions_insert_for_staff on public.hall_positions;
create policy hall_positions_insert_for_staff on public.hall_positions
  for insert to authenticated
  with check (
    private.has_any_role(array['technician', 'manager', 'admin'])
    and created_by = auth.uid()
  );

drop policy if exists hall_positions_update_for_staff on public.hall_positions;
create policy hall_positions_update_for_staff on public.hall_positions
  for update to authenticated
  using (private.has_any_role(array['technician', 'manager', 'admin']))
  with check (private.has_any_role(array['technician', 'manager', 'admin']));

drop policy if exists hall_positions_delete_for_staff on public.hall_positions;
create policy hall_positions_delete_for_staff on public.hall_positions
  for delete to authenticated
  using (private.has_any_role(array['technician', 'manager', 'admin']));

-- Гранты: default privileges Supabase раздают полный CRUD — пересобираем явно.
-- DELETE здесь выдан осознанно (см. блок RLS выше).
revoke all on table public.hall_plans from public, anon, authenticated;
grant select, insert, update, delete on table public.hall_plans to authenticated;

revoke all on table public.halls from public, anon, authenticated;
grant select, insert, update, delete on table public.halls to authenticated;

revoke all on table public.hall_positions from public, anon, authenticated;
grant select, insert, update, delete on table public.hall_positions to authenticated;

notify pgrst, 'reload schema';
