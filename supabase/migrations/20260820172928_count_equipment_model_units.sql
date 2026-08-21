-- Счёт единиц одной модели по ТОМУ ЖЕ правилу сопоставления, по которому
-- update_equipment_model_and_unit разносит правку описательных полей:
-- lower(btrim(brand)) + lower(btrim(model)). Клиент до сих пор считал через
-- .eq по сырым строкам, поэтому на записях с ведущими/хвостовыми пробелами его
-- цифра расходилась с числом строк, которые реально задевал серверный update.
-- security invoker: считаем ровно то, что видит сам пользователь по RLS equipment.
create or replace function public.count_equipment_model_units(p_brand text, p_model text)
 returns integer
 language sql
 stable
 security invoker
 set search_path to ''
as $function$
  select count(*)::integer
  from public.equipment e
  where lower(btrim(e.brand)) = lower(btrim(p_brand))
    and lower(btrim(e.model)) = lower(btrim(p_model));
$function$;

-- revoke обязателен: по умолчанию execute на новую функцию достаётся public,
-- то есть и анониму. Строки ему всё равно закроет RLS, но право не выдаём.
revoke all on function public.count_equipment_model_units(text, text) from public;
grant execute on function public.count_equipment_model_units(text, text) to authenticated;
