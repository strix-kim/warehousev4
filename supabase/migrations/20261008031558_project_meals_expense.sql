-- Обеды на мероприятии, М2 (с57, план meals-s56 §1.5): «В расходы». Ссылка
-- обед → расход, замок ввода после внесения и RPC, которая делает это одной
-- транзакцией.
--
-- expenses — owner-таблица на чтение: второй аккаунт чужой расход не видит.
-- Ссылка видна всем (обеды общие), сам расход — только автору. FK-проверка и
-- on delete set null идут мимо RLS: автор удалил расход у себя в журнале — обед
-- снова «не в расходах», ввод открыт.

alter table public.project_meals
  add column expense_id uuid references public.expenses(id) on delete set null;

-- Под действие FK при удалении расхода.
create index project_meals_expense_id_idx
  on public.project_meals (expense_id) where expense_id is not null;

-- Внесённый в расходы обед нельзя вернуть в «собираем»/«заказано».
alter table public.project_meals
  add constraint project_meals_expense_status_check
  check (expense_id is null or status = 'delivered');

-- Замок: после «В расходы» строки заказа не меняются — иначе сумма обеда и
-- расхода разошлись бы молча. Пара к запертому вводу в UI. Разблокировка —
-- удалить расход в журнале (FK обнулит expense_id).
-- Родителя нет (каскад удаления мероприятия: project_meals уже удаляется, его
-- строки каскадом) → пропускаем.
create function public.guard_meal_orders_locked()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_locked boolean;
begin
  select m.expense_id is not null into v_locked
    from public.project_meals m
    where m.id = coalesce(new.meal_id, old.meal_id);
  if coalesce(v_locked, false) then
    raise exception 'project_meal_locked';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_meal_orders_locked() from public, anon, authenticated;

create trigger trg_guard_meal_orders_locked
  before insert or update or delete on public.project_meal_orders
  for each row execute function public.guard_meal_orders_locked();

-- «В расходы» одной транзакцией. Security invoker: расход пишет сам вызывающий
-- (политика expenses_insert_for_owner держит владельца и роль, CHECK-и
-- expenses_* — форму), ссылку ставит update по политике project_meals.
-- for update на обеде — пара к двойному нажатию и двум вкладкам: второй вызов
-- дождётся первого и увидит expense_id.
-- Сумму шлёт клиент (предзаполнена суммой цен, правится): у кафе бывает
-- обслуживание и чек без цен по блюдам. Дата расхода — meal_on из базы.
create function public.create_meal_expense(
  p_meal_id uuid,
  p_name text,
  p_amount bigint,
  p_spent_by uuid,
  p_comment text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_meal public.project_meals%rowtype;
  v_expense_id uuid;
begin
  if not (select private.is_app_member()) then
    raise exception 'Not an application member';
  end if;

  select * into v_meal
    from public.project_meals
    where id = p_meal_id
    for update;
  if not found then
    raise exception 'meal_not_found';
  end if;
  if v_meal.status <> 'delivered' then
    raise exception 'meal_not_delivered';
  end if;
  if v_meal.expense_id is not null then
    raise exception 'meal_expense_exists';
  end if;

  insert into public.expenses (name, spent_on, amount, spent_by, comment)
    values (p_name, v_meal.meal_on, p_amount, p_spent_by, p_comment)
    returning id into v_expense_id;

  update public.project_meals
    set expense_id = v_expense_id
    where id = p_meal_id;

  return v_expense_id;
end;
$function$;

revoke all on function public.create_meal_expense(uuid, text, bigint, uuid, text) from public, anon;
grant execute on function public.create_meal_expense(uuid, text, bigint, uuid, text) to authenticated;

notify pgrst, 'reload schema';
