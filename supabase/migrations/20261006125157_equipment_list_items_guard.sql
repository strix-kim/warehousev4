-- Веха 3, «клиенту не верим», дыры (б) и (в) из 02-decisions §5: текст позиции
-- и её количество в equipment_items решает база, а не клиентский JSON.
--
-- Почему триггер, а не правка RPC: у authenticated есть прямой grant update на
-- equipment_lists, и политика пускает любого члена приложения. Проверка в теле
-- create_equipment_list_with_items / update_equipment_list_document /
-- append_equipment_to_list обходится одним update из консоли. Таблица — единственное
-- место, через которое идёт ЛЮБАЯ запись.
--
-- Почему не CHECK на колонку: функцию в CHECK исполняет текущий пользователь, и после
-- обязательного revoke из private она упала бы «permission denied»; триггерная
-- функция под definer этой проблемы не имеет.
--
-- Правила для каждого элемента массива (порядок элементов сохраняется):
--   * count — целое число от 1 до 999, иначе 23514. Число 999 — продуктовое («четыре
--     знака — опечатка»), MAX_ITEM_COUNT на клиенте его зеркалит. Со складским
--     остатком count НЕ сверяется намеренно: список — план на дату мероприятия,
--     нехватка выражается planned-позицией, а не отказом.
--   * equipment_id есть и строка в equipment жива → brand/model/type/subtype
--     ПЕРЕЗАПИСЫВАЮТСЯ из equipment, что бы ни прислал клиент. Так уже делает
--     append_equipment_to_list; читатели (карточка, Excel) и так берут подпись по id,
--     снимок в jsonb — запасной вариант для печати.
--   * equipment_id есть, строки нет («сирота»: оборудование удалили после сохранения)
--     → на UPDATE текст берётся из элемента OLD с тем же id, так что сирота живёт со
--     своим последним снимком, а подделать его прямой записью нельзя. Нет такого
--     элемента в OLD (новая ссылка в никуда) → 23503.
--   * equipment_id пуст при tracking_mode serialized/quantity → 23503 (то же правило,
--     что было только в RPC). planned без id — свободная строка плана, остаётся как есть.
--
-- UPDATE OF equipment_items срабатывает и когда колонка просто стоит в SET без
-- изменения (append серийной единицы меняет только equipment_ids), поэтому первая
-- проверка — «массив не изменился → выход»: иначе старая сирота заблокировала бы
-- любое сохранение соседних полей.
--
-- Серийные позиции в equipment_items не лежат (они в equipment_ids), поэтому правило
-- о тексте касается quantity-позиций. Существующие строки триггер не проверяет:
-- аудит с45 (6 списков, 42 позиции) не нашёл ни мусорного count, ни сирот, ни
-- позиций без id, ни расхождений текста.

begin;

create or replace function private.guard_equipment_list_items()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  item jsonb;
  old_item jsonb;
  rebuilt jsonb := '[]'::jsonb;
  id_text text;
  mode text;
  eq record;
begin
  if new.equipment_items is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.equipment_items is not distinct from old.equipment_items then
    return new;
  end if;
  if jsonb_typeof(new.equipment_items) <> 'array' then
    raise exception using errcode = 'check_violation',
      message = 'equipment_items must be a JSON array';
  end if;

  for item in select value from jsonb_array_elements(new.equipment_items) loop
    if jsonb_typeof(item) <> 'object' then
      raise exception using errcode = 'check_violation',
        message = 'equipment_items element must be a JSON object';
    end if;

    -- (в) количество: целое 1..999. jsonb_typeof(null) даёт null, отсюда coalesce.
    if coalesce(jsonb_typeof(item->'count'), 'missing') <> 'number'
      or (item->>'count')::numeric <> floor((item->>'count')::numeric)
      or (item->>'count')::numeric < 1
      or (item->>'count')::numeric > 999 then
      raise exception using errcode = 'check_violation',
        message = 'Item count must be an integer between 1 and 999',
        constraint = 'equipment_list_items_count_range';
    end if;

    id_text := nullif(btrim(coalesce(item->>'equipment_id', '')), '');
    mode := coalesce(item->>'tracking_mode', '');

    if id_text is null then
      if mode in ('serialized', 'quantity') then
        raise exception using errcode = 'foreign_key_violation',
          message = 'Serialized and quantity items require an existing equipment_id';
      end if;
      rebuilt := rebuilt || item;
      continue;
    end if;

    if id_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception using errcode = 'check_violation',
        message = 'equipment_id must be a uuid';
    end if;

    -- (б) текст позиции — из склада, не от клиента.
    select brand, model, type, subtype into eq
    from public.equipment
    where id = id_text::uuid;

    if found then
      rebuilt := rebuilt || (item || jsonb_build_object(
        'brand', eq.brand, 'model', eq.model, 'type', eq.type, 'subtype', eq.subtype));
      continue;
    end if;

    -- Сирота: последний снимок хранится в OLD, подменить его нельзя.
    old_item := null;
    if tg_op = 'UPDATE' and jsonb_typeof(old.equipment_items) = 'array' then
      select o into old_item
      from jsonb_array_elements(old.equipment_items) o
      where o->>'equipment_id' = id_text
      limit 1;
    end if;
    if old_item is null then
      raise exception using errcode = 'foreign_key_violation',
        message = 'Equipment not found',
        constraint = 'equipment_list_items_equipment_id';
    end if;
    rebuilt := rebuilt || (item || jsonb_build_object(
      'brand', old_item->'brand', 'model', old_item->'model',
      'type', old_item->'type', 'subtype', old_item->'subtype'));
  end loop;

  new.equipment_items := rebuilt;
  return new;
end;
$function$;

-- Триггерной функции EXECUTE вызывающего не нужен (право проверяется при CREATE
-- TRIGGER); revoke обязателен из-за default privileges Supabase (gotchas §3).
revoke all on function private.guard_equipment_list_items() from public, anon, authenticated;

-- Без drop … if exists: MCP-коннектор отклоняет вызовы со словом drop (с45), а
-- в с44 drop trigger прошёл только через SQL Editor руками прораба.
create trigger trg_guard_equipment_list_items
before insert or update of equipment_items on public.equipment_lists
for each row execute function private.guard_equipment_list_items();

commit;
