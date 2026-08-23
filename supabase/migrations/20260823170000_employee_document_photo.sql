-- Фото для документов (с19): у сотрудника несколько фото, в списки «на мероприятие»
-- и в миниатюру идёт одно — выбранное. Пусто → клиент берёт последнее загруженное.
-- Правило живёт в базе: две вкладки или импорт его не потеряют.

-- Составной FK ниже требует уникальности пары (employee_id, id): id и так PK,
-- пара нужна лишь как цель ссылки.
alter table public.employee_files
  add constraint employee_files_employee_id_id_key unique (employee_id, id);

-- Ссылка парой (id сотрудника, id файла) → (employee_id, id): чужое фото назначить
-- нельзя, база отбивает 23503 без триггера и без чтения employee_files под RLS.
-- on delete set null — на случай мостового удаления файла.
alter table public.employees
  add column document_photo_id uuid,
  add constraint employees_document_photo_fkey
    foreign key (id, document_photo_id)
    references public.employee_files (employee_id, id)
    on delete set null;

comment on column public.employees.document_photo_id is
  'Фото для документов и миниатюры; NULL — клиент берёт последнее загруженное.';

-- Вид файла FK не проверит — смотрим триггером: документом может быть только фото,
-- не скан паспорта. security definer: у authenticated на employee_files только
-- SELECT под RLS члена, триггеру нужен гарантированный доступ к строке.
create or replace function public.check_employee_document_photo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  file_kind text;
begin
  if new.document_photo_id is null then
    return new;
  end if;
  select kind into file_kind
    from public.employee_files
   where id = new.document_photo_id;
  if file_kind is distinct from 'photo' then
    raise exception 'document photo must be a photo file'
      using errcode = '23514', constraint = 'employees_document_photo_kind_check';
  end if;
  return new;
end;
$$;

revoke all on function public.check_employee_document_photo() from public, anon;

drop trigger if exists trg_check_employee_document_photo on public.employees;
create trigger trg_check_employee_document_photo
  before insert or update of document_photo_id on public.employees
  for each row execute function public.check_employee_document_photo();

notify pgrst, 'reload schema';
