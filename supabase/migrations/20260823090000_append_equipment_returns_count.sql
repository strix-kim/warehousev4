-- Приёмка U35-б: «Добавлено» после третьего тапа не говорит «теперь 3 шт.» —
-- карточка нигде не называет количество. RPC и так держит строку списка под
-- for update, ей ничего не стоит вернуть итоговое число.
--
-- Возврат меняется с text на jsonb: {"status":"added","count":3}. Смена типа
-- возврата требует drop + create — create or replace на ней падает. Гранты
-- после drop выставляются заново.
--
-- Порядок выкатки соблюдён: клиент, понимающий ОБА формата (текст и jsonb),
-- уехал в прод раньше этой миграции. Стоимость окна наоборот была бы копеечной
-- (старый клиент показал бы «Добавлено» вместо «уже в списке» у серийной),
-- но канон дешевле исключений из него.
--
-- count возвращается только для количественной позиции: у серийной единицы
-- количество всегда 1, и «теперь 1 шт.» — шум.

drop function public.append_equipment_to_list(uuid, uuid, text);

create function public.append_equipment_to_list(
  p_list_id uuid,
  p_equipment_id uuid,
  p_tracking_mode text
)
returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  eq record;
  existing_items jsonb;
  new_count integer;
begin
  if not (select private.is_app_member()) then
    raise exception 'Not an application member';
  end if;
  if p_tracking_mode not in ('serialized', 'quantity') then
    raise exception 'Invalid tracking mode';
  end if;

  -- Блокировка строки списка: два одновременных добавления из двух вкладок
  -- выстраиваются в очередь, а не теряют одно из двух.
  select equipment_items into existing_items
  from public.equipment_lists
  where id = p_list_id
  for update;
  if not found then
    raise exception 'Equipment list not found';
  end if;

  select brand, model, type, subtype into eq
  from public.equipment
  where id = p_equipment_id;
  if not found then
    raise exception 'Equipment not found';
  end if;

  if p_tracking_mode = 'serialized' then
    if exists (
      select 1 from public.equipment_lists
      where id = p_list_id and p_equipment_id = any(equipment_ids)
    ) then
      return jsonb_build_object('status', 'already');
    end if;
    update public.equipment_lists
    set equipment_ids = array_append(coalesce(equipment_ids, '{}'::uuid[]), p_equipment_id)
    where id = p_list_id;
    return jsonb_build_object('status', 'added');
  end if;

  -- Количественная позиция уже стоит в списке → +1 к её count: «добавить ещё
  -- одну» — осмысленное действие, в отличие от дубля серийной единицы.
  select greatest(1, coalesce((item->>'count')::integer, 1)) + 1 into new_count
  from jsonb_array_elements(coalesce(existing_items, '[]'::jsonb)) item
  where item->>'tracking_mode' = 'quantity'
    and item->>'equipment_id' = p_equipment_id::text
  limit 1;

  if new_count is not null then
    update public.equipment_lists
    set equipment_items = (
      select jsonb_agg(
        case
          when item->>'tracking_mode' = 'quantity'
            and item->>'equipment_id' = p_equipment_id::text
          then jsonb_set(item, '{count}', to_jsonb(new_count))
          else item
        end)
      from jsonb_array_elements(equipment_items) item
    )
    where id = p_list_id;
    return jsonb_build_object('status', 'added', 'count', new_count);
  end if;

  update public.equipment_lists
  set equipment_items = coalesce(equipment_items, '[]'::jsonb) || jsonb_build_object(
    'equipment_id', p_equipment_id,
    'brand', eq.brand,
    'model', eq.model,
    'type', eq.type,
    'subtype', eq.subtype,
    'count', 1,
    'tracking_mode', 'quantity'
  )
  where id = p_list_id;
  return jsonb_build_object('status', 'added', 'count', 1);
end;
$function$;

-- Default privileges Supabase раздают EXECUTE каждой новой функции, в том числе
-- anon, — снимаем явно, как во всех миграциях проекта.
revoke all on function public.append_equipment_to_list(uuid, uuid, text) from public, anon;
grant execute on function public.append_equipment_to_list(uuid, uuid, text) to authenticated;
