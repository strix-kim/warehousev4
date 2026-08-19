begin;

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
  p_count integer
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_brand text;
  current_model text;
  updated_units integer;
begin
  if not (select private.has_any_role(array['technician', 'manager', 'admin'])) then
    raise exception 'Only the inventory team can edit equipment';
  end if;

  select e.brand, e.model
  into current_brand, current_model
  from public.equipment e
  where e.id = p_equipment_id;

  if not found then
    raise exception 'Equipment was not found';
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

  if p_count < 0 then
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
    location = nullif(btrim(p_location), ''),
    count = p_count,
    updated_at = now()
  where e.id = p_equipment_id;

  return jsonb_build_object(
    'equipment_id', p_equipment_id,
    'updated_model_units', updated_units
  );
end;
$$;

comment on function public.update_equipment_model_and_unit(uuid, text, text, text, text, text, text, text, text, text, integer)
  is 'Atomically updates shared model fields on every matching brand/model row and per-unit stock fields only on the selected row.';

revoke all on function public.update_equipment_model_and_unit(uuid, text, text, text, text, text, text, text, text, text, integer)
  from public, anon;
grant execute on function public.update_equipment_model_and_unit(uuid, text, text, text, text, text, text, text, text, text, integer)
  to authenticated, service_role;

commit;
