-- Догоняющая правка к count_equipment_model_units: revoke from public не снимает
-- прямой grant, который anon получает через default privileges Supabase на новые
-- функции. Проверка information_schema после первой миграции показала anon в
-- grantee — снимаем явно. Данные и так закрыты RLS, право просто лишнее.
revoke execute on function public.count_equipment_model_units(text, text) from anon;
