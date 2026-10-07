-- Места (с54, план event-s53 §1.3): одна таблица на обе роли — площадка работы
-- (projects.venue_id) и отель проживания (hotel_stays.venue_id, план lodging-s49).
-- Роль колонкой не хранится, выводится из ссылок. Заводится здесь, а не в
-- расселении: место — реквизит мероприятия, иначе venue мигрировали бы дважды.

create table public.venues (
  id uuid primary key default gen_random_uuid(),

  name text not null,
  city text not null,
  country text not null,

  created_by uuid default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Именованные: клиент разбирает отказ по имени ограничения.
  constraint venues_name_check check (btrim(name) <> '' and char_length(name) <= 200),
  constraint venues_city_check check (btrim(city) <> '' and char_length(city) <= 100),
  constraint venues_country_check check (btrim(country) <> '' and char_length(country) <= 100)
);

comment on table public.venues is
  'Места: площадки мероприятий и отели. Роль выводится из ссылок (projects.venue_id).';

-- Пара к клиентской подсказке «такое место уже есть»: один отель в одном городе
-- не заводится дважды из-за регистра или пробела на конце.
create unique index venues_identity_key
  on public.venues (lower(btrim(name)), lower(btrim(city)), lower(btrim(country)));

-- База авторитетна: края режет она, клиентский trim — только UX.
create function public.normalize_venue_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.name := btrim(new.name);
  new.city := btrim(new.city);
  new.country := btrim(new.country);
  return new;
end;
$$;

revoke execute on function public.normalize_venue_fields() from public, anon, authenticated;

create trigger trg_normalize_venue_fields
  before insert or update on public.venues
  for each row execute function public.normalize_venue_fields();

create trigger update_venues_updated_at
  before update on public.venues
  for each row execute function public.update_updated_at_column();

-- RLS по образцу hall_plans: читает член приложения, пишут три рабочие роли.
alter table public.venues enable row level security;

create policy venues_select_for_members on public.venues
  for select to authenticated
  using ((select private.is_app_member()));

create policy venues_insert_for_staff on public.venues
  for insert to authenticated
  with check (
    (select private.has_any_role(array['technician', 'manager', 'admin']))
    and created_by = (select auth.uid())
  );

create policy venues_update_for_staff on public.venues
  for update to authenticated
  using ((select private.has_any_role(array['technician', 'manager', 'admin'])))
  with check ((select private.has_any_role(array['technician', 'manager', 'admin'])));

create policy venues_delete_for_staff on public.venues
  for delete to authenticated
  using ((select private.has_any_role(array['technician', 'manager', 'admin'])));

revoke all on table public.venues from public, anon, authenticated;
grant select, insert, update, delete on table public.venues to authenticated;

notify pgrst, 'reload schema';
