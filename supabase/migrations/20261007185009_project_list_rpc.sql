-- Списки оборудования на мероприятии (с54, план event-s53 §1.6).
-- Новые имена, а не новая сигнатура старых: перегрузка дала бы PGRST203, а
-- открытые вкладки со старым бандлом продолжают звать create/update_equipment_list_document
-- до сноса доноров (шаг 9 плана). Все функции — security invoker: права и
-- видимость решают политики таблиц, а не владелец функции.

-- Общее тело создания и правки. В private: PostgREST эту схему не публикует,
-- наружу смотрят только две обёртки ниже.
--   p_list_id null        → новый список, иначе правка существующего;
--   p_project не null     → реквизиты мероприятия: без p_project_id создаётся
--                           новое, с ним — правятся реквизиты существующего;
--   p_project_id без p_project → привязка к мероприятию как есть;
--   оба null              → список без мероприятия (черновой набор).
-- p_project — объект {name, client_name, venue_id, date_from, date_to}; все пять
-- полей пишутся как пришли (отсутствующий ключ = null). description мероприятия
-- редактор списка не трогает.
create function private.save_project_equipment_list(
  p_list_id uuid,
  p_project_id uuid,
  p_project jsonb,
  p_name text,
  p_description text,
  p_list_mode text,
  p_items jsonb
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_list_id uuid := p_list_id;
  v_project_id uuid := p_project_id;
  legacy_ids uuid[];
  legacy_items jsonb;
begin
  if not (select private.is_app_member()) then
    raise exception 'Not an application member';
  end if;

  if p_list_id is not null then
    perform 1 from public.equipment_lists where id = p_list_id for update;
    if not found then
      raise exception 'Equipment list not found';
    end if;
  end if;

  if nullif(btrim(p_name), '') is null then
    raise exception 'List name is required';
  end if;
  if p_list_mode not in ('specific', 'abstract') then
    raise exception 'Invalid list mode';
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

  -- Мероприятие пишется под политиками projects: участник без рабочей роли
  -- получит 42501 и список не сохранится — одна транзакция.
  if p_project is not null then
    if jsonb_typeof(p_project) <> 'object' then
      raise exception 'Project must be an object';
    end if;
    if v_project_id is null then
      insert into public.projects (name, client_name, venue_id, date_from, date_to)
      values (
        p_project->>'name',
        p_project->>'client_name',
        nullif(p_project->>'venue_id', '')::uuid,
        nullif(p_project->>'date_from', '')::date,
        nullif(p_project->>'date_to', '')::date
      )
      returning id into v_project_id;
    else
      update public.projects
      set
        name = p_project->>'name',
        client_name = p_project->>'client_name',
        venue_id = nullif(p_project->>'venue_id', '')::uuid,
        date_from = nullif(p_project->>'date_from', '')::date,
        date_to = nullif(p_project->>'date_to', '')::date
      where id = v_project_id;
      if not found then
        raise exception 'Project not found';
      end if;
    end if;
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

  if v_list_id is null then
    insert into public.equipment_lists (
      name, description, type, list_mode, equipment_ids, equipment_items,
      created_by, is_archived, metadata, project_id
    ) values (
      btrim(p_name), nullif(btrim(p_description), ''), 'custom', p_list_mode,
      legacy_ids, legacy_items, (select auth.uid()), false,
      jsonb_build_object('source', 'argo-warehouse-react'),
      v_project_id
    ) returning id into v_list_id;
  else
    update public.equipment_lists
    set
      name = btrim(p_name),
      description = nullif(btrim(p_description), ''),
      list_mode = p_list_mode,
      equipment_ids = legacy_ids,
      equipment_items = legacy_items,
      project_id = v_project_id
    where id = v_list_id;
  end if;

  return jsonb_build_object('list_id', v_list_id, 'project_id', v_project_id);
end;
$$;

revoke execute on function private.save_project_equipment_list(uuid, uuid, jsonb, text, text, text, jsonb)
  from public, anon;
grant execute on function private.save_project_equipment_list(uuid, uuid, jsonb, text, text, text, jsonb)
  to authenticated;

create function public.create_project_equipment_list(
  p_project_id uuid,
  p_project jsonb,
  p_name text,
  p_description text,
  p_list_mode text,
  p_items jsonb
)
returns jsonb
language sql
set search_path = ''
as $$
  select private.save_project_equipment_list(
    null, p_project_id, p_project, p_name, p_description, p_list_mode, p_items
  );
$$;

create function public.update_project_equipment_list(
  p_list_id uuid,
  p_project_id uuid,
  p_project jsonb,
  p_name text,
  p_description text,
  p_list_mode text,
  p_items jsonb
)
returns jsonb
language plpgsql
set search_path = ''
as $$
begin
  -- null здесь означал бы «создать»: правка без id — ошибка вызова, а не новый список.
  if p_list_id is null then
    raise exception 'Equipment list not found';
  end if;
  return private.save_project_equipment_list(
    p_list_id, p_project_id, p_project, p_name, p_description, p_list_mode, p_items
  );
end;
$$;

revoke execute on function public.create_project_equipment_list(uuid, jsonb, text, text, text, jsonb)
  from public, anon;
grant execute on function public.create_project_equipment_list(uuid, jsonb, text, text, text, jsonb)
  to authenticated;
revoke execute on function public.update_project_equipment_list(uuid, uuid, jsonb, text, text, text, jsonb)
  from public, anon;
grant execute on function public.update_project_equipment_list(uuid, uuid, jsonb, text, text, text, jsonb)
  to authenticated;

-- Реестр списков страницей. RPC, а не embed: поиск идёт по полям трёх таблиц
-- (имя списка, имя мероприятия, заказчик, площадка), а PostgREST не строит or
-- поперёк родителя и встроенного ресурса.
-- Период меряется по дате НАЧАЛА мероприятия: список без мероприятия или без
-- даты в любой период не попадает — сравнение с NULL ложно, то же правило, что
-- было у reservation_start.
create function public.fetch_equipment_lists_page(
  p_search text,
  p_from date,
  p_to date,
  p_limit integer,
  p_offset integer
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  pattern text;
  result jsonb;
begin
  if not (select private.is_app_member()) then
    raise exception 'Not an application member';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 200 then
    raise exception 'Invalid page size';
  end if;
  if p_offset is null or p_offset < 0 then
    raise exception 'Invalid offset';
  end if;

  -- Запрос — текст, а не шаблон: % _ \ экранируются перед подстановкой в ilike.
  if btrim(coalesce(p_search, '')) <> '' then
    pattern := '%' || regexp_replace(btrim(p_search), '([\\%_])', '\\\1', 'g') || '%';
  end if;

  with matching as (
    select
      l.id, l.name, l.description, l.type, l.list_mode, l.equipment_ids, l.equipment_items,
      l.created_at, l.updated_at, l.is_archived, l.project_id,
      case when p.id is null then null else jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'client_name', p.client_name,
        'date_from', p.date_from,
        'date_to', p.date_to,
        'venue', case when v.id is null then null else jsonb_build_object(
          'id', v.id, 'name', v.name, 'city', v.city, 'country', v.country
        ) end
      ) end as project
    from public.equipment_lists l
    left join public.projects p on p.id = l.project_id
    left join public.venues v on v.id = p.venue_id
    where (
        pattern is null
        or l.name ilike pattern
        or p.name ilike pattern
        or p.client_name ilike pattern
        or v.name ilike pattern
      )
      and (p_from is null or p.date_from >= p_from)
      and (p_to is null or p.date_from <= p_to)
  )
  select jsonb_build_object(
    'total', (select count(*) from matching),
    'rows', coalesce((
      select jsonb_agg(to_jsonb(page) order by page.created_at desc, page.id desc)
      from (
        -- created_at не уникален (импорт кладёт пачку одной секундой): без id
        -- строка могла попасть на две соседние страницы либо ни на одну.
        select * from matching
        order by created_at desc, id desc
        limit p_limit offset p_offset
      ) page
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke execute on function public.fetch_equipment_lists_page(text, date, date, integer, integer)
  from public, anon;
grant execute on function public.fetch_equipment_lists_page(text, date, date, integer, integer)
  to authenticated;

notify pgrst, 'reload schema';
