-- Бакет файлов сотрудников (с17) — ПЕРВЫЙ Storage-бакет проекта.
-- Приватный: наружу файлы уходят только по signed URL, который выдаётся
-- аутентифицированному члену приложения. Пути: {employee_id}/{вид}/{uuid}.{ext}.
-- Лимит 10 МБ и белый список типов — на уровне бакета, клиентские проверки — UX.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'employee-files',
  'employee-files',
  false,
  10485760, -- 10 МБ
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Политики на storage.objects: читает член приложения, грузит staff.
-- UPDATE/DELETE политик нет — под RLS это запрет: файл нельзя ни переписать
-- (пути уникальны uuid-ом, upsert клиенту не нужен), ни удалить через клиента.
drop policy if exists employee_files_select_for_members on storage.objects;
create policy employee_files_select_for_members on storage.objects
  for select to authenticated
  using (bucket_id = 'employee-files' and private.is_app_member());

drop policy if exists employee_files_insert_for_staff on storage.objects;
create policy employee_files_insert_for_staff on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'employee-files'
    and private.has_any_role(array['technician', 'manager', 'admin'])
  );
