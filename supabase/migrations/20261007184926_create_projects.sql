-- Мероприятие и его состав (с54, план event-s53 §1.1–1.4).
-- Таблица — projects, а не events: имя events занято наследием Vue (на неё
-- ссылаются mount_points, reports, equipment_lists.event_id), а TS-тип Event
-- конфликтует с DOM. В интерфейсе сущность называется «Мероприятие».

create table public.projects (
  id uuid primary key default gen_random_uuid(),

  name text not null,
  client_name text,
  -- Место с привязанным мероприятием не удаляется: restrict, а не set null —
  -- иначе у документа молча пропала бы площадка.
  venue_id uuid references public.venues(id) on delete restrict,

  -- Даты необязательны; date_to is null = один день.
  date_from date,
  date_to date,

  description text,

  created_by uuid default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Именованные: клиент разбирает отказ по имени ограничения.
  constraint projects_name_check check (btrim(name) <> '' and char_length(name) <= 200),
  constraint projects_client_check check (
    client_name is null or (btrim(client_name) <> '' and char_length(client_name) <= 200)
  ),
  -- Копия hall_plans_dates_check.
  constraint projects_dates_check check (
    (date_from is null and date_to is null)
    or (date_from is not null and (date_to is null or date_to >= date_from))
  )
);

comment on table public.projects is
  'Мероприятия: реквизиты (название, заказчик, площадка, период). Состав — project_staff; списки и планы залов ссылаются project_id.';

-- Пара к клиентской подсказке «такое мероприятие уже есть» и защита от двойного
-- нажатия. Дата в ключе: ежегодный форум с тем же названием проходит.
create unique index projects_identity_key
  on public.projects (lower(btrim(name)), coalesce(date_from, '0001-01-01'::date));

create index projects_venue_id_idx on public.projects (venue_id) where venue_id is not null;
create index projects_date_from_idx on public.projects (date_from desc nulls last, id);

create function public.normalize_project_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.name := btrim(new.name);
  new.client_name := nullif(btrim(new.client_name), '');
  new.description := nullif(btrim(new.description), '');
  return new;
end;
$$;

revoke execute on function public.normalize_project_fields() from public, anon, authenticated;

create trigger trg_normalize_project_fields
  before insert or update on public.projects
  for each row execute function public.normalize_project_fields();

create trigger update_projects_updated_at
  before update on public.projects
  for each row execute function public.update_updated_at_column();

-- Состав: человек на мероприятии. Должность на мероприятии, порядок и даты
-- участия — не в первой версии; документ сортируется по ФИО.
create table public.project_staff (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  -- Сотрудника удалили — он уходит и из составов (как hall_assignments).
  employee_id uuid not null references public.employees(id) on delete cascade,
  created_by uuid default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),

  -- Пара к галке в интерфейсе: человек в составе один раз.
  constraint project_staff_member_key unique (project_id, employee_id)
);

create index project_staff_employee_id_idx on public.project_staff (employee_id);

-- «Изменено» у мероприятия реагирует на правку состава; двигает база, копия
-- touch_hall_plan. Security invoker: пишущему нужен UPDATE на projects — политика
-- ниже даёт его тем же ролям, что пишут состав.
create function public.touch_project()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.projects
    set updated_at = now()
    where id = coalesce(new.project_id, old.project_id);
  return null;
end;
$$;

revoke execute on function public.touch_project() from public, anon, authenticated;

create trigger trg_touch_project
  after insert or delete on public.project_staff
  for each row execute function public.touch_project();

-- Связи на существующих таблицах. Nullable навсегда: список без мероприятия —
-- черновой набор без реквизитов (решение прораба с53, п. 2).
-- restrict: мероприятие с привязанными списками не удаляется (23503, п. 10).
alter table public.equipment_lists
  add column project_id uuid references public.projects(id) on delete restrict;
create index equipment_lists_project_id_idx
  on public.equipment_lists (project_id) where project_id is not null;

-- План залов при удалении мероприятия отвязывается, а не исчезает.
alter table public.hall_plans
  add column project_id uuid references public.projects(id) on delete set null;
create index hall_plans_project_id_idx
  on public.hall_plans (project_id) where project_id is not null;

-- RLS по образцу hall_plans: читает член приложения, пишут три рабочие роли.
-- Изоляции между сотрудниками нет по замыслу. Удалять мероприятие может любой
-- техник, пока к нему не привязаны списки (решение прораба с53, п. 10).
alter table public.projects enable row level security;
alter table public.project_staff enable row level security;

create policy projects_select_for_members on public.projects
  for select to authenticated
  using ((select private.is_app_member()));

create policy projects_insert_for_staff on public.projects
  for insert to authenticated
  with check (
    (select private.has_any_role(array['technician', 'manager', 'admin']))
    and created_by = (select auth.uid())
  );

create policy projects_update_for_staff on public.projects
  for update to authenticated
  using ((select private.has_any_role(array['technician', 'manager', 'admin'])))
  with check ((select private.has_any_role(array['technician', 'manager', 'admin'])));

create policy projects_delete_for_staff on public.projects
  for delete to authenticated
  using ((select private.has_any_role(array['technician', 'manager', 'admin'])));

create policy project_staff_select_for_members on public.project_staff
  for select to authenticated
  using ((select private.is_app_member()));

create policy project_staff_insert_for_staff on public.project_staff
  for insert to authenticated
  with check (
    (select private.has_any_role(array['technician', 'manager', 'admin']))
    and created_by = (select auth.uid())
  );

create policy project_staff_update_for_staff on public.project_staff
  for update to authenticated
  using ((select private.has_any_role(array['technician', 'manager', 'admin'])))
  with check ((select private.has_any_role(array['technician', 'manager', 'admin'])));

create policy project_staff_delete_for_staff on public.project_staff
  for delete to authenticated
  using ((select private.has_any_role(array['technician', 'manager', 'admin'])));

revoke all on table public.projects from public, anon, authenticated;
revoke all on table public.project_staff from public, anon, authenticated;
grant select, insert, update, delete on table public.projects to authenticated;
grant select, insert, update, delete on table public.project_staff to authenticated;

notify pgrst, 'reload schema';
