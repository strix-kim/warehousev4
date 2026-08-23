-- U29: каталог перестаёт быть «1 481 строка, из них 596 — один и тот же ITC».
-- Строка выдачи — МОДЕЛЬ (бренд+модель) со счётчиками штук; единицы человек
-- смотрит дровером внутри модели. Агрегат считает база: тянуть весь каталог в
-- браузер ради группировки — ровно то, от чего U29 лечит.
--
-- Семантика поиска намеренно построчная, как в прежнем каталоге: модель
-- попадает в выдачу, если у неё есть ЕДИНИЦА, отвечающая фильтрам и всем
-- термам разом. Так поиск по серийнику находит модель, внутри которой стоит
-- единица. Термов до шести, каждый обязан совпасть — один в один клиентская
-- логика fetchEquipment, которую этот RPC заменяет.
--
-- Счётчики модели считаются по ВСЕМ её строкам, а не по совпавшим с фильтром:
-- карточка описывает модель, и «596 штук» не должно превращаться в «1», когда
-- модель нашлась по серийнику одной единицы.
--
-- security invoker: RLS-политика чтения equipment применяется как есть.

create function public.fetch_equipment_models(
  p_search text,
  p_type text,
  p_subtype text,
  p_availability text,
  p_limit integer,
  p_offset integer
)
returns jsonb
language plpgsql
stable
set search_path to ''
as $function$
declare
  terms text[];
  result jsonb;
begin
  if not (select private.is_app_member()) then
    raise exception 'Not an application member';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'Invalid page size';
  end if;
  if p_offset is null or p_offset < 0 then
    raise exception 'Invalid offset';
  end if;

  -- Терм — текст, а не шаблон: % _ \ экранируются перед подстановкой в ilike.
  select coalesce(array_agg(term), '{}'::text[]) into terms
  from (
    select regexp_replace(word, '([\\%_])', '\\\1', 'g') as term
    from unnest(regexp_split_to_array(btrim(coalesce(p_search, '')), '\s+')) word
    where word <> ''
    limit 6
  ) prepared;

  with matching as (
    select distinct e.brand, e.model
    from public.equipment e
    where (p_type = '' or e.type = p_type)
      and (p_subtype = '' or e.subtype = p_subtype)
      and (p_availability = '' or e.availability = p_availability)
      -- «нет терма, который НЕ совпал» = «каждый терм совпал хоть по одному полю».
      and not exists (
        select 1 from unnest(terms) term
        where e.brand not ilike '%' || term || '%'
          and e.model not ilike '%' || term || '%'
          and e.type not ilike '%' || term || '%'
          and e.subtype not ilike '%' || term || '%'
          and e.serialnumber not ilike '%' || term || '%'
      )
  ),
  aggregated as (
    select
      e.brand,
      e.model,
      -- Данные модели у всех её строк одинаковы (правка модели меняет их разом),
      -- max() — просто способ выбрать значение без второй группировки.
      max(e.type) as type,
      max(e.subtype) as subtype,
      count(*)::integer as rows_total,
      coalesce(sum(greatest(e.count, 0)), 0)::integer as units_total,
      coalesce(sum(greatest(e.count, 0)) filter (where e.availability = 'available'), 0)::integer as units_available
    from public.equipment e
    join matching m on m.brand = e.brand and m.model = e.model
    group by e.brand, e.model
  )
  select jsonb_build_object(
    'total_models', (select count(*) from aggregated),
    'total_units', (select coalesce(sum(units_total), 0) from aggregated),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'brand', page.brand,
        'model', page.model,
        'type', page.type,
        'subtype', page.subtype,
        'rows_total', page.rows_total,
        'units_total', page.units_total,
        'units_available', page.units_available
      ) order by page.type, page.brand, page.model)
      from (
        select * from aggregated
        order by type, brand, model
        limit p_limit offset p_offset
      ) page
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$function$;

-- Default privileges Supabase раздают EXECUTE каждой новой функции, в том числе
-- anon, — снимаем явно, как во всех миграциях проекта.
revoke all on function public.fetch_equipment_models(text, text, text, text, integer, integer) from public, anon;
grant execute on function public.fetch_equipment_models(text, text, text, text, integer, integer) to authenticated;
