-- «Производственные расходы» (план expenses-s49, этап 1): плоский журнал трат,
-- который ведёт один человек. Контейнера-«отчёта» нет — отчёт это выгрузка xlsx
-- за месяц; понадобится контейнер — nullable report_id аддитивной миграцией.
--
-- Права — строго владелец на все четыре операции (created_by = auth.uid()).
-- Это первая owner-политика на ЧТЕНИЕ в проекте: остальные таблицы видны любому
-- члену приложения, а здесь личные деньги — второй аккаунт не видит ни строк, ни
-- итога. Открыть журнал руководителю — одна миграция позже; ужесточать деньги
-- задним числом больнее.
--
-- spent_on без default намеренно: current_date в базе — UTC, до 05:00 Ташкента
-- это вчера. Дату шлёт клиент из todayDateValue().
--
-- amount — целые сумы (bigint), валюта одна (UZS). Потолок в миллиард — защита от
-- залипшей клавиши, а не продуктовый лимит.
--
-- spent_by («Кто потратил») — атрибуция, не защита: сотрудник из employees, с
-- учётной записью users он никак не связан. Уволили и удалили сотрудника — трата
-- остаётся, поле обнуляется.
--
-- created_by → auth.users без каскада: аккаунт, за которым числятся расходы,
-- удалить нельзя — деньги не должны терять автора.
--
-- Объекты создаются без предварительной зачистки «if exists»: таблицы и функции
-- заведомо нет, а зачистку MCP-коннектор отклоняет (gotchas §3).

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  spent_on date not null,
  amount bigint not null,
  spent_by uuid references public.employees(id) on delete set null,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Ограничения именованные: клиент разбирает отказ по имени (как
  -- vehicleSaveErrorText), а не по тексту сообщения.
  constraint expenses_name_check check (btrim(name) <> '' and char_length(name) <= 200),
  constraint expenses_amount_check check (amount > 0 and amount <= 1000000000)
);

-- Журнал читается одним владельцем за период в порядке «свежие сверху» — индекс
-- повторяет и фильтр политики, и сортировку expenses_period.
create index expenses_owner_period_idx
  on public.expenses (created_by, spent_on desc, created_at desc, id);

-- Новых триггерных функций нет: normalize_hall_name делает btrim(new.name)
-- (потому колонка и зовётся name), update_updated_at_column ставит updated_at.
-- BEFORE-триггер срабатывает раньше CHECK, так что имя из одних пробелов
-- превращается в пустую строку и отбивается expenses_name_check.
create trigger trg_normalize_expense_name
before insert or update of name on public.expenses
for each row execute function public.normalize_hall_name();

create trigger trg_expenses_updated_at
before update on public.expenses
for each row execute function public.update_updated_at_column();

alter table public.expenses enable row level security;

create policy expenses_select_for_owner on public.expenses
  for select to authenticated
  using (
    (select private.is_app_member())
    and created_by = (select auth.uid())
  );

create policy expenses_insert_for_owner on public.expenses
  for insert to authenticated
  with check (
    (select private.has_any_role(array['technician', 'manager', 'admin']))
    and created_by = (select auth.uid())
  );

-- with check держит и роль, и владельца: строку нельзя ни править без роли, ни
-- «подарить» другому аккаунту сменой created_by.
create policy expenses_update_for_owner on public.expenses
  for update to authenticated
  using (
    (select private.is_app_member())
    and created_by = (select auth.uid())
  )
  with check (
    (select private.has_any_role(array['technician', 'manager', 'admin']))
    and created_by = (select auth.uid())
  );

create policy expenses_delete_for_owner on public.expenses
  for delete to authenticated
  using (
    (select private.is_app_member())
    and created_by = (select auth.uid())
  );

-- Гранты: default privileges Supabase раздают полный CRUD — пересобираем явно.
revoke all on table public.expenses from public, anon, authenticated;
grant select, insert, update, delete on table public.expenses to authenticated;

-- Журнал за период одним снимком: строки, итог и число строк считает база.
-- Сумма по подгруженным строкам на клиенте молча соврёт, когда Data API обрежет
-- выборку на 1000 строк; скалярный jsonb под обрезку не попадает.
--
-- p_spent_by — фильтр «Кто потратил»: итог под фильтром тоже обязан считаться
-- здесь, а не на клиенте. null — без фильтра.
--
-- security invoker: политика чтения применяется как есть. Фильтр
-- created_by = auth.uid() продублирован явно — итог по деньгам не должен
-- зависеть от того, что политику когда-нибудь расширят (руководителю), а
-- функцию забудут.
create function public.expenses_period(p_from date, p_to date, p_spent_by uuid default null)
returns jsonb
language plpgsql
stable
security invoker
set search_path to ''
as $function$
declare
  result jsonb;
begin
  if not (select private.is_app_member()) then
    raise exception 'Not an application member';
  end if;

  select jsonb_build_object(
    'rows', coalesce(jsonb_agg(
      jsonb_build_object(
        'id', e.id,
        'name', e.name,
        'spent_on', e.spent_on,
        'amount', e.amount,
        'spent_by', e.spent_by,
        'created_at', e.created_at,
        'updated_at', e.updated_at
      )
      -- id — добивка порядка для строк, созданных в один момент.
      order by e.spent_on desc, e.created_at desc, e.id
    ), '[]'::jsonb),
    'total', coalesce(sum(e.amount), 0),
    'count', count(*)
  ) into result
  from public.expenses e
  where e.created_by = (select auth.uid())
    and e.spent_on >= p_from
    and e.spent_on <= p_to
    and (p_spent_by is null or e.spent_by = p_spent_by);

  return result;
end;
$function$;

-- Default privileges Supabase раздают EXECUTE каждой новой функции, в том числе
-- anon, — снимаем явно, как во всех миграциях проекта.
revoke all on function public.expenses_period(date, date, uuid) from public, anon;
grant execute on function public.expenses_period(date, date, uuid) to authenticated;

notify pgrst, 'reload schema';
