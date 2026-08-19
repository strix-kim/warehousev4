begin;

create or replace function public.update_equipment_list_document(
  p_list_id uuid,
  p_name text,
  p_description text,
  p_client_name text,
  p_venue text,
  p_list_mode text,
  p_reservation_start date,
  p_reservation_end date,
  p_items jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_status text;
  legacy_ids uuid[];
  legacy_items jsonb;
begin
  if not (select private.is_app_member()) then
    raise exception 'Not an application member';
  end if;

  select reservation_status
  into current_status
  from public.equipment_lists
  where id = p_list_id
  for update;

  if not found then
    raise exception 'Equipment list not found';
  end if;
  if current_status <> 'draft' then
    raise exception 'Only draft equipment lists can be edited';
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

  delete from public.equipment_reservation_items
  where list_id = p_list_id;

  insert into public.equipment_reservation_items (
    list_id, equipment_id, brand, model, type, subtype,
    tracking_mode, requested_count, created_by
  )
  select
    p_list_id,
    case when coalesce(item->>'equipment_id', '') ~* '^[0-9a-f-]{36}$'
      then (item->>'equipment_id')::uuid else null end,
    btrim(item->>'brand'),
    btrim(item->>'model'),
    btrim(item->>'type'),
    btrim(item->>'subtype'),
    item->>'tracking_mode',
    greatest(1, coalesce((item->>'count')::integer, 1)),
    (select auth.uid())
  from jsonb_array_elements(p_items) item;

  return p_list_id;
end;
$$;

revoke all on function public.update_equipment_list_document(
  uuid, text, text, text, text, text, date, date, jsonb
) from public, anon;

grant execute on function public.update_equipment_list_document(
  uuid, text, text, text, text, text, date, date, jsonb
) to authenticated, service_role;

commit;
