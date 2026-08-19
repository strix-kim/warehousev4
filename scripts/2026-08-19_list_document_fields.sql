begin;

alter table public.equipment_lists
  add column if not exists client_name text,
  add column if not exists venue text;

comment on column public.equipment_lists.client_name is
  'Customer or event organizer shown in the operational equipment document.';
comment on column public.equipment_lists.venue is
  'Venue or event location shown in the operational equipment document.';

create or replace function public.create_equipment_list_document(
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
  new_list_id uuid;
begin
  new_list_id := public.create_equipment_list_with_items(
    p_name,
    p_description,
    p_list_mode,
    p_reservation_start,
    p_reservation_end,
    p_items
  );

  update public.equipment_lists
  set
    client_name = nullif(btrim(p_client_name), ''),
    venue = nullif(btrim(p_venue), '')
  where id = new_list_id;

  if not found then
    raise exception 'Created equipment list could not be updated';
  end if;

  return new_list_id;
end;
$$;

revoke all on function public.create_equipment_list_document(
  text, text, text, text, text, date, date, jsonb
) from public, anon;

grant execute on function public.create_equipment_list_document(
  text, text, text, text, text, date, date, jsonb
) to authenticated, service_role;

commit;
