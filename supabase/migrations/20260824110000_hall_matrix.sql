-- Матрица распределения (с20). Структура hall_positions заменена: прораб принёс
-- реальный образец расстановки, и он устроен не колонками-залами со своими
-- позициями, а МАТРИЦЕЙ — строки это позиции ВСЕГО мероприятия (Millumin,
-- Zoom / PPT, Камеры / PTZ, Страховка, Операторы), колонки — залы, ячейка —
-- люди на пересечении. Один человек законно стоит в нескольких ячейках
-- (страховка четырёх залов сразу), а пустая ячейка бывает запланированной —
-- на бумаге это прочерк, а не отсутствие строки.
--
-- Поэтому «одна позиция = один человек в одном зале» разъезжается с образцом на
-- первом же плане: имя позиции пришлось бы дублировать в каждом зале, а порядок
-- строк держать вручную одинаковым во всех колонках. Разносим на две таблицы:
-- имя строки живёт один раз на план (plan_positions), а человек в клетке —
-- отдельной записью (hall_assignments).
--
-- hall_positions удаляется целиком: рабочих данных в ней нет, тестовые строки
-- прораба объявлены и снесены. Триггеры уходят вместе с таблицей, а функции
-- normalize_hall_name и touch_hall_plan ОСТАЮТСЯ — они висят на halls и нужны
-- обеим новым таблицам.
drop table if exists public.hall_positions;

-- Строка матрицы: позиция мероприятия, одна на весь план. Зала здесь нет
-- намеренно — «Страховка» это одна строка на все залы, а не четыре одинаковых.
create table if not exists public.plan_positions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.hall_plans(id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  role text not null default 'technician'
    check (role in ('technician', 'operator', 'other')),
  sort_order integer not null default 0,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),

  -- Ключ-мишень для составного FK из hall_assignments: он держит ячейку
  -- в границах своего плана (см. hall_assignments_position_fkey).
  constraint plan_positions_id_plan_id_key unique (id, plan_id)
);

create index if not exists plan_positions_plan_id_idx
  on public.plan_positions (plan_id);

comment on table public.plan_positions is
  'Строки матрицы распределения: позиции мероприятия (Millumin, Страховка, Операторы) — одна строка на весь план.';

-- Ячейка матрицы: один слот на пересечении строки и зала. Слотов в клетке
-- может быть несколько (три оператора в зале — три записи), и один и тот же
-- человек может стоять в разных клетках плана — UNIQUE на employee_id нет.
--
-- employee_id NULL — это ВАКАНСИЯ, прочерк с бумажного образца: место
-- запланировано, человек ещё не назначен. Значит «нет записи» и «есть пустой
-- слот» — разные состояния, и вакансия обязана быть строкой, а не отсутствием
-- строки: иначе «свободно 3» не посчитать. По той же причине уволенный
-- сотрудник (on delete set null) превращает слот в вакансию, а не стирает его.
create table if not exists public.hall_assignments (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null,
  hall_id uuid not null,
  position_id uuid not null,
  employee_id uuid references public.employees(id) on delete set null,
  sort_order integer not null default 0,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),

  -- Составные FK: plan_id ячейки обязан совпадать и с планом её зала, и с
  -- планом её строки. Подмена plan_id в обход интерфейса даст 23503, а не
  -- ячейку из чужого плана.
  constraint hall_assignments_hall_fkey
    foreign key (hall_id, plan_id) references public.halls(id, plan_id)
    on delete cascade,
  constraint hall_assignments_position_fkey
    foreign key (position_id, plan_id) references public.plan_positions(id, plan_id)
    on delete cascade
);

-- Один человек в одной клетке — один раз: два одинаковых чипа в ячейке это
-- всегда промах мышью, а не сценарий. Частичный (where employee_id is not null),
-- потому что вакансий в клетке бывает сколько угодно: NULL в UNIQUE не сходятся
-- между собой, но частичный индекс говорит это явно, а не полагается на правило.
create unique index if not exists hall_assignments_person_per_cell_key
  on public.hall_assignments (position_id, hall_id, employee_id)
  where employee_id is not null;

create index if not exists hall_assignments_plan_id_idx
  on public.hall_assignments (plan_id);
create index if not exists hall_assignments_hall_id_idx
  on public.hall_assignments (hall_id);
create index if not exists hall_assignments_position_id_idx
  on public.hall_assignments (position_id);
create index if not exists hall_assignments_employee_id_idx
  on public.hall_assignments (employee_id);

comment on table public.hall_assignments is
  'Ячейки матрицы: человек (или вакансия при employee_id null) на пересечении позиции и зала.';

-- Нормализация имени — только у строк матрицы: у ячейки имени нет, ей нечего
-- тримить. Функция та же, что у залов (создана миграцией 20260824090000).
drop trigger if exists trg_normalize_hall_name on public.plan_positions;
create trigger trg_normalize_hall_name
  before insert or update on public.plan_positions
  for each row execute function public.normalize_hall_name();

-- «Изменён hh:mm» на карточке плана обязан реагировать на правку любой строки и
-- любой ячейки: своего updated_at у детей нет, его двигает база на плане.
drop trigger if exists trg_touch_hall_plan on public.plan_positions;
create trigger trg_touch_hall_plan
  after insert or update or delete on public.plan_positions
  for each row execute function public.touch_hall_plan();

drop trigger if exists trg_touch_hall_plan on public.hall_assignments;
create trigger trg_touch_hall_plan
  after insert or update or delete on public.hall_assignments
  for each row execute function public.touch_hall_plan();

-- RLS: читает член приложения, пишет technician/manager/admin. DELETE отдан
-- staff по тому же решению прораба, что и у hall_plans/halls (с20): план —
-- рабочая расстановка на одно мероприятие, а не персональные данные.
alter table public.plan_positions enable row level security;
alter table public.hall_assignments enable row level security;

drop policy if exists plan_positions_select_for_members on public.plan_positions;
create policy plan_positions_select_for_members on public.plan_positions
  for select to authenticated
  using (private.is_app_member());

drop policy if exists plan_positions_insert_for_staff on public.plan_positions;
create policy plan_positions_insert_for_staff on public.plan_positions
  for insert to authenticated
  with check (
    private.has_any_role(array['technician', 'manager', 'admin'])
    and created_by = auth.uid()
  );

drop policy if exists plan_positions_update_for_staff on public.plan_positions;
create policy plan_positions_update_for_staff on public.plan_positions
  for update to authenticated
  using (private.has_any_role(array['technician', 'manager', 'admin']))
  with check (private.has_any_role(array['technician', 'manager', 'admin']));

drop policy if exists plan_positions_delete_for_staff on public.plan_positions;
create policy plan_positions_delete_for_staff on public.plan_positions
  for delete to authenticated
  using (private.has_any_role(array['technician', 'manager', 'admin']));

drop policy if exists hall_assignments_select_for_members on public.hall_assignments;
create policy hall_assignments_select_for_members on public.hall_assignments
  for select to authenticated
  using (private.is_app_member());

drop policy if exists hall_assignments_insert_for_staff on public.hall_assignments;
create policy hall_assignments_insert_for_staff on public.hall_assignments
  for insert to authenticated
  with check (
    private.has_any_role(array['technician', 'manager', 'admin'])
    and created_by = auth.uid()
  );

drop policy if exists hall_assignments_update_for_staff on public.hall_assignments;
create policy hall_assignments_update_for_staff on public.hall_assignments
  for update to authenticated
  using (private.has_any_role(array['technician', 'manager', 'admin']))
  with check (private.has_any_role(array['technician', 'manager', 'admin']));

drop policy if exists hall_assignments_delete_for_staff on public.hall_assignments;
create policy hall_assignments_delete_for_staff on public.hall_assignments
  for delete to authenticated
  using (private.has_any_role(array['technician', 'manager', 'admin']));

-- Гранты: default privileges Supabase раздают полный CRUD — пересобираем явно.
revoke all on table public.plan_positions from public, anon, authenticated;
grant select, insert, update, delete on table public.plan_positions to authenticated;

revoke all on table public.hall_assignments from public, anon, authenticated;
grant select, insert, update, delete on table public.hall_assignments to authenticated;

notify pgrst, 'reload schema';
