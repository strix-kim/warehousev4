-- Конфликт версий карточки перестаёт вешать запрос НАВСЕГДА.
--
-- Что было. Оптимистическая блокировка (20260820183210) поднимала расхождение
-- версий кодом 40001. Код выбран неверно: 40001 — это serialization_failure,
-- то есть указание клиенту «транзакция не сериализовалась, ПОВТОРИ её».
-- PostgREST это указание исполняет буквально и повторяет вызов сам. Но наше
-- условие детерминированное — updated_at в базе от повтора не меняется, —
-- поэтому каждая попытка падала так же, и цикл не заканчивался ничем: ответ
-- клиенту не уходил вообще. В интерфейсе это выглядело как «кнопка сохранения
-- погасла навсегда», а в базе — как 1 258 121 исключение за 16 минут от двух
-- нажатий (замерено по postgres_logs 2026-08-23).
--
-- Что стало. Код PT409. PostgREST маппит SQLSTATE вида PTxyz прямо в HTTP-статус
-- xyz, то есть 409 Conflict — ровно то, чем конфликт версий и является. Ретраев
-- нет: 409 не входит в класс «повтори транзакцию», ответ уходит с первой попытки.
--
-- Порядок выкатки соблюдён: клиент, понимающий ОБА кода, уехал в прод раньше
-- этой миграции. Поэтому в любой момент времени конфликт распознаётся — и до
-- применения (старый 40001), и после (новый PT409).
--
-- Тело функции не меняется больше нигде: сверка версий, необязательный p_count
-- и проверка роли остаются как были.

create or replace function public.update_equipment_model_and_unit(
  p_equipment_id uuid,
  p_brand text,
  p_model text,
  p_type text,
  p_subtype text,
  p_technicalspecification text,
  p_lengthinmeters text,
  p_description text,
  p_availability text,
  p_location text,
  p_count integer default null,
  p_expected_updated_at timestamptz default null
)
returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  current_brand text;
  current_model text;
  current_updated_at timestamptz;
  updated_units integer;
begin
  if not (select private.has_any_role(array['technician', 'manager', 'admin'])) then
    raise exception 'Only the inventory team can edit equipment';
  end if;

  select e.brand, e.model, e.updated_at
  into current_brand, current_model, current_updated_at
  from public.equipment e
  where e.id = p_equipment_id;

  if not found then
    raise exception 'Equipment was not found';
  end if;

  -- Версия карточки. null от клиента = «не сверяй» (старый клиент, разовый вызов).
  -- PT409, а НЕ 40001: см. шапку миграции — 40001 заставляет PostgREST повторять
  -- вызов, и на детерминированном условии это бесконечный цикл.
  if p_expected_updated_at is not null
    and p_expected_updated_at is distinct from current_updated_at then
    raise exception 'Equipment card is stale' using errcode = 'PT409';
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

  -- Отрицательное количество проверяем только когда его реально прислали:
  -- отсутствие параметра — это «не трогай count», а не ноль.
  if p_count is not null and p_count < 0 then
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
    location = coalesce(nullif(btrim(p_location), ''), e.location),
    count = coalesce(p_count, e.count),
    updated_at = now()
  where e.id = p_equipment_id;

  return jsonb_build_object(
    'equipment_id', p_equipment_id,
    'updated_model_units', updated_units
  );
end;
$function$;

-- create or replace сохраняет ACL существующей функции, но повторяем явно:
-- default privileges Supabase раздают EXECUTE щедро, и молчаливая опора на
-- «оно и так осталось» — тот самый случай, из-за которого anon однажды получил
-- доступ к count_equipment_model_units (gotchas §3).
revoke all on function public.update_equipment_model_and_unit(uuid, text, text, text, text, text, text, text, text, text, integer, timestamptz) from public;
revoke execute on function public.update_equipment_model_and_unit(uuid, text, text, text, text, text, text, text, text, text, integer, timestamptz) from anon;
grant execute on function public.update_equipment_model_and_unit(uuid, text, text, text, text, text, text, text, text, text, integer, timestamptz) to authenticated;
