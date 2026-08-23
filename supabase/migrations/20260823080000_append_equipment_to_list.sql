-- U35-б: путь «нашёл в каталоге → добавил в список» одной кнопкой.
--
-- Почему НЕ update_equipment_list_document. Тот заменяет документ целиком:
-- кнопке из каталога пришлось бы сначала стянуть весь список на клиент, а потом
-- отправить его обратно — и затереть параллельную правку в редакторе. Точечный
-- append под for update ничего, кроме одной позиции, не трогает.
--
-- Почему brand/model берутся из equipment, а не из параметров. Правило 2
-- CLAUDE.md («клиенту не верим»): document-RPC уже принимают эти поля дословно
-- из клиентского JSON, и это записанная дыра бэклога. Новый путь её не
-- расширяет: клиент называет только ЧТО добавить (id) и КАК оно учитывается,
-- остальное сервер читает сам.
--
-- p_tracking_mode передаёт клиент осознанно: серверного разбора serialnumber
-- (QTY::…, AUTO-…) в базе нет, есть только TypeScript-парсер и его копия в
-- давнем SQL-бэкфилле. Третья копия парсера хуже, чем доверие клиенту в поле,
-- которое влияет лишь на ФОРМУ хранения позиции, а не на права.
--
-- Возврат: 'added' — позиция добавлена (для количественной — в том числе +1 к
-- уже стоящей); 'already' — серийная единица уже в списке, состав не изменён.
-- 'already' — не ошибка: повторное нажатие не должно показывать отказ.

create or replace function public.append_equipment_to_list(
  p_list_id uuid,
  p_equipment_id uuid,
  p_tracking_mode text
)
returns text
language plpgsql
set search_path to ''
as $function$
declare
  eq record;
  existing_items jsonb;
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
      return 'already';
    end if;
    update public.equipment_lists
    set equipment_ids = array_append(coalesce(equipment_ids, '{}'::uuid[]), p_equipment_id)
    where id = p_list_id;
    return 'added';
  end if;

  -- Количественная позиция уже стоит в списке → +1 к её count: «добавить ещё
  -- одну» — осмысленное действие, в отличие от дубля серийной единицы.
  if exists (
    select 1 from jsonb_array_elements(coalesce(existing_items, '[]'::jsonb)) item
    where item->>'tracking_mode' = 'quantity'
      and item->>'equipment_id' = p_equipment_id::text
  ) then
    update public.equipment_lists
    set equipment_items = (
      select jsonb_agg(
        case
          when item->>'tracking_mode' = 'quantity'
            and item->>'equipment_id' = p_equipment_id::text
          then jsonb_set(item, '{count}', to_jsonb(greatest(1, coalesce((item->>'count')::integer, 1)) + 1))
          else item
        end)
      from jsonb_array_elements(equipment_items) item
    )
    where id = p_list_id;
    return 'added';
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
  return 'added';
end;
$function$;

-- Default privileges Supabase раздают EXECUTE каждой новой функции, в том числе
-- anon, — снимаем явно, как во всех миграциях проекта.
revoke all on function public.append_equipment_to_list(uuid, uuid, text) from public, anon;
grant execute on function public.append_equipment_to_list(uuid, uuid, text) to authenticated;
