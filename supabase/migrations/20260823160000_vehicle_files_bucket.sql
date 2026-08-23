-- Бакет фото автомобилей (с18) — зеркало employee-files.
-- Приватный: наружу только по signed URL члену приложения.
-- Пути: {vehicle_id}/photo/{uuid}.{ext}. Лимит и белый список — на бакете.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vehicle-files',
  'vehicle-files',
  false,
  10485760, -- 10 МБ
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Политики на storage.objects: читает член приложения, грузит staff.
-- UPDATE/DELETE политик нет — под RLS это запрет: переписать или удалить
-- файл через клиента нельзя (канон с17 «только добавление»).
drop policy if exists vehicle_files_select_for_members on storage.objects;
create policy vehicle_files_select_for_members on storage.objects
  for select to authenticated
  using (bucket_id = 'vehicle-files' and private.is_app_member());

drop policy if exists vehicle_files_insert_for_staff on storage.objects;
create policy vehicle_files_insert_for_staff on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'vehicle-files'
    and private.has_any_role(array['technician', 'manager', 'admin'])
  );
