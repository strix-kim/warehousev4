-- «Производственные расходы»: необязательная графа «Комментарий» (корректировка
-- прораба, с52). Колонка аддитивная: nullable и без default, существующие строки
-- остаются с null.
--
-- Пустую строку в базе не храним: «комментария нет» — это null, и только null.
-- Иначе у одного смысла два значения, и выборка «без комментария» врёт. Клиент
-- шлёт null, а CHECK отбивает и '' и строку из одних пробелов. Края не режем
-- триггером: normalize_hall_name знает только колонку name, новой триггерной
-- функции ради необязательного поля не заводим — края обрезает клиент.
--
-- Предел 500 знаков — защита от вставленной простыни, а не продуктовый лимит.
-- Ограничение именованное: клиент разбирает отказ по имени (expenseErrorText).
--
-- Политики RLS и гранты таблицы не меняются: журнал остаётся строго владельцу,
-- грант на таблицу покрывает и новую колонку.

alter table public.expenses add column comment text;

alter table public.expenses
  add constraint expenses_comment_check
  check (comment is null or (btrim(comment) <> '' and char_length(comment) <= 500));

-- Та же функция с ключом 'comment' в строке. Сигнатура прежняя, поэтому
-- create or replace: права на функцию при замене тела сохраняются. Ключ
-- добавлен, ни один не убран — клиент прошлой сборки новый ключ не читает и
-- работает как раньше.
create or replace function public.expenses_period(p_from date, p_to date, p_spent_by uuid default null)
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
        'comment', e.comment,
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

-- Права повторены явно, как во всех миграциях проекта (gotchas §3): замена тела
-- их не трогает, но проверять это каждый раз выборкой дороже, чем две строки.
revoke all on function public.expenses_period(date, date, uuid) from public, anon;
grant execute on function public.expenses_period(date, date, uuid) to authenticated;

notify pgrst, 'reload schema';
