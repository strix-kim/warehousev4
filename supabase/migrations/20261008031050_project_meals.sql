-- Обеды на мероприятии, М1 (с57, план meals-s56 §1.1–1.4): приём пищи (день × слот)
-- и строки «кто что». Всё про расходы (expense_id, замок, create_meal_expense) —
-- отдельной миграцией М2.
--
-- Две таблицы, а не одна: статус и ссылка на расход — факты приёма, на строке
-- заказа они повторялись бы N раз и расходились.
--
-- Объекты создаются без «if exists»-зачистки: их заведомо нет, а зачистку
-- MCP-коннектор отклоняет (gotchas §3).

-- 1. Приём пищи. meal_on без default намеренно: current_date в базе — UTC
-- (грабля expenses). Строка создаётся лениво — при первом заказе или смене статуса.
create table public.project_meals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  meal_on date not null,
  slot text not null default 'lunch',
  status text not null default 'collecting',
  created_by uuid default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Текст с CHECK, не enum — канон проекта (department, list_mode).
  constraint project_meals_slot_check check (slot in ('lunch', 'dinner')),
  constraint project_meals_status_check check (status in ('collecting', 'ordered', 'delivered')),
  -- Пара к «одна карточка обеда на день и слот»; ведущий столбец обслуживает
  -- выборку по мероприятию, отдельный индекс не нужен.
  constraint project_meals_slot_key unique (project_id, meal_on, slot)
);

comment on table public.project_meals is
  'Приём пищи на мероприятии (день × слот): статус сбора и ссылка на расход. Строки «кто что» — project_meal_orders.';

-- День обеда — внутри периода мероприятия. Пара к выбору дня в UI. Сдвиг дат
-- мероприятия задним числом старые обеды не трогает: триггер срабатывает только
-- на insert и смену meal_on, UI показывает такие дни «вне периода».
create function public.guard_project_meal_day()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_from date;
  v_to date;
begin
  select date_from, coalesce(date_to, date_from) into v_from, v_to
    from public.projects where id = new.project_id;
  if v_from is null or new.meal_on < v_from or new.meal_on > v_to then
    raise exception 'project_meal_outside_period';
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_project_meal_day() from public, anon, authenticated;

create trigger trg_guard_project_meal_day
  before insert or update of meal_on, project_id on public.project_meals
  for each row execute function public.guard_project_meal_day();

create trigger update_project_meals_updated_at
  before update on public.project_meals
  for each row execute function public.update_updated_at_column();

-- 2. Строка «кто что»: ОДНА на человека в приёме, не на блюдо («Плов + самса»
-- одной строкой — кафе так и читает; сводка схлопывает одинаковые строки).
-- dish null = «не ест / своё»; строки нет вовсе = «ещё не спросили».
-- employee_id, а не project_staff.id: человека убрали из состава после обеда —
-- заказ и деньги остаются (UI показывает его «вне состава»).
-- restrict, а не cascade/set null: set null нарушил бы person_check, cascade
-- молча стёр бы строку внесённого в расходы обеда. Удаление сотрудника — админская
-- операция в SQL, restrict честно скажет «у него есть заказы».
create table public.project_meal_orders (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references public.project_meals(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete restrict,
  -- Человек вне состава / «Общее» (водитель, гость, лепёшки на всех).
  guest_name text,
  dish text,
  qty smallint not null default 1,
  -- Цена за порцию, целые сумы; необязательна (чек без цен по блюдам).
  price bigint,
  created_by uuid default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Ровно одно из двух: сотрудник или гость.
  constraint project_meal_orders_person_check check ((employee_id is null) <> (guest_name is null)),
  -- Отказавшийся — без цены, иначе итог посчитает деньги за «не ест».
  constraint project_meal_orders_dish_check check (
    (dish is null and price is null)
    or (btrim(dish) <> '' and char_length(dish) <= 120)
  ),
  constraint project_meal_orders_guest_check check (
    guest_name is null or (btrim(guest_name) <> '' and char_length(guest_name) <= 80)
  ),
  constraint project_meal_orders_qty_check check (qty between 1 and 99),
  constraint project_meal_orders_price_check check (price is null or (price between 1 and 10000000)),
  -- ПОЛНОЕ, не частичное: NULL-ы гостей не сталкиваются, а полное ограничение
  -- годится для upsert(onConflict: 'meal_id,employee_id'). Пара к «одна строка
  -- на человека».
  constraint project_meal_orders_employee_key unique (meal_id, employee_id)
);

comment on table public.project_meal_orders is
  'Строка заказа: один человек (сотрудник или гость-текст) в одном приёме пищи. dish null = не ест.';

-- Защита от двойного нажатия «+ Гость».
create unique index project_meal_orders_guest_key
  on public.project_meal_orders (meal_id, lower(guest_name)) where guest_name is not null;

-- Под проверку FK restrict при удалении сотрудника.
create index project_meal_orders_employee_id_idx
  on public.project_meal_orders (employee_id) where employee_id is not null;

-- Схлопывание пробелов — чтобы «Плов» и «Плов  » в сводке были одним блюдом.
-- Регистр не трогаем (показываем как ввели), группировку по lower() делает
-- сводка. BEFORE-триггер раньше CHECK: пустое после обрезки становится null, и
-- dish_check отобьёт «null с ценой».
create function public.normalize_meal_order_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.dish := nullif(regexp_replace(btrim(new.dish), '\s+', ' ', 'g'), '');
  new.guest_name := nullif(regexp_replace(btrim(new.guest_name), '\s+', ' ', 'g'), '');
  return new;
end;
$$;

revoke execute on function public.normalize_meal_order_fields() from public, anon, authenticated;

create trigger trg_normalize_meal_order_fields
  before insert or update on public.project_meal_orders
  for each row execute function public.normalize_meal_order_fields();

create trigger update_project_meal_orders_updated_at
  before update on public.project_meal_orders
  for each row execute function public.update_updated_at_column();

-- 3. RLS и гранты — образец project_staff: читает член приложения, пишут три
-- рабочие роли. Изоляции между сотрудниками нет по замыслу: обеды видны всем
-- участникам, «чей заказ» — атрибуция, а не право.
alter table public.project_meals enable row level security;
alter table public.project_meal_orders enable row level security;

create policy project_meals_select_for_members on public.project_meals
  for select to authenticated
  using ((select private.is_app_member()));

create policy project_meals_insert_for_staff on public.project_meals
  for insert to authenticated
  with check (
    (select private.has_any_role(array['technician', 'manager', 'admin']))
    and created_by = (select auth.uid())
  );

create policy project_meals_update_for_staff on public.project_meals
  for update to authenticated
  using ((select private.has_any_role(array['technician', 'manager', 'admin'])))
  with check ((select private.has_any_role(array['technician', 'manager', 'admin'])));

create policy project_meals_delete_for_staff on public.project_meals
  for delete to authenticated
  using ((select private.has_any_role(array['technician', 'manager', 'admin'])));

create policy project_meal_orders_select_for_members on public.project_meal_orders
  for select to authenticated
  using ((select private.is_app_member()));

create policy project_meal_orders_insert_for_staff on public.project_meal_orders
  for insert to authenticated
  with check (
    (select private.has_any_role(array['technician', 'manager', 'admin']))
    and created_by = (select auth.uid())
  );

create policy project_meal_orders_update_for_staff on public.project_meal_orders
  for update to authenticated
  using ((select private.has_any_role(array['technician', 'manager', 'admin'])))
  with check ((select private.has_any_role(array['technician', 'manager', 'admin'])));

create policy project_meal_orders_delete_for_staff on public.project_meal_orders
  for delete to authenticated
  using ((select private.has_any_role(array['technician', 'manager', 'admin'])));

revoke all on table public.project_meals from public, anon, authenticated;
revoke all on table public.project_meal_orders from public, anon, authenticated;
grant select, insert, update, delete on table public.project_meals to authenticated;
grant select, insert, update, delete on table public.project_meal_orders to authenticated;

-- 4. Подсказки блюд: частота по всем приёмам мероприятия, считает база (выборка
-- по всем дням может расти; скалярный jsonb под обрезку 1000 не попадает).
-- Показываем первое написание блюда в группе, группа — по lower().
create function public.project_meal_dishes(p_project_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $function$
declare
  result jsonb;
begin
  if not (select private.is_app_member()) then
    raise exception 'Not an application member';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object('dish', g.dish, 'count', g.cnt, 'price', g.last_price)
    order by g.cnt desc, g.last_at desc
  ), '[]'::jsonb) into result
  from (
    select
      (array_agg(o.dish order by o.updated_at desc))[1] as dish,
      sum(o.qty)::int as cnt,
      -- Последняя введённая цена этого блюда — подсказка в лист заказа.
      (array_agg(o.price order by o.updated_at desc) filter (where o.price is not null))[1] as last_price,
      max(o.updated_at) as last_at
    from public.project_meal_orders o
    join public.project_meals m on m.id = o.meal_id
    where m.project_id = p_project_id and o.dish is not null
    group by lower(o.dish)
  ) g;

  return result;
end;
$function$;

revoke all on function public.project_meal_dishes(uuid) from public, anon;
grant execute on function public.project_meal_dishes(uuid) to authenticated;

notify pgrst, 'reload schema';
