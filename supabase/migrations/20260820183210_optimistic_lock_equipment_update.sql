-- Две находки аудита по update_equipment_model_and_unit (обе LOW, но связанные):
--
-- 1. Устаревшая вкладка молча перезаписывала поля модели у ВСЕЙ группы: RPC не
--    сверяла версию записи. Добавлена оптимистическая блокировка — клиент присылает
--    updated_at, на котором он открыл карточку, и расхождение отменяет правку
--    целиком (ни одно поле не записано). Код ошибки — стандартный
--    serialization_failure (40001), по нему клиент отличает конфликт версий от
--    любого другого отказа.
-- 2. Сохранение серийной карточки принудительно писало count = 1. Триггер
--    trg_equipment_movement_history реагирует на изменение count, и запись с
--    count <> 1 получала фантомную строку «Изменено количество» в журнале при
--    правке одного лишь описания. Теперь p_count необязателен: не прислали —
--    count остаётся прежним (coalesce), before = after, триггер строку не пишет
--    (его собственный гейт `new.count is not distinct from old.count`).
--
-- Сигнатура меняется, поэтому старая версия сначала сносится: два overload'а с
-- одним именем дают PostgREST неоднозначность (PGRST203).
--
-- Совместимость со старым клиентом: прод до выкатки зовёт функцию 11 именованными
-- аргументами без p_expected_updated_at. Оба новых значения по умолчанию null,
-- то есть старый вызов проходит как раньше: версия не сверяется, count пишется
-- явно переданным числом. Порядок выкатки любой.
--
-- Тело скопировано из ДЕЙСТВУЮЩЕЙ версии
-- (20260820163924_keep_equipment_location_on_empty_update.sql), а не из baseline:
-- в baseline нет обороны location от пустой строки.

drop function if exists public.update_equipment_model_and_unit(uuid,text,text,text,text,text,text,text,text,text,integer);

create or replace function public.update_equipment_model_and_unit(
  p_equipment_id uuid, p_brand text, p_model text, p_type text, p_subtype text,
  p_technicalspecification text, p_lengthinmeters text, p_description text,
  p_availability text, p_location text, p_count integer default null,
  p_expected_updated_at timestamptz default null)
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
  if p_expected_updated_at is not null
    and p_expected_updated_at is distinct from current_updated_at then
    raise exception 'Equipment card is stale' using errcode = '40001';
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

-- Права выдаём заново: drop снёс прежние гранты, а default privileges Supabase
-- отдают EXECUTE новой функции напрямую anon — `revoke from public` этого не
-- снимает (грабля из 20260820173459_revoke_anon_count_units.sql).
revoke all on function public.update_equipment_model_and_unit(uuid, text, text, text, text, text, text, text, text, text, integer, timestamptz) from public;
revoke execute on function public.update_equipment_model_and_unit(uuid, text, text, text, text, text, text, text, text, text, integer, timestamptz) from anon;
grant execute on function public.update_equipment_model_and_unit(uuid, text, text, text, text, text, text, text, text, text, integer, timestamptz) to authenticated;
