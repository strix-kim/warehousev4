-- с16: «+1 единица к существующей модели» из дровера модели — не заполняя форму
-- заведения заново. Клиент передаёт только id единицы-образца, опциональный
-- серийник и количество; бренд, модель, категорию, локацию и характеристики
-- сервер КОПИРУЕТ из образца сам — дыра «brand/model из клиентского JSON» на
-- этот путь не распространяется.
--
-- Серийник — опциональный атрибут единицы:
--   * номер передан → одна серийная строка (count = 1). Дубль против каталога
--     проверяется под pg_advisory_xact_lock по нормализованному номеру — тот же
--     приём, что в create_equipment_batch; дубль — ответ
--     {"status":"duplicates","serials":[...]}, а не исключение.
--   * номера нет → плюсуем к количественной строке модели (count + N под
--     for update); количественной строки нет — заводим новую QTY::AUTO::.
--     Гонку «две вкладки жмут +1, строки ещё нет» закрывает advisory-лок по
--     нормализованной паре бренд/модель: без него обе вкладки вставили бы по
--     своей QTY-строке. Неймспейс лока ('equipment-model:…') не пересекается с
--     локами серийников — deadlock между двумя ветками невозможен.
--
-- Количественную строку сервер узнаёт по той же эвристике, по которой клиент
-- нормализует записи (normalizeEquipment в features/equipment/api.ts):
-- count > 1, префиксы QTY::/AUTO-, заглушки вместо номера, одни нули.
--
-- Функция security invoker: INSERT/UPDATE-политики equipment применяются как
-- обычно, журнал движений пишет триггер. is_app_member в начале — ради внятной
-- ошибки вместо голого отказа RLS.

create function public.add_equipment_unit(
  p_sample_id uuid,
  p_serialnumber text default null,
  p_count integer default 1
)
returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  sample public.equipment%rowtype;
  serial text;
  qty_row_id uuid;
  added integer;
  units_total integer;
begin
  if not (select private.is_app_member()) then
    raise exception 'Not an application member';
  end if;

  select * into sample from public.equipment where id = p_sample_id;
  if not found then
    raise exception 'Sample unit not found';
  end if;

  serial := nullif(btrim(coalesce(p_serialnumber, '')), '');

  if serial is not null then
    perform pg_advisory_xact_lock(hashtextextended(lower(serial), 0));

    if exists (select 1 from public.equipment e where lower(btrim(e.serialnumber)) = lower(serial)) then
      return jsonb_build_object('status', 'duplicates', 'serials', to_jsonb(array[serial]));
    end if;

    insert into public.equipment (
      brand, model, serialnumber, type, subtype, count, availability, location,
      technicalspecification, lengthinmeters, description
    )
    values (
      sample.brand, sample.model, serial, sample.type, sample.subtype, 1,
      -- Новая единица приезжает на склад доступной; статус образца может быть
      -- каким угодно («в ремонте») и на новую не переносится.
      'available', sample.location,
      sample.technicalspecification, sample.lengthinmeters, sample.description
    );
    added := 1;
  else
    if p_count is null or p_count < 1 or p_count > 9999 then
      raise exception 'Count must be between 1 and 9999';
    end if;

    perform pg_advisory_xact_lock(hashtextextended(
      'equipment-model:' || lower(btrim(sample.brand)) || '::' || lower(btrim(sample.model)), 0));

    select e.id into qty_row_id
    from public.equipment e
    where lower(btrim(e.brand)) = lower(btrim(sample.brand))
      and lower(btrim(e.model)) = lower(btrim(sample.model))
      and (
        coalesce(e.count, 0) > 1
        or e.serialnumber like 'QTY::%'
        or e.serialnumber like 'AUTO-%'
        or lower(btrim(e.serialnumber)) in ('', 'n/a', 'na', 'нет', 'без номера', 'б/н', 'none', 'null', '-')
        or btrim(e.serialnumber) ~ '^0+$'
      )
    -- Строк может быть несколько (исторический импорт): плюсуем всегда к
    -- старейшей, чтобы «+1» из разных сессий не размазывался по разным строкам.
    order by e.created_at nulls last, e.id
    limit 1
    for update;

    if qty_row_id is not null then
      update public.equipment set count = coalesce(count, 0) + p_count where id = qty_row_id;
    else
      insert into public.equipment (
        brand, model, serialnumber, type, subtype, count, availability, location,
        technicalspecification, lengthinmeters, description
      )
      values (
        sample.brand, sample.model, 'QTY::AUTO::' || gen_random_uuid(), sample.type,
        sample.subtype, p_count, 'available', sample.location,
        sample.technicalspecification, sample.lengthinmeters, sample.description
      );
    end if;
    added := p_count;
  end if;

  -- Итог по модели считается той же формулой, что и агрегат каталога
  -- (fetch_equipment_models): сумма greatest(count, 0) по нормализованной паре.
  select coalesce(sum(greatest(e.count, 0)), 0)::integer into units_total
  from public.equipment e
  where lower(btrim(e.brand)) = lower(btrim(sample.brand))
    and lower(btrim(e.model)) = lower(btrim(sample.model));

  return jsonb_build_object('status', 'created', 'added', added, 'units_total', units_total);
end;
$function$;

-- Default privileges Supabase раздают EXECUTE каждой новой функции, в том числе
-- anon, — снимаем явно, как во всех миграциях проекта.
revoke all on function public.add_equipment_unit(uuid, text, integer) from public, anon;
grant execute on function public.add_equipment_unit(uuid, text, integer) to authenticated;
