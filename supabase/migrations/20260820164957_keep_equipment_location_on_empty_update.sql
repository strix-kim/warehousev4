-- equipment.location объявлена NOT NULL, а RPC писала в неё nullif(btrim(p_location), ''):
-- пустая локация от клиента роняла всю транзакцию правки без указания поля-виновника.
-- Оборона от гонки и старого клиента: пустое значение больше не затирает существующую
-- локацию, а молча оставляет её как есть. Тело функции скопировано из baseline
-- (00000000000000_baseline_remote_schema.sql:1200-1269), изменена одна строка — location.
-- Права не переопределяем: create or replace сохраняет выданный ранее grant execute.
create or replace function public.update_equipment_model_and_unit(
  p_equipment_id uuid, p_brand text, p_model text, p_type text, p_subtype text,
  p_technicalspecification text, p_lengthinmeters text, p_description text,
  p_availability text, p_location text, p_count integer)
 returns jsonb
 language plpgsql
 set search_path to ''
as $function$
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
    location = coalesce(nullif(btrim(p_location), ''), e.location),
    count = p_count,
    updated_at = now()
  where e.id = p_equipment_id;

  return jsonb_build_object(
    'equipment_id', p_equipment_id,
    'updated_model_units', updated_units
  );
end;
$function$;
