begin;

-- Legacy modules are no longer part of the compact warehouse product. Keep
-- their data/schema intact, but remove them from the authenticated Data API.
revoke all on table public.events, public.mount_points, public.reports from authenticated;
revoke all on table public.users from authenticated;

-- Trigger functions are internal implementation details and should not be
-- callable through PostgREST/RPC. Pin the lookup path to prevent object-shadowing.
alter function public.update_updated_at_column() set search_path = '';
alter function public.update_equipment_lists_updated_at() set search_path = '';
alter function public.validate_technical_duties_status() set search_path = '';

create or replace function public.update_mount_points_count()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  affected_event_id uuid;
begin
  affected_event_id := coalesce(new.event_id, old.event_id);
  update public.events
  set mount_points_count = (
    select count(*) from public.mount_points where event_id = affected_event_id
  )
  where id = affected_event_id;
  return coalesce(new, old);
end;
$$;

revoke execute on function public.update_updated_at_column() from public, anon, authenticated;
revoke execute on function public.update_equipment_lists_updated_at() from public, anon, authenticated;
revoke execute on function public.validate_technical_duties_status() from public, anon, authenticated;
revoke execute on function public.update_mount_points_count() from public, anon, authenticated;

-- PostgreSQL does not create indexes for referencing foreign-key columns.
create index if not exists equipment_lists_mount_point_id_idx
  on public.equipment_lists(mount_point_id)
  where mount_point_id is not null;
create index if not exists equipment_lists_status_changed_by_idx
  on public.equipment_lists(status_changed_by)
  where status_changed_by is not null;
create index if not exists equipment_movements_changed_by_idx
  on public.equipment_movements(changed_by)
  where changed_by is not null;
create index if not exists equipment_reservation_items_created_by_idx
  on public.equipment_reservation_items(created_by);
create index if not exists reports_event_id_idx
  on public.reports(event_id)
  where event_id is not null;
create index if not exists reservation_status_history_changed_by_idx
  on public.reservation_status_history(changed_by)
  where changed_by is not null;

commit;
