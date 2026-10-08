-- Поправка к М1 (с57, поймано первым прогоном): project_meal_orders_dish_check
-- пропускал «dish null + price»: btrim(null) <> '' даёт NULL, а CHECK с NULL
-- проходит. Отдельное ограничение, а не замена: drop constraint MCP-коннектор
-- отклоняет (gotchas §3), а два именованных правила читаются и так —
-- dish_check держит форму блюда, это — «не ест = без цены».
alter table public.project_meal_orders
  add constraint project_meal_orders_no_dish_no_price_check
  check (dish is not null or price is null);
