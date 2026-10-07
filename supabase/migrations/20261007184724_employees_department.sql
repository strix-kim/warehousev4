-- Отдел сотрудника: «Штат» и «Наёмные» (решения прораба с53, п. 6 и 11).
-- Наёмный отличается от штатного ровно этим значением: та же карточка, те же
-- UNIQUE по ПИНФЛ и паспорту, те же политики — один фрилансер дважды не заведётся.
--
-- Текст с CHECK, а не enum и не справочник: так сделаны все закрытые списки
-- проекта (availability, kind, role, list_mode). Новый отдел — одна миграция.
-- Ограничение именованное: клиент разбирает отказ по имени (employeeSaveErrorText).
--
-- Колонка аддитивная, not null с default: существующие 12 строк становятся
-- 'staff', клиент прошлой сборки колонку не шлёт и получает тот же default.
-- Политики RLS и гранты таблицы не меняются.

alter table public.employees add column department text not null default 'staff';

alter table public.employees
  add constraint employees_department_check
  check (department in ('staff', 'hired'));

create index employees_department_idx on public.employees (department);

-- Главная считает только штат: иначе плитка «Сотрудники» прыгнет с 12 до 39+
-- после импорта наёмных, а сроки документов фрилансеров попадут в «истекает».
-- Сигнатура прежняя, поэтому create or replace: права на функцию сохраняются.
-- Тело — копия миграции home_summary, отличие — три фильтра department = 'staff'.
create or replace function public.home_summary()
returns jsonb
language plpgsql
stable
set search_path to ''
as $function$
declare
  result jsonb;
begin
  if not (select private.is_app_member()) then
    raise exception 'Not an application member';
  end if;

  select jsonb_build_object(
    'equipment', (
      select jsonb_build_object(
        'rows', count(*),
        -- Модель — пара brand+model как есть, то же правило, что total_models в
        -- fetch_equipment_models: число на главной обязано совпасть с каталогом.
        'models', (select count(*) from (select distinct m.brand, m.model from public.equipment m) models),
        -- Штуки — sum(greatest(count, 0)), как units_total каталога.
        'units', coalesce(sum(greatest(e.count, 0)), 0),
        'available', coalesce(sum(greatest(e.count, 0)) filter (where e.availability = 'available'), 0),
        'diagnostics', coalesce(sum(greatest(e.count, 0)) filter (where e.availability = 'diagnostics'), 0),
        -- «Нет на складе» — всё, что не на складе и не на диагностике: сюда же
        -- уходит issued (выдано) и любое незнакомое значение. Так три слагаемых
        -- полосы всегда дают ровно units, и полоса не врёт длиной.
        'unavailable', coalesce(sum(greatest(e.count, 0)) filter (
          where e.availability is distinct from 'available'
            and e.availability is distinct from 'diagnostics'
        ), 0)
      )
      from public.equipment e
    ),
    'employees', jsonb_build_object(
      -- Только штат: наёмные в число «Сотрудники» не входят (решение прораба с53).
      'count', (select count(*) from public.employees where department = 'staff'),
      -- Только заполненные сроки, без привязки к человеку: главной нужно
      -- «сколько истекает», а не «у кого».
      'expiries', coalesce((
        select jsonb_agg(d.value order by d.value)
        from (
          select passport_expires_at as value from public.employees
          where passport_expires_at is not null and department = 'staff'
          union all
          select clearance_expires_at from public.employees
          where clearance_expires_at is not null and department = 'staff'
        ) d
      ), '[]'::jsonb),
      -- Три инициала «фамилия+имя» — стопка лиц на плитке; id — добивка порядка
      -- для однофамильцев-тёзок, чтобы лица не менялись местами между вызовами.
      'faces', coalesce((
        select jsonb_agg(f.initials order by f.last_name, f.first_name, f.id)
        from (
          select id, last_name, first_name, upper(left(last_name, 1) || left(first_name, 1)) as initials
          from public.employees
          where department = 'staff'
          order by last_name, first_name, id
          limit 3
        ) f
      ), '[]'::jsonb)
    ),
    'vehicles', jsonb_build_object(
      'count', (select count(*) from public.vehicles),
      -- Первая заведённая машина, а не первая по алфавиту: номер на плитке не
      -- должен меняться от того, что кто-то добавил «01 A …».
      'first_plate', (
        select v.plate_number from public.vehicles v order by v.created_at, v.id limit 1
      ),
      'drivers', (select count(distinct vd.employee_id) from public.vehicle_drivers vd)
    ),
    -- Последний план: по дате мероприятия, без даты — в конец; среди равных —
    -- тот, что правили позже. Плана нет — null.
    'hall_plan', (
      select jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'event_from', p.event_from,
        'event_to', p.event_to,
        'halls', coalesce((
          select jsonb_agg(jsonb_build_object('name', h.name, 'color', h.color) order by h.sort_order, h.created_at, h.id)
          from public.halls h
          where h.plan_id = p.id
        ), '[]'::jsonb),
        -- Слот наёма — ячейка с is_external: место решено, человека пока нет
        -- (миграция hired_operator_slots). Каждая такая ячейка и есть «наём».
        'hires', (
          select count(*) from public.hall_assignments a
          where a.plan_id = p.id and a.is_external
        )
      )
      from public.hall_plans p
      order by p.event_from desc nulls last, p.updated_at desc, p.id
      limit 1
    )
  ) into result;

  return result;
end;
$function$;

revoke execute on function public.home_summary() from public, anon;
grant execute on function public.home_summary() to authenticated;

notify pgrst, 'reload schema';
