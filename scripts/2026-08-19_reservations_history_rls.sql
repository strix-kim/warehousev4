begin;

-- Authorization helpers live outside the exposed API schema. They always bind
-- authorization to the current JWT user and never trust user_metadata.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.is_app_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.users u
    where u.id = (select auth.uid())
  );
$$;

create or replace function private.has_any_role(allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.users u
    where u.id = (select auth.uid())
      and u.role::text = any (allowed_roles)
  );
$$;

revoke all on function private.is_app_member() from public, anon;
revoke all on function private.has_any_role(text[]) from public, anon;
grant execute on function private.is_app_member() to authenticated;
grant execute on function private.has_any_role(text[]) to authenticated;

-- Reservation lifecycle is stored on the existing list to preserve old URLs,
-- exports, and list data.
alter table public.equipment_lists
  add column if not exists reservation_status text not null default 'draft',
  add column if not exists reservation_start date,
  add column if not exists reservation_end date,
  add column if not exists confirmed_at timestamptz,
  add column if not exists issued_at timestamptz,
  add column if not exists returned_at timestamptz,
  add column if not exists status_changed_at timestamptz not null default now(),
  add column if not exists status_changed_by uuid,
  add column if not exists shortage_snapshot jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'equipment_lists_reservation_status_check'
      and conrelid = 'public.equipment_lists'::regclass
  ) then
    alter table public.equipment_lists
      add constraint equipment_lists_reservation_status_check
      check (reservation_status in ('draft', 'confirmed', 'issued', 'returned'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'equipment_lists_reservation_dates_check'
      and conrelid = 'public.equipment_lists'::regclass
  ) then
    alter table public.equipment_lists
      add constraint equipment_lists_reservation_dates_check
      check (
        (reservation_start is null and reservation_end is null)
        or (
          reservation_start is not null
          and reservation_end is not null
          and reservation_start <= reservation_end
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'equipment_lists_status_changed_by_fkey'
      and conrelid = 'public.equipment_lists'::regclass
  ) then
    alter table public.equipment_lists
      add constraint equipment_lists_status_changed_by_fkey
      foreign key (status_changed_by) references auth.users(id) on delete set null;
  end if;
end $$;

create table if not exists public.equipment_reservation_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.equipment_lists(id) on delete cascade,
  equipment_id uuid references public.equipment(id) on delete set null,
  brand text not null,
  model text not null,
  type text not null,
  subtype text not null,
  tracking_mode text not null,
  requested_count integer not null default 1,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint equipment_reservation_items_tracking_check
    check (tracking_mode in ('serialized', 'quantity', 'planned')),
  constraint equipment_reservation_items_count_check check (requested_count > 0),
  constraint equipment_reservation_items_equipment_check
    check (
      (tracking_mode = 'planned' and equipment_id is null)
      or (tracking_mode in ('serialized', 'quantity') and equipment_id is not null)
    ),
  constraint equipment_reservation_items_list_equipment_key unique (list_id, equipment_id)
);

create table if not exists public.reservation_status_history (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.equipment_lists(id) on delete cascade,
  from_status text,
  to_status text not null,
  note text,
  shortage_snapshot jsonb not null default '[]'::jsonb,
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now(),
  constraint reservation_status_history_from_check
    check (from_status is null or from_status in ('draft', 'confirmed', 'issued', 'returned')),
  constraint reservation_status_history_to_check
    check (to_status in ('draft', 'confirmed', 'issued', 'returned'))
);

create table if not exists public.equipment_movements (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  list_id uuid references public.equipment_lists(id) on delete set null,
  movement_type text not null,
  quantity_delta integer not null default 0,
  quantity_before integer,
  quantity_after integer,
  status_before text,
  status_after text,
  note text,
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint equipment_movements_type_check
    check (movement_type in (
      'created', 'quantity_changed', 'status_changed',
      'quantity_and_status_changed', 'status_normalized', 'issued', 'returned'
    ))
);

create index if not exists equipment_reservation_items_list_idx
  on public.equipment_reservation_items(list_id);
create index if not exists equipment_reservation_items_equipment_idx
  on public.equipment_reservation_items(equipment_id)
  where equipment_id is not null;
create index if not exists equipment_reservation_items_model_idx
  on public.equipment_reservation_items (
    lower(btrim(brand)), lower(btrim(model)), lower(btrim(type)), lower(btrim(subtype))
  );
create index if not exists equipment_lists_reservation_window_idx
  on public.equipment_lists(reservation_status, reservation_start, reservation_end)
  where reservation_status in ('confirmed', 'issued');
create index if not exists equipment_lists_created_by_idx
  on public.equipment_lists(created_by);
create index if not exists equipment_movements_equipment_changed_idx
  on public.equipment_movements(equipment_id, changed_at desc);
create index if not exists equipment_movements_list_idx
  on public.equipment_movements(list_id)
  where list_id is not null;
create index if not exists reservation_status_history_list_changed_idx
  on public.reservation_status_history(list_id, changed_at desc);

-- Normalize status values before adding the constraint. The old value is kept
-- in the immutable movement log.
create temporary table equipment_status_normalization on commit drop as
select
  id,
  count as quantity,
  availability as old_status,
  case
    when availability in ('В наличии', 'available', 'В н�личии') then 'available'
    when availability = 'Не на складе' then 'unavailable'
    when availability = 'Необходима диагностика' then 'diagnostics'
    when availability in ('unavailable', 'diagnostics', 'issued') then availability
    else 'unavailable'
  end as new_status
from public.equipment;

update public.equipment e
set availability = n.new_status
from equipment_status_normalization n
where e.id = n.id
  and e.availability is distinct from n.new_status;

insert into public.equipment_movements (
  equipment_id, movement_type, quantity_delta, quantity_before, quantity_after,
  status_before, status_after, note, metadata
)
select
  id, 'status_normalized', 0, quantity, quantity,
  old_status, new_status, 'Нормализация старого статуса оборудования',
  jsonb_build_object('migration', '2026-08-19_reservations_history_rls')
from equipment_status_normalization
where old_status is distinct from new_status;

alter table public.equipment alter column availability set default 'available';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'equipment_availability_check'
      and conrelid = 'public.equipment'::regclass
  ) then
    alter table public.equipment
      add constraint equipment_availability_check
      check (availability in ('available', 'unavailable', 'diagnostics', 'issued'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'equipment_count_nonnegative_check'
      and conrelid = 'public.equipment'::regclass
  ) then
    alter table public.equipment
      add constraint equipment_count_nonnegative_check check (count >= 0);
  end if;
end $$;

-- Backfill normalized reservation lines from both legacy storage formats.
insert into public.equipment_reservation_items (
  list_id, equipment_id, brand, model, type, subtype,
  tracking_mode, requested_count, created_by, created_at, updated_at
)
select
  l.id,
  e.id,
  e.brand,
  e.model,
  e.type,
  e.subtype,
  case
    when e.count > 1
      or e.serialnumber like 'QTY::%'
      or e.serialnumber like 'AUTO-%'
      or lower(btrim(e.serialnumber)) in ('', 'n/a', 'na', 'нет', 'без номера', 'б/н', 'none', 'null', '-')
      or e.serialnumber ~ '^0+$'
    then 'quantity'
    else 'serialized'
  end,
  1,
  l.created_by,
  coalesce(l.created_at, now()),
  coalesce(l.updated_at, l.created_at, now())
from public.equipment_lists l
cross join lateral unnest(l.equipment_ids) equipment_id
join public.equipment e on e.id = equipment_id
on conflict (list_id, equipment_id) do nothing;

insert into public.equipment_reservation_items (
  list_id, equipment_id, brand, model, type, subtype,
  tracking_mode, requested_count, created_by, created_at, updated_at
)
select
  l.id,
  case
    when coalesce(item->>'tracking_mode', case when l.list_mode = 'abstract' then 'planned' else 'quantity' end) = 'quantity'
      then (item->>'equipment_id')::uuid
    else null
  end,
  btrim(item->>'brand'),
  btrim(item->>'model'),
  btrim(item->>'type'),
  btrim(item->>'subtype'),
  coalesce(item->>'tracking_mode', case when l.list_mode = 'abstract' then 'planned' else 'quantity' end),
  greatest(1, coalesce((item->>'count')::integer, 1)),
  l.created_by,
  coalesce(l.created_at, now()),
  coalesce(l.updated_at, l.created_at, now())
from public.equipment_lists l
cross join lateral jsonb_array_elements(coalesce(l.equipment_items, '[]'::jsonb)) item
where coalesce(item->>'tracking_mode', case when l.list_mode = 'abstract' then 'planned' else 'quantity' end)
      in ('planned', 'quantity')
  and (
    coalesce(item->>'tracking_mode', case when l.list_mode = 'abstract' then 'planned' else 'quantity' end) = 'planned'
    or (
      coalesce(item->>'equipment_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      and exists (
        select 1 from public.equipment e where e.id = (item->>'equipment_id')::uuid
      )
    )
  )
  and nullif(btrim(item->>'brand'), '') is not null
  and nullif(btrim(item->>'model'), '') is not null
  and nullif(btrim(item->>'type'), '') is not null
  and nullif(btrim(item->>'subtype'), '') is not null
on conflict (list_id, equipment_id) do nothing;

insert into public.reservation_status_history (
  list_id, from_status, to_status, note, changed_by, changed_at
)
select
  l.id,
  null,
  'draft',
  'Исторический список перенесён в новый цикл резервирования без выдуманных дат',
  l.created_by,
  coalesce(l.created_at, now())
from public.equipment_lists l
where not exists (
  select 1 from public.reservation_status_history h where h.list_id = l.id
);

-- Capacity and overlap calculation. Shortages are informational for draft and
-- confirmation, while issuing still requires physical stock.
create or replace function public.reservation_shortages(p_list_id uuid)
returns table (
  brand text,
  model text,
  type text,
  subtype text,
  requested integer,
  capacity integer,
  reserved integer,
  available integer,
  specific_conflicts integer,
  shortage integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  with target_list as (
    select id, reservation_start, reservation_end
    from public.equipment_lists
    where id = p_list_id
  ),
  target_groups as (
    select
      min(i.brand) as brand,
      min(i.model) as model,
      min(i.type) as type,
      min(i.subtype) as subtype,
      lower(btrim(i.brand)) as brand_key,
      lower(btrim(i.model)) as model_key,
      lower(btrim(i.type)) as type_key,
      lower(btrim(i.subtype)) as subtype_key,
      sum(i.requested_count)::integer as requested
    from public.equipment_reservation_items i
    where i.list_id = p_list_id
    group by
      lower(btrim(i.brand)), lower(btrim(i.model)),
      lower(btrim(i.type)), lower(btrim(i.subtype))
  ),
  inventory as (
    select
      lower(btrim(e.brand)) as brand_key,
      lower(btrim(e.model)) as model_key,
      lower(btrim(e.type)) as type_key,
      lower(btrim(e.subtype)) as subtype_key,
      sum(case when e.availability = 'available' then greatest(e.count, 0) else 0 end)::integer as capacity
    from public.equipment e
    group by
      lower(btrim(e.brand)), lower(btrim(e.model)),
      lower(btrim(e.type)), lower(btrim(e.subtype))
  ),
  other_reservations as (
    select
      lower(btrim(i.brand)) as brand_key,
      lower(btrim(i.model)) as model_key,
      lower(btrim(i.type)) as type_key,
      lower(btrim(i.subtype)) as subtype_key,
      sum(i.requested_count)::integer as reserved
    from public.equipment_reservation_items i
    join public.equipment_lists l on l.id = i.list_id
    cross join target_list t
    where l.id <> p_list_id
      and l.reservation_status = 'confirmed'
      and l.reservation_start is not null
      and l.reservation_end is not null
      and t.reservation_start is not null
      and t.reservation_end is not null
      and daterange(l.reservation_start, l.reservation_end, '[]')
        && daterange(t.reservation_start, t.reservation_end, '[]')
    group by
      lower(btrim(i.brand)), lower(btrim(i.model)),
      lower(btrim(i.type)), lower(btrim(i.subtype))
  ),
  conflicts as (
    select
      lower(btrim(i.brand)) as brand_key,
      lower(btrim(i.model)) as model_key,
      lower(btrim(i.type)) as type_key,
      lower(btrim(i.subtype)) as subtype_key,
      count(*)::integer as conflicts
    from public.equipment_reservation_items i
    join public.equipment e on e.id = i.equipment_id
    cross join target_list t
    where i.list_id = p_list_id
      and i.tracking_mode = 'serialized'
      and (
        e.availability <> 'available'
        or exists (
          select 1
          from public.equipment_reservation_items oi
          join public.equipment_lists ol on ol.id = oi.list_id
          where oi.equipment_id = i.equipment_id
            and oi.list_id <> p_list_id
            and ol.reservation_status = 'confirmed'
            and ol.reservation_start is not null
            and ol.reservation_end is not null
            and t.reservation_start is not null
            and t.reservation_end is not null
            and daterange(ol.reservation_start, ol.reservation_end, '[]')
              && daterange(t.reservation_start, t.reservation_end, '[]')
        )
      )
    group by
      lower(btrim(i.brand)), lower(btrim(i.model)),
      lower(btrim(i.type)), lower(btrim(i.subtype))
  )
  select
    g.brand,
    g.model,
    g.type,
    g.subtype,
    g.requested,
    coalesce(inv.capacity, 0)::integer as capacity,
    coalesce(r.reserved, 0)::integer as reserved,
    greatest(0, coalesce(inv.capacity, 0) - coalesce(r.reserved, 0))::integer as available,
    coalesce(c.conflicts, 0)::integer as specific_conflicts,
    greatest(
      0,
      g.requested - greatest(0, coalesce(inv.capacity, 0) - coalesce(r.reserved, 0)),
      coalesce(c.conflicts, 0)
    )::integer as shortage
  from target_groups g
  left join inventory inv using (brand_key, model_key, type_key, subtype_key)
  left join other_reservations r using (brand_key, model_key, type_key, subtype_key)
  left join conflicts c using (brand_key, model_key, type_key, subtype_key)
  order by g.type, g.brand, g.model;
$$;

-- Immutable audit triggers are SECURITY DEFINER only so clients cannot forge or
-- delete history. They are kept in the non-exposed private schema.
create or replace function private.log_equipment_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  movement_kind text;
  movement_list_id uuid;
  movement_note text;
begin
  if tg_op = 'INSERT' then
    insert into public.equipment_movements (
      equipment_id, movement_type, quantity_delta, quantity_before, quantity_after,
      status_before, status_after, changed_by
    ) values (
      new.id, 'created', coalesce(new.count, 0), null, new.count,
      null, new.availability, (select auth.uid())
    );
    return new;
  end if;

  if new.count is not distinct from old.count
    and new.availability is not distinct from old.availability then
    return new;
  end if;

  movement_kind := nullif(current_setting('argo.movement_type', true), '');
  if movement_kind is null or movement_kind not in ('issued', 'returned') then
    movement_kind := case
      when new.count is distinct from old.count
        and new.availability is distinct from old.availability
        then 'quantity_and_status_changed'
      when new.count is distinct from old.count then 'quantity_changed'
      else 'status_changed'
    end;
  end if;

  begin
    movement_list_id := nullif(current_setting('argo.list_id', true), '')::uuid;
  exception when invalid_text_representation then
    movement_list_id := null;
  end;
  movement_note := nullif(current_setting('argo.transition_note', true), '');

  insert into public.equipment_movements (
    equipment_id, list_id, movement_type, quantity_delta,
    quantity_before, quantity_after, status_before, status_after,
    note, changed_by
  ) values (
    new.id, movement_list_id, movement_kind, coalesce(new.count, 0) - coalesce(old.count, 0),
    old.count, new.count, old.availability, new.availability,
    movement_note, (select auth.uid())
  );
  return new;
end;
$$;

create or replace function private.guard_reservation_list_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status_changed_at is distinct from old.status_changed_at
    or new.status_changed_by is distinct from old.status_changed_by
    or new.confirmed_at is distinct from old.confirmed_at
    or new.issued_at is distinct from old.issued_at
    or new.returned_at is distinct from old.returned_at
    or new.shortage_snapshot is distinct from old.shortage_snapshot then
    if current_setting('argo.transition_allowed', true) is distinct from 'true' then
      raise exception 'Reservation lifecycle fields are managed by transition_equipment_list_status()';
    end if;
  end if;

  if new.created_by is distinct from old.created_by then
    raise exception 'created_by cannot be changed';
  end if;

  if new.reservation_status is distinct from old.reservation_status
    and current_setting('argo.transition_allowed', true) is distinct from 'true' then
    raise exception 'Use transition_equipment_list_status() to change reservation status';
  end if;

  if old.reservation_status <> 'draft'
    and (
      new.reservation_start is distinct from old.reservation_start
      or new.reservation_end is distinct from old.reservation_end
      or new.equipment_ids is distinct from old.equipment_ids
      or new.equipment_items is distinct from old.equipment_items
      or new.list_mode is distinct from old.list_mode
    ) then
    raise exception 'Confirmed reservation contents and dates are immutable';
  end if;
  return new;
end;
$$;

create or replace function private.log_reservation_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.reservation_status_history (
      list_id, from_status, to_status, note, shortage_snapshot, changed_by
    ) values (
      new.id, null, new.reservation_status, 'Создан черновик',
      coalesce(new.shortage_snapshot, '[]'::jsonb), (select auth.uid())
    );
    return new;
  end if;

  if new.reservation_status is not distinct from old.reservation_status then
    return new;
  end if;

  insert into public.reservation_status_history (
    list_id, from_status, to_status, note, shortage_snapshot, changed_by
  ) values (
    new.id,
    old.reservation_status,
    new.reservation_status,
    nullif(current_setting('argo.transition_note', true), ''),
    coalesce(new.shortage_snapshot, '[]'::jsonb),
    (select auth.uid())
  );
  return new;
end;
$$;

revoke all on function private.log_equipment_change() from public, anon, authenticated;
revoke all on function private.guard_reservation_list_update() from public, anon, authenticated;
revoke all on function private.log_reservation_status_change() from public, anon, authenticated;

drop trigger if exists trg_equipment_movement_history on public.equipment;
create trigger trg_equipment_movement_history
after insert or update of count, availability on public.equipment
for each row execute function private.log_equipment_change();

drop trigger if exists trg_guard_reservation_list_update on public.equipment_lists;
create trigger trg_guard_reservation_list_update
before update on public.equipment_lists
for each row execute function private.guard_reservation_list_update();

drop trigger if exists trg_reservation_status_history on public.equipment_lists;
create trigger trg_reservation_status_history
after insert or update on public.equipment_lists
for each row execute function private.log_reservation_status_change();

-- Atomic list creation keeps the legacy JSON/array representation synchronized
-- with normalized reservation lines.
create or replace function public.create_equipment_list_with_items(
  p_name text,
  p_description text,
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
    created_by, is_archived, metadata, reservation_status,
    reservation_start, reservation_end, status_changed_by
  ) values (
    btrim(p_name), nullif(btrim(p_description), ''), 'custom', p_list_mode,
    legacy_ids, legacy_items, (select auth.uid()), false,
    jsonb_build_object('source', 'argo-warehouse-react'), 'draft',
    p_reservation_start, p_reservation_end, (select auth.uid())
  ) returning id into new_list_id;

  insert into public.equipment_reservation_items (
    list_id, equipment_id, brand, model, type, subtype,
    tracking_mode, requested_count, created_by
  )
  select
    new_list_id,
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

  return new_list_id;
end;
$$;

create or replace function public.transition_equipment_list_status(
  p_list_id uuid,
  p_target_status text,
  p_note text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_list public.equipment_lists%rowtype;
  shortages jsonb := '[]'::jsonb;
begin
  if not (select private.is_app_member()) then
    raise exception 'Not an application member';
  end if;

  select * into current_list
  from public.equipment_lists
  where id = p_list_id
  for update;
  if not found then raise exception 'Equipment list not found'; end if;

  if not (
    (current_list.reservation_status = 'draft' and p_target_status = 'confirmed')
    or (current_list.reservation_status = 'confirmed' and p_target_status = 'issued')
    or (current_list.reservation_status = 'issued' and p_target_status = 'returned')
  ) then
    raise exception 'Invalid reservation transition: % -> %', current_list.reservation_status, p_target_status;
  end if;

  if p_target_status = 'confirmed' then
    if current_list.reservation_start is null or current_list.reservation_end is null then
      raise exception 'Reservation dates are required before confirmation';
    end if;
    select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb)
    into shortages
    from public.reservation_shortages(p_list_id) s
    where s.shortage > 0;

    perform set_config('argo.transition_allowed', 'true', true);
    perform set_config('argo.transition_note', coalesce(p_note, ''), true);
    update public.equipment_lists
    set reservation_status = 'confirmed', confirmed_at = now(),
        status_changed_at = now(), status_changed_by = (select auth.uid()),
        shortage_snapshot = shortages
    where id = p_list_id;

  elsif p_target_status = 'issued' then
    if current_list.list_mode <> 'specific' then
      raise exception 'A model plan must be converted to a specific list before issue';
    end if;
    if exists (
      select 1 from public.equipment_reservation_items i
      where i.list_id = p_list_id and i.tracking_mode = 'planned'
    ) then
      raise exception 'All planned model quantities must be assigned before issue';
    end if;
    perform e.id
    from public.equipment e
    join public.equipment_reservation_items i on i.equipment_id = e.id
    where i.list_id = p_list_id
    order by e.id
    for update of e;

    if exists (
      select 1
      from public.equipment_reservation_items i
      join public.equipment e on e.id = i.equipment_id
      where i.list_id = p_list_id
        and (
          (i.tracking_mode = 'serialized' and e.availability <> 'available')
          or (i.tracking_mode = 'quantity'
            and (e.availability <> 'available' or e.count < i.requested_count))
        )
    ) then
      raise exception 'Some equipment is no longer physically available';
    end if;

    perform set_config('argo.movement_type', 'issued', true);
    perform set_config('argo.list_id', p_list_id::text, true);
    perform set_config('argo.transition_note', coalesce(p_note, ''), true);
    update public.equipment e
    set availability = 'issued'
    from public.equipment_reservation_items i
    where i.list_id = p_list_id
      and i.equipment_id = e.id
      and i.tracking_mode = 'serialized';
    update public.equipment e
    set count = e.count - i.requested_count,
        availability = case when e.count - i.requested_count = 0 then 'unavailable' else 'available' end
    from public.equipment_reservation_items i
    where i.list_id = p_list_id
      and i.equipment_id = e.id
      and i.tracking_mode = 'quantity';

    perform set_config('argo.transition_allowed', 'true', true);
    update public.equipment_lists
    set reservation_status = 'issued', issued_at = now(),
        status_changed_at = now(), status_changed_by = (select auth.uid()),
        shortage_snapshot = '[]'::jsonb
    where id = p_list_id;

  elsif p_target_status = 'returned' then
    perform e.id
    from public.equipment e
    join public.equipment_reservation_items i on i.equipment_id = e.id
    where i.list_id = p_list_id
    order by e.id
    for update of e;

    perform set_config('argo.movement_type', 'returned', true);
    perform set_config('argo.list_id', p_list_id::text, true);
    perform set_config('argo.transition_note', coalesce(p_note, ''), true);
    update public.equipment e
    set availability = 'available'
    from public.equipment_reservation_items i
    where i.list_id = p_list_id
      and i.equipment_id = e.id
      and i.tracking_mode = 'serialized';
    update public.equipment e
    set count = e.count + i.requested_count,
        availability = 'available'
    from public.equipment_reservation_items i
    where i.list_id = p_list_id
      and i.equipment_id = e.id
      and i.tracking_mode = 'quantity';

    perform set_config('argo.transition_allowed', 'true', true);
    update public.equipment_lists
    set reservation_status = 'returned', returned_at = now(),
        status_changed_at = now(), status_changed_by = (select auth.uid()),
        shortage_snapshot = '[]'::jsonb
    where id = p_list_id;
  end if;

  perform set_config('argo.transition_allowed', '', true);
  perform set_config('argo.movement_type', '', true);
  perform set_config('argo.list_id', '', true);
  perform set_config('argo.transition_note', '', true);

  return jsonb_build_object(
    'id', p_list_id,
    'status', p_target_status,
    'shortages', shortages
  );
end;
$$;

revoke all on function public.reservation_shortages(uuid) from public, anon;
revoke all on function public.create_equipment_list_with_items(text,text,text,date,date,jsonb) from public, anon;
revoke all on function public.transition_equipment_list_status(uuid,text,text) from public, anon;
grant execute on function public.reservation_shortages(uuid) to authenticated;
grant execute on function public.create_equipment_list_with_items(text,text,text,date,date,jsonb) to authenticated;
grant execute on function public.transition_equipment_list_status(uuid,text,text) to authenticated;

-- Remove all legacy policies so permissive PUBLIC/auth.role policies cannot
-- combine with the new ones.
do $$
declare
  p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'users', 'equipment', 'equipment_lists', 'equipment_reservation_items',
        'reservation_status_history', 'equipment_movements',
        'events', 'mount_points', 'reports'
      )
  loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

alter table public.users enable row level security;
alter table public.equipment enable row level security;
alter table public.equipment_lists enable row level security;
alter table public.equipment_reservation_items enable row level security;
alter table public.reservation_status_history enable row level security;
alter table public.equipment_movements enable row level security;
alter table public.events enable row level security;
alter table public.mount_points enable row level security;
alter table public.reports enable row level security;

create policy users_select_for_members on public.users
  for select to authenticated
  using ((select private.is_app_member()));
create policy users_insert_for_admins on public.users
  for insert to authenticated
  with check ((select private.has_any_role(array['admin']::text[])));
create policy users_update_for_admins on public.users
  for update to authenticated
  using ((select private.has_any_role(array['admin']::text[])))
  with check ((select private.has_any_role(array['admin']::text[])));
create policy users_delete_for_admins on public.users
  for delete to authenticated
  using ((select private.has_any_role(array['admin']::text[])));

create policy equipment_select_for_members on public.equipment
  for select to authenticated
  using ((select private.is_app_member()));
create policy equipment_insert_for_inventory_team on public.equipment
  for insert to authenticated
  with check ((select private.has_any_role(array['technician','manager','admin']::text[])));
create policy equipment_update_for_inventory_team on public.equipment
  for update to authenticated
  using ((select private.has_any_role(array['technician','manager','admin']::text[])))
  with check ((select private.has_any_role(array['technician','manager','admin']::text[])));
create policy equipment_delete_for_admins on public.equipment
  for delete to authenticated
  using ((select private.has_any_role(array['admin']::text[])));

create policy equipment_lists_select_for_members on public.equipment_lists
  for select to authenticated
  using ((select private.is_app_member()));
create policy equipment_lists_insert_for_members on public.equipment_lists
  for insert to authenticated
  with check (
    (select private.is_app_member())
    and created_by = (select auth.uid())
    and reservation_status = 'draft'
    and confirmed_at is null
    and issued_at is null
    and returned_at is null
  );
create policy equipment_lists_update_for_members on public.equipment_lists
  for update to authenticated
  using ((select private.is_app_member()))
  with check ((select private.is_app_member()));
create policy equipment_lists_delete_for_admins on public.equipment_lists
  for delete to authenticated
  using ((select private.has_any_role(array['admin']::text[])));

create policy reservation_items_select_for_members on public.equipment_reservation_items
  for select to authenticated
  using ((select private.is_app_member()));
create policy reservation_items_insert_for_drafts on public.equipment_reservation_items
  for insert to authenticated
  with check (
    (select private.is_app_member())
    and created_by = (select auth.uid())
    and exists (
      select 1 from public.equipment_lists l
      where l.id = list_id and l.reservation_status = 'draft'
    )
  );
create policy reservation_items_update_for_drafts on public.equipment_reservation_items
  for update to authenticated
  using (
    (select private.is_app_member())
    and exists (
      select 1 from public.equipment_lists l
      where l.id = list_id and l.reservation_status = 'draft'
    )
  )
  with check (
    (select private.is_app_member())
    and exists (
      select 1 from public.equipment_lists l
      where l.id = list_id and l.reservation_status = 'draft'
    )
  );
create policy reservation_items_delete_for_drafts on public.equipment_reservation_items
  for delete to authenticated
  using (
    (select private.is_app_member())
    and exists (
      select 1 from public.equipment_lists l
      where l.id = list_id and l.reservation_status = 'draft'
    )
  );

create policy reservation_history_select_for_members on public.reservation_status_history
  for select to authenticated
  using ((select private.is_app_member()));
create policy equipment_movements_select_for_members on public.equipment_movements
  for select to authenticated
  using ((select private.is_app_member()));

create policy events_select_for_assigned_team on public.events
  for select to authenticated
  using (
    (select auth.uid()) = any(responsible_engineers)
    or (select private.has_any_role(array['manager','admin']::text[]))
  );
create policy events_insert_for_assigned_team on public.events
  for insert to authenticated
  with check (
    (select auth.uid()) = any(responsible_engineers)
    or (select private.has_any_role(array['manager','admin']::text[]))
  );
create policy events_update_for_assigned_team on public.events
  for update to authenticated
  using (
    (select auth.uid()) = any(responsible_engineers)
    or (select private.has_any_role(array['manager','admin']::text[]))
  )
  with check (
    (select auth.uid()) = any(responsible_engineers)
    or (select private.has_any_role(array['manager','admin']::text[]))
  );
create policy events_delete_for_assigned_team on public.events
  for delete to authenticated
  using (
    (select auth.uid()) = any(responsible_engineers)
    or (select private.has_any_role(array['manager','admin']::text[]))
  );

create policy mount_points_select_by_event on public.mount_points
  for select to authenticated
  using (exists (select 1 from public.events e where e.id = event_id));
create policy mount_points_insert_by_event on public.mount_points
  for insert to authenticated
  with check (exists (select 1 from public.events e where e.id = event_id));
create policy mount_points_update_by_event on public.mount_points
  for update to authenticated
  using (exists (select 1 from public.events e where e.id = event_id))
  with check (exists (select 1 from public.events e where e.id = event_id));
create policy mount_points_delete_by_event on public.mount_points
  for delete to authenticated
  using (exists (select 1 from public.events e where e.id = event_id));

create policy reports_select_by_event on public.reports
  for select to authenticated
  using (exists (select 1 from public.events e where e.id = event_id));
create policy reports_insert_by_event on public.reports
  for insert to authenticated
  with check (exists (select 1 from public.events e where e.id = event_id));
create policy reports_update_by_event on public.reports
  for update to authenticated
  using (exists (select 1 from public.events e where e.id = event_id))
  with check (exists (select 1 from public.events e where e.id = event_id));
create policy reports_delete_by_event on public.reports
  for delete to authenticated
  using (exists (select 1 from public.events e where e.id = event_id));

-- Explicit grants are required by the 2026 Data API exposure model. RLS remains
-- the row-level authorization layer.
revoke all on table public.users from anon, authenticated;
revoke all on table public.equipment from anon, authenticated;
revoke all on table public.equipment_lists from anon, authenticated;
revoke all on table public.equipment_reservation_items from anon, authenticated;
revoke all on table public.reservation_status_history from anon, authenticated;
revoke all on table public.equipment_movements from anon, authenticated;
revoke all on table public.events from anon, authenticated;
revoke all on table public.mount_points from anon, authenticated;
revoke all on table public.reports from anon, authenticated;

grant select, insert, update, delete on table public.users to authenticated;
grant select, insert, update, delete on table public.equipment to authenticated;
grant select, insert, update, delete on table public.equipment_lists to authenticated;
grant select, insert, update, delete on table public.equipment_reservation_items to authenticated;
grant select on table public.reservation_status_history to authenticated;
grant select on table public.equipment_movements to authenticated;
grant select, insert, update, delete on table public.events to authenticated;
grant select, insert, update, delete on table public.mount_points to authenticated;
grant select, insert, update, delete on table public.reports to authenticated;

notify pgrst, 'reload schema';
commit;
