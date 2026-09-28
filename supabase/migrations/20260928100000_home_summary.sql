-- Главная (с34, макет с31): плитки несут живой факт раздела — сколько техники и
-- в каком она состоянии, чьи документы истекают, первый госномер, залы последнего
-- плана. Один вызов вместо пяти выборок: главная открывается первой, и пять
-- круговых запросов ради пяти чисел — это пять шансов на мигание раскладки.
--
-- Порог «скоро истекает» здесь НЕ считается: функция отдаёт голые даты, а
-- состояние считает клиент через lib/expiry.ts — источник правды порога один,
-- и он же красит бейджи в карточке сотрудника.
--
-- security invoker: RLS-политики чтения всех таблиц применяются как есть,
-- функция видит ровно то, что вызвавший увидел бы обычным select.

create function public.home_summary()
returns jsonb
language plpgsql
stable
security invoker
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
      'count', (select count(*) from public.employees),
      -- Только заполненные сроки, без привязки к человеку: главной нужно
      -- «сколько истекает», а не «у кого».
      'expiries', coalesce((
        select jsonb_agg(d.value order by d.value)
        from (
          select passport_expires_at as value from public.employees where passport_expires_at is not null
          union all
          select clearance_expires_at from public.employees where clearance_expires_at is not null
        ) d
      ), '[]'::jsonb),
      -- Три инициала «фамилия+имя» — стопка лиц на плитке; id — добивка порядка
      -- для однофамильцев-тёзок, чтобы лица не менялись местами между вызовами.
      'faces', coalesce((
        select jsonb_agg(f.initials order by f.last_name, f.first_name, f.id)
        from (
          select id, last_name, first_name, upper(left(last_name, 1) || left(first_name, 1)) as initials
          from public.employees
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

-- Default privileges Supabase раздают EXECUTE каждой новой функции, в том числе
-- anon, — снимаем явно, как во всех миграциях проекта.
revoke all on function public.home_summary() from public, anon;
grant execute on function public.home_summary() to authenticated;
