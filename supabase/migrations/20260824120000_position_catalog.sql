-- Справочник позиций (с20, решение прораба). Стандартные позиции больше НЕ
-- засеваются в каждый план скопом: на реальном мероприятии из пяти строк
-- образца нужны три, и лишние приходилось удалять руками. Вместо этого — общий
-- справочник имён: при добавлении строки в план готовую позицию берут чипом,
-- а вписанную руками справочник запоминает сам, и в следующем плане она уже
-- предлагается. Удаление из справочника планы не трогает: имя строки в
-- plan_positions — своя копия, а не ссылка.
--
-- Ссылки (FK) на справочник здесь намеренно НЕТ. Строка плана — снимок на день
-- мероприятия: переименовали позицию в справочнике или снесли её — расстановка
-- полугодовой давности обязана читаться как была.
create table if not exists public.position_catalog (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  role text not null default 'technician'
    check (role in ('technician', 'operator', 'other')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

-- Уникальность по СВЁРНУТОМУ имени: «Страховка», «страховка» и «Страховка »
-- это одна позиция, и три чипа вместо одного сделали бы справочник свалкой.
-- Обычный UNIQUE на name такого не ловит — отсюда индекс по выражению.
create unique index if not exists position_catalog_name_key
  on public.position_catalog (lower(btrim(name)));

comment on table public.position_catalog is
  'Справочник позиций мероприятия: имена для чипов быстрого добавления строк матрицы. Связи с планами нет — строка плана хранит свою копию имени.';

-- Та же нормализация, что у залов и строк матрицы (функция создана миграцией
-- 20260824090000): хвостовые пробелы срезаются до записи, а не при чтении.
drop trigger if exists trg_normalize_hall_name on public.position_catalog;
create trigger trg_normalize_hall_name
  before insert or update on public.position_catalog
  for each row execute function public.normalize_hall_name();

-- RLS: читает член приложения, пишет technician/manager/admin. DELETE отдан
-- staff по тому же решению прораба, что и у hall_plans/halls/plan_positions
-- (с20): справочник — рабочий инструмент бригады, а не персональные данные.
alter table public.position_catalog enable row level security;

drop policy if exists position_catalog_select_for_members on public.position_catalog;
create policy position_catalog_select_for_members on public.position_catalog
  for select to authenticated
  using (private.is_app_member());

drop policy if exists position_catalog_insert_for_staff on public.position_catalog;
create policy position_catalog_insert_for_staff on public.position_catalog
  for insert to authenticated
  with check (
    private.has_any_role(array['technician', 'manager', 'admin'])
    and created_by = auth.uid()
  );

drop policy if exists position_catalog_update_for_staff on public.position_catalog;
create policy position_catalog_update_for_staff on public.position_catalog
  for update to authenticated
  using (private.has_any_role(array['technician', 'manager', 'admin']))
  with check (private.has_any_role(array['technician', 'manager', 'admin']));

drop policy if exists position_catalog_delete_for_staff on public.position_catalog;
create policy position_catalog_delete_for_staff on public.position_catalog
  for delete to authenticated
  using (private.has_any_role(array['technician', 'manager', 'admin']));

-- Гранты: default privileges Supabase раздают полный CRUD — пересобираем явно.
revoke all on table public.position_catalog from public, anon, authenticated;
grant select, insert, update, delete on table public.position_catalog to authenticated;

-- Засев пятёркой из образца прораба: пустой справочник не показывает ни одного
-- чипа, и первый же план пришлось бы набирать руками целиком. Это ДАННЫЕ
-- миграции, а не пользователя: created_by у этих пяти строк NULL — писал их
-- postgres, а не человек, и политика вставки к нему не применяется. Имена
-- русские: язык данных задаёт тот, кто их создаёт, а здесь это миграция.
-- Millumin и Zoom / PPT — названия продуктов, не переводятся ни на один язык.
insert into public.position_catalog (name, role) values
  ('Millumin', 'technician'),
  ('Zoom / PPT', 'technician'),
  ('Камеры / PTZ', 'technician'),
  ('Страховка', 'technician'),
  ('Операторы', 'operator')
on conflict do nothing;

notify pgrst, 'reload schema';
