-- Автомобили: карточка + водители + файлы (с18).
-- База существует ради пропусков на локации, поэтому единственный жёсткий
-- идентификатор — госномер; марка обязательна как минимальное человеческое имя
-- машины. Остальное (модель, цвет, водители, фото) добивается постепенно.

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),

  brand text not null check (brand <> ''),
  model text,
  color text,
  -- Хранится в человеческом виде («01 439 SNA»): на экспортных списках номер
  -- должен читаться как на жестянке. Канон — триггером ниже; уникальность
  -- смотрит на номер без пробелов, поэтому «01439sna» столкнётся с ним.
  plate_number text not null check (plate_number <> ''),

  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.vehicles is
  'База автомобилей ARGO Media: карточка машины; водители — vehicle_drivers, фото — vehicle_files.';

-- Водители — связка с базой сотрудников (бриф: «сотрудника/(-ов)» — их может
-- быть несколько). Массив uuid отвергнут: FK на элементы массива Postgres не
-- умеет, целостность жила бы только в клиенте.
create table if not exists public.vehicle_drivers (
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (vehicle_id, employee_id)
);

-- PK покрывает поиск по vehicle_id; обратная сторона (машины сотрудника,
-- каскад при удалении сотрудника) требует своего индекса.
create index if not exists vehicle_drivers_employee_id_idx
  on public.vehicle_drivers (employee_id);

-- Файлы машины: зеркало employee_files. Видов пока один — фото; техпаспорт или
-- страховка добавятся расширением CHECK отдельной миграцией, когда попросят.
create table if not exists public.vehicle_files (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  kind text not null check (kind in ('photo')),
  storage_path text not null unique,
  original_name text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists vehicle_files_vehicle_id_idx
  on public.vehicle_files (vehicle_id);

-- Нормализация при записи: база авторитетна, клиентский trim — только UX.
-- Госномер: btrim → пробелы схлопнуть до одного → upper → кириллические
-- двойники в латиницу (узбекские номера латинские, но русская раскладка даёт
-- невидимый дубль: «С» ≠ «C»). Порядок важен: translate ждёт верхний регистр.
create or replace function public.normalize_vehicle_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.brand := btrim(new.brand);
  new.model := nullif(btrim(coalesce(new.model, '')), '');
  new.color := nullif(btrim(coalesce(new.color, '')), '');
  new.plate_number := translate(
    upper(regexp_replace(btrim(new.plate_number), '\s+', ' ', 'g')),
    'АВЕКМНОРСТУХ',
    'ABEKMHOPCTYX'
  );
  return new;
end;
$$;

revoke all on function public.normalize_vehicle_fields() from public, anon;

drop trigger if exists trg_normalize_vehicle_fields on public.vehicles;
create trigger trg_normalize_vehicle_fields
  before insert or update on public.vehicles
  for each row execute function public.normalize_vehicle_fields();

drop trigger if exists update_vehicles_updated_at on public.vehicles;
create trigger update_vehicles_updated_at
  before update on public.vehicles
  for each row execute function public.update_updated_at_column();

-- Дубли отбивает база: уникален номер без пробелов. Имя индекса приходит
-- в тексте ошибки 23505 — клиент разбирает её по имени, не по коду.
create unique index if not exists vehicles_plate_number_key
  on public.vehicles (replace(plate_number, ' ', ''));

-- RLS: читает член приложения, пишет technician/manager/admin.
-- Отход от паттерна с17, названный вслух в плане: на vehicle_drivers staff
-- получает DELETE — это связка, а не персональные данные, и без него водителя
-- нельзя снять с машины. Сами vehicles/vehicle_files — удаление admin-only
-- политикой БЕЗ гранта (в проде роли admin нет ни у кого — осознанно).
alter table public.vehicles enable row level security;
alter table public.vehicle_drivers enable row level security;
alter table public.vehicle_files enable row level security;

drop policy if exists vehicles_select_for_members on public.vehicles;
create policy vehicles_select_for_members on public.vehicles
  for select to authenticated
  using (private.is_app_member());

drop policy if exists vehicles_insert_for_staff on public.vehicles;
create policy vehicles_insert_for_staff on public.vehicles
  for insert to authenticated
  with check (
    private.has_any_role(array['technician', 'manager', 'admin'])
    and created_by = auth.uid()
  );

drop policy if exists vehicles_update_for_staff on public.vehicles;
create policy vehicles_update_for_staff on public.vehicles
  for update to authenticated
  using (private.has_any_role(array['technician', 'manager', 'admin']))
  with check (private.has_any_role(array['technician', 'manager', 'admin']));

drop policy if exists vehicles_delete_for_admin on public.vehicles;
create policy vehicles_delete_for_admin on public.vehicles
  for delete to authenticated
  using (private.has_any_role(array['admin']));

drop policy if exists vehicle_drivers_select_for_members on public.vehicle_drivers;
create policy vehicle_drivers_select_for_members on public.vehicle_drivers
  for select to authenticated
  using (private.is_app_member());

drop policy if exists vehicle_drivers_insert_for_staff on public.vehicle_drivers;
create policy vehicle_drivers_insert_for_staff on public.vehicle_drivers
  for insert to authenticated
  with check (
    private.has_any_role(array['technician', 'manager', 'admin'])
    and created_by = auth.uid()
  );

drop policy if exists vehicle_drivers_delete_for_staff on public.vehicle_drivers;
create policy vehicle_drivers_delete_for_staff on public.vehicle_drivers
  for delete to authenticated
  using (private.has_any_role(array['technician', 'manager', 'admin']));

drop policy if exists vehicle_files_select_for_members on public.vehicle_files;
create policy vehicle_files_select_for_members on public.vehicle_files
  for select to authenticated
  using (private.is_app_member());

drop policy if exists vehicle_files_insert_for_staff on public.vehicle_files;
create policy vehicle_files_insert_for_staff on public.vehicle_files
  for insert to authenticated
  with check (
    private.has_any_role(array['technician', 'manager', 'admin'])
    and created_by = auth.uid()
  );

drop policy if exists vehicle_files_delete_for_admin on public.vehicle_files;
create policy vehicle_files_delete_for_admin on public.vehicle_files
  for delete to authenticated
  using (private.has_any_role(array['admin']));

-- Гранты: default privileges Supabase раздают полный CRUD — пересобираем явно.
revoke all on table public.vehicles from public, anon, authenticated;
grant select, insert, update on table public.vehicles to authenticated;

revoke all on table public.vehicle_drivers from public, anon, authenticated;
grant select, insert, delete on table public.vehicle_drivers to authenticated;

revoke all on table public.vehicle_files from public, anon, authenticated;
grant select, insert on table public.vehicle_files to authenticated;

notify pgrst, 'reload schema';
