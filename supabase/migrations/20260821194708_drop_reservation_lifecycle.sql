-- Жизненный цикл списков (подтверждение → выдача → возврат) удаляется целиком.
--
-- Основание — решение прораба в с10 и данные прода: списков вне 'draft' 0,
-- reservation_status_history 5 строк, equipment_reservation_items 8 строк — всё
-- следы тестов. Подсистемой не пользовались ни разу с момента появления в с5.
--
-- ЧТО ОСТАЁТСЯ: reservation_start и reservation_end. Имя колонок обманывает —
-- это дата мероприятия, реквизит документа, а не бронь. На ней стоят карточка
-- реестра и фильтр периода.
--
-- ПОРЯДОК ВЫКАТКИ. Эта миграция применяется ТОЛЬКО ПОСЛЕ того, как код без
-- жизненного цикла уехал в прод: старый клиент просит reservation_status в
-- селекте списков, и снос колонки до выкатки уронил бы реестр всем.
--
-- Две RPC пересоздаются, а не удаляются: они пишут в equipment_reservation_items
-- и читают reservation_status, то есть таблицу и колонку нельзя снести из-под
-- работающего сохранения списков.

begin;

-- 1. Триггеры уходят первыми: log_reservation_status_change пишет в таблицу,
--    которую мы сейчас удалим, а guard_reservation_list_update запрещает
--    трогать поля цикла — включая их удаление задним числом.
drop trigger if exists trg_reservation_status_history on public.equipment_lists;
drop trigger if exists trg_guard_reservation_list_update on public.equipment_lists;
drop function if exists private.log_reservation_status_change();

-- 2. Охранный триггер пересоздаётся с ЕДИНСТВЕННОЙ уцелевшей проверкой:
--    подмена created_by к жизненному циклу отношения не имеет, и терять её
--    вместе с ним было бы тихой потерей защиты.
create or replace function private.guard_equipment_list_update()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if new.created_by is distinct from old.created_by then
    raise exception 'created_by cannot be changed';
  end if;
  return new;
end;
$function$;

revoke all on function private.guard_equipment_list_update() from public, anon;

create trigger trg_guard_equipment_list_update
before update on public.equipment_lists
for each row execute function private.guard_equipment_list_update();

drop function if exists private.guard_reservation_list_update();

-- 3. RPC жизненного цикла.
drop function if exists public.transition_equipment_list_status(uuid, text, text);
drop function if exists public.reservation_shortages(uuid);

-- 4. Создание списка — без резерва и без полей статуса.
create or replace function public.create_equipment_list_with_items(
  p_name text, p_description text, p_list_mode text,
  p_reservation_start date, p_reservation_end date, p_items jsonb
)
returns uuid
language plpgsql
set search_path to ''
as $function$
declare
  new_list_id uuid;
  legacy_ids uuid[];
  legacy_items jsonb;
begin
  if not (select private.is_app_member()) then
    raise exception 'Not an application member';
  end if;
  if nullif(btrim(p_name), '') is null then
    raise exception 'List name is required';
  end if;
  if p_list_mode not in ('specific', 'abstract') then
    raise exception 'Invalid list mode';
  end if;
  if (p_reservation_start is null) <> (p_reservation_end is null)
    or (p_reservation_start is not null and p_reservation_start > p_reservation_end) then
    raise exception 'Reservation dates must be both empty or form a valid range';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'At least one equipment item is required';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_items) item
    where coalesce(item->>'tracking_mode', '') in ('serialized', 'quantity')
      and (
        coalesce(item->>'equipment_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        or not exists (
          select 1 from public.equipment e where e.id = (item->>'equipment_id')::uuid
        )
      )
  ) then
    raise exception 'Serialized and quantity items require an existing equipment_id';
  end if;

  select coalesce(array_agg((item->>'equipment_id')::uuid), '{}'::uuid[])
  into legacy_ids
  from jsonb_array_elements(p_items) item
  where item->>'tracking_mode' = 'serialized';

  select coalesce(jsonb_agg(jsonb_build_object(
    'equipment_id', nullif(item->>'equipment_id', ''),
    'brand', item->>'brand',
    'model', item->>'model',
    'type', item->>'type',
    'subtype', item->>'subtype',
    'count', greatest(1, coalesce((item->>'count')::integer, 1)),
    'tracking_mode', item->>'tracking_mode'
  )), '[]'::jsonb)
  into legacy_items
  from jsonb_array_elements(p_items) item
  where item->>'tracking_mode' <> 'serialized';

  insert into public.equipment_lists (
    name, description, type, list_mode, equipment_ids, equipment_items,
    created_by, is_archived, metadata, reservation_start, reservation_end
  ) values (
    btrim(p_name), nullif(btrim(p_description), ''), 'custom', p_list_mode,
    legacy_ids, legacy_items, (select auth.uid()), false,
    jsonb_build_object('source', 'argo-warehouse-react'),
    p_reservation_start, p_reservation_end
  ) returning id into new_list_id;

  return new_list_id;
end;
$function$;

revoke all on function public.create_equipment_list_with_items(text, text, text, date, date, jsonb) from public, anon;
grant execute on function public.create_equipment_list_with_items(text, text, text, date, date, jsonb) to authenticated;

-- 5. Правка списка — без проверки статуса и без резерва. Ограничение «менять
--    можно только черновики» исчезает вместе с самим понятием черновика:
--    все сохранённые списки теперь равны и правятся одинаково.
create or replace function public.update_equipment_list_document(
  p_list_id uuid, p_name text, p_description text, p_client_name text, p_venue text,
  p_list_mode text, p_reservation_start date, p_reservation_end date, p_items jsonb
)
returns uuid
language plpgsql
set search_path to ''
as $function$
declare
  legacy_ids uuid[];
  legacy_items jsonb;
begin
  if not (select private.is_app_member()) then
    raise exception 'Not an application member';
  end if;

  perform 1 from public.equipment_lists where id = p_list_id for update;
  if not found then
    raise exception 'Equipment list not found';
  end if;
  if nullif(btrim(p_name), '') is null then
    raise exception 'List name is required';
  end if;
  if p_list_mode not in ('specific', 'abstract') then
    raise exception 'Invalid list mode';
  end if;
  if (p_reservation_start is null) <> (p_reservation_end is null)
    or (p_reservation_start is not null and p_reservation_start > p_reservation_end) then
    raise exception 'Reservation dates must be both empty or form a valid range';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'At least one equipment item is required';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_items) item
    where coalesce(item->>'tracking_mode', '') in ('serialized', 'quantity')
      and (
        coalesce(item->>'equipment_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        or not exists (
          select 1 from public.equipment e where e.id = (item->>'equipment_id')::uuid
        )
      )
  ) then
    raise exception 'Serialized and quantity items require an existing equipment_id';
  end if;

  select coalesce(array_agg((item->>'equipment_id')::uuid), '{}'::uuid[])
  into legacy_ids
  from jsonb_array_elements(p_items) item
  where item->>'tracking_mode' = 'serialized';

  select coalesce(jsonb_agg(jsonb_build_object(
    'equipment_id', nullif(item->>'equipment_id', ''),
    'brand', item->>'brand',
    'model', item->>'model',
    'type', item->>'type',
    'subtype', item->>'subtype',
    'count', greatest(1, coalesce((item->>'count')::integer, 1)),
    'tracking_mode', item->>'tracking_mode'
  )), '[]'::jsonb)
  into legacy_items
  from jsonb_array_elements(p_items) item
  where item->>'tracking_mode' <> 'serialized';

  update public.equipment_lists
  set
    name = btrim(p_name),
    description = nullif(btrim(p_description), ''),
    client_name = nullif(btrim(p_client_name), ''),
    venue = nullif(btrim(p_venue), ''),
    list_mode = p_list_mode,
    equipment_ids = legacy_ids,
    equipment_items = legacy_items,
    reservation_start = p_reservation_start,
    reservation_end = p_reservation_end
  where id = p_list_id;

  return p_list_id;
end;
$function$;

revoke all on function public.update_equipment_list_document(uuid, text, text, text, text, text, date, date, jsonb) from public, anon;
grant execute on function public.update_equipment_list_document(uuid, text, text, text, text, text, date, date, jsonb) to authenticated;

-- 6. Таблицы цикла. equipment_reservation_items хранила состав ВТОРОЙ копией —
--    оригинал лежит в equipment_lists.equipment_ids/equipment_items, и именно
--    его читает интерфейс. Терять состав списков удаление не может.
drop table if exists public.reservation_status_history;
drop table if exists public.equipment_reservation_items;

-- 7. INSERT-политика ссылается на reservation_status и три метки времени —
--    колонки не удалить, пока она их сторожит. CASCADE здесь опасен: он снёс бы
--    политику целиком, а таблица без INSERT-политики под RLS запрещает вставку
--    ВСЕМ. Поэтому политика пересоздаётся явно, и проверка «created_by — это ты»
--    в ней остаётся: к жизненному циклу она отношения не имеет.
drop policy if exists equipment_lists_insert_for_members on public.equipment_lists;
create policy equipment_lists_insert_for_members
on public.equipment_lists
for insert
to authenticated
with check (
  (select private.is_app_member())
  and created_by = (select auth.uid())
);

-- 8. Колонки статусов. reservation_start/reservation_end НЕ ТРОГАЕМ.
alter table public.equipment_lists
  drop column if exists reservation_status,
  drop column if exists confirmed_at,
  drop column if exists issued_at,
  drop column if exists returned_at,
  drop column if exists status_changed_at,
  drop column if exists status_changed_by,
  drop column if exists shortage_snapshot;

commit;
