-- Сотрудники: карточка + файлы (с17).
-- Данные заполняются постепенно: NOT NULL только фамилия и имя, остальное добивается
-- позже. Уникальность авторитетна по документам (ПИНФЛ, паспорт) — однофамильцы
-- с одной датой рождения легальны, их ловит только предупреждение в форме.

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),

  last_name text not null check (last_name <> ''),
  first_name text not null check (first_name <> ''),
  middle_name text,

  birth_date date,
  birth_place text,

  -- Основной документ. Серия/номер/ПИНФЛ нормализуются триггером ниже,
  -- поэтому CHECK и уникальные индексы смотрят уже на чистые значения.
  passport_series text,
  passport_number text,
  passport_issued_by text,
  passport_issued_at date,
  passport_expires_at date,
  pinfl text check (pinfl ~ '^[0-9]{14}$'),

  residence_address text,
  position text,
  phone text,
  t_shirt_size text,
  -- «Допуск: окончание» из мастер-списка прораба: срок допуска на объекты.
  clearance_expires_at date,

  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint employees_passport_dates_check
    check (passport_issued_at is null or passport_expires_at is null
           or passport_expires_at > passport_issued_at)
);

comment on table public.employees is
  'База сотрудников ARGO Media: карточка с паспортными данными, файлы — employee_files.';

-- Файлы сотрудника: фото несколько, видов пять — отдельной таблицей.
-- Сам файл живёт в приватном бакете employee-files (миграция бакета отдельно),
-- здесь — путь и вид. on delete cascade: клиент удалять сотрудников не может
-- (политики нет), каскад — для будущих админских/мостовых удалений.
create table if not exists public.employee_files (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  kind text not null check (kind in
    ('photo', 'passport_front', 'passport_back', 'intl_passport', 'residence_reg')),
  storage_path text not null unique,
  original_name text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists employee_files_employee_id_idx
  on public.employee_files (employee_id);

-- Нормализация при записи: база авторитетна, клиентский trim — только UX.
-- Серия — верхний регистр, номер и ПИНФЛ — только цифры, тексты — btrim,
-- пустые строки — в NULL (иначе '' обойдёт уникальный индекс).
create or replace function public.normalize_employee_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.last_name := btrim(new.last_name);
  new.first_name := btrim(new.first_name);
  new.middle_name := nullif(btrim(coalesce(new.middle_name, '')), '');
  new.birth_place := nullif(btrim(coalesce(new.birth_place, '')), '');
  new.passport_series := nullif(upper(btrim(coalesce(new.passport_series, ''))), '');
  new.passport_number := nullif(regexp_replace(coalesce(new.passport_number, ''), '\D', '', 'g'), '');
  new.pinfl := nullif(regexp_replace(coalesce(new.pinfl, ''), '\D', '', 'g'), '');
  new.passport_issued_by := nullif(btrim(coalesce(new.passport_issued_by, '')), '');
  new.residence_address := nullif(btrim(coalesce(new.residence_address, '')), '');
  new.position := nullif(btrim(coalesce(new.position, '')), '');
  new.phone := nullif(btrim(coalesce(new.phone, '')), '');
  new.t_shirt_size := nullif(btrim(coalesce(new.t_shirt_size, '')), '');
  return new;
end;
$$;

revoke all on function public.normalize_employee_fields() from public, anon;

drop trigger if exists trg_normalize_employee_fields on public.employees;
create trigger trg_normalize_employee_fields
  before insert or update on public.employees
  for each row execute function public.normalize_employee_fields();

-- updated_at — существующим общим триггером проекта.
drop trigger if exists update_employees_updated_at on public.employees;
create trigger update_employees_updated_at
  before update on public.employees
  for each row execute function public.update_updated_at_column();

-- Дубли отбивает база. NULL не конфликтует: полупустая карточка заводится свободно.
create unique index if not exists employees_pinfl_key
  on public.employees (pinfl);

create unique index if not exists employees_passport_key
  on public.employees (passport_series, passport_number)
  where passport_series is not null and passport_number is not null;

-- RLS: читает член приложения, пишет technician/manager/admin,
-- удаление — только admin (в проде его нет ни у кого — осознанно).
alter table public.employees enable row level security;
alter table public.employee_files enable row level security;

drop policy if exists employees_select_for_members on public.employees;
create policy employees_select_for_members on public.employees
  for select to authenticated
  using (private.is_app_member());

drop policy if exists employees_insert_for_staff on public.employees;
create policy employees_insert_for_staff on public.employees
  for insert to authenticated
  with check (
    private.has_any_role(array['technician', 'manager', 'admin'])
    and created_by = auth.uid()
  );

drop policy if exists employees_update_for_staff on public.employees;
create policy employees_update_for_staff on public.employees
  for update to authenticated
  using (private.has_any_role(array['technician', 'manager', 'admin']))
  with check (private.has_any_role(array['technician', 'manager', 'admin']));

drop policy if exists employees_delete_for_admin on public.employees;
create policy employees_delete_for_admin on public.employees
  for delete to authenticated
  using (private.has_any_role(array['admin']));

drop policy if exists employee_files_select_for_members on public.employee_files;
create policy employee_files_select_for_members on public.employee_files
  for select to authenticated
  using (private.is_app_member());

drop policy if exists employee_files_insert_for_staff on public.employee_files;
create policy employee_files_insert_for_staff on public.employee_files
  for insert to authenticated
  with check (
    private.has_any_role(array['technician', 'manager', 'admin'])
    and created_by = auth.uid()
  );

drop policy if exists employee_files_delete_for_admin on public.employee_files;
create policy employee_files_delete_for_admin on public.employee_files
  for delete to authenticated
  using (private.has_any_role(array['admin']));

-- Гранты: default privileges Supabase раздают полный CRUD — пересобираем явно.
-- DELETE не даём даже authenticated: политика admin-only останется страховкой
-- на случай будущего гранта, но сам грант появится отдельным решением.
revoke all on table public.employees from public, anon, authenticated;
grant select, insert, update on table public.employees to authenticated;

revoke all on table public.employee_files from public, anon, authenticated;
grant select, insert on table public.employee_files to authenticated;

notify pgrst, 'reload schema';
