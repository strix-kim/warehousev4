-- Перенос реквизитов живых списков в мероприятия (с54, план event-s53 §2).
-- Миграция данных: на чистой базе пустая, повторный запуск ничего не меняет
-- (везде where project_id is null и on conflict do nothing).
--
-- Тестовые списки (ТЕСТ*с10*, SCOUT-с54-*) пропускаются по имени: по плану их
-- сносили до переноса, но удаление в проде на момент выкатки не прошло. Они
-- остаются списками без мероприятия и не рождают мусорных мероприятий и мест.
--
-- created_by берётся у списка явно: в миграции auth.uid() пуст.
-- Город и страна мест — «Ташкент» / «Узбекистан» (решение прораба с53, п. 5).

insert into public.venues (name, city, country, created_by)
select distinct on (lower(btrim(l.venue))) btrim(l.venue), 'Ташкент', 'Узбекистан', l.created_by
from public.equipment_lists l
where l.project_id is null
  and nullif(btrim(l.venue), '') is not null
  and l.name not ilike 'ТЕСТ%с10%' and l.name not like 'SCOUT-с54-%'
order by lower(btrim(l.venue)), l.created_at
on conflict do nothing;

-- Одна строка мероприятия на список с хотя бы одним реквизитом; однодневный
-- период хранится как date_to null.
insert into public.projects (name, client_name, venue_id, date_from, date_to, created_by)
select l.name, l.client_name, v.id, l.reservation_start,
       nullif(l.reservation_end, l.reservation_start), l.created_by
from public.equipment_lists l
left join public.venues v
  on lower(btrim(v.name)) = lower(btrim(l.venue)) and v.city = 'Ташкент' and v.country = 'Узбекистан'
where l.project_id is null
  and (l.client_name is not null or l.venue is not null or l.reservation_start is not null)
  and l.name not ilike 'ТЕСТ%с10%' and l.name not like 'SCOUT-с54-%'
order by l.created_at
on conflict do nothing;

update public.equipment_lists l
set project_id = p.id
from public.projects p
where l.project_id is null
  and (l.client_name is not null or l.venue is not null or l.reservation_start is not null)
  and l.name not ilike 'ТЕСТ%с10%' and l.name not like 'SCOUT-с54-%'
  and lower(btrim(p.name)) = lower(btrim(l.name))
  and coalesce(p.date_from, '0001-01-01'::date) = coalesce(l.reservation_start, '0001-01-01'::date);

-- План залов привязывается только при точном совпадении названия (Bionorica);
-- остальные планы привязывают из интерфейса.
update public.hall_plans h
set project_id = p.id
from public.projects p
where h.project_id is null and lower(btrim(p.name)) = lower(btrim(h.name));

-- Период мероприятия берётся шире — из плана залов (список знал один день).
update public.projects p
set date_from = least(p.date_from, h.event_from),
    date_to = nullif(
      greatest(coalesce(p.date_to, p.date_from), coalesce(h.event_to, h.event_from)),
      least(p.date_from, h.event_from)
    )
from public.hall_plans h
where h.project_id = p.id and h.event_from is not null and p.date_from is not null;
