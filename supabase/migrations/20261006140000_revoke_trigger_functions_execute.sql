-- Веха 4, advisors security, lint 0029: check_employee_document_photo — security
-- definer и при этом вызывается `authenticated` через /rest/v1/rpc.
--
-- Триггерной функции EXECUTE у вызывающего не нужен: право проверяется один раз, у
-- создателя триггера в момент create trigger, а не при срабатывании. Остальные
-- триггерные функции схемы (update_updated_at_column и др.) живут без этого гранта.
-- Грант появился не из миграции, а из default privileges Supabase (gotchas §3):
-- revoke from public, anon прямой грант authenticated не снимает.
--
-- Заодно тот же грант снят с четырёх invoker-триггерных функций: линтер их не
-- отмечает, но точка /rpc для функции, возвращающей trigger, не нужна никому.
revoke execute on function public.check_employee_document_photo() from authenticated;
revoke execute on function public.normalize_employee_fields() from authenticated;
revoke execute on function public.normalize_vehicle_fields() from authenticated;
revoke execute on function public.normalize_hall_name() from authenticated;
revoke execute on function public.touch_hall_plan() from authenticated;

notify pgrst, 'reload schema';
