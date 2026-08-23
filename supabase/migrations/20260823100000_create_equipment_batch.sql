-- U34-L: партия одинаковых устройств заводится одной формой — общие поля модели
-- плюс массив серийников, по строке каталога на номер. Всё в одной транзакции:
-- либо вся партия, либо ничего.
--
-- Дубли решает сервер, и это главная причина, по которой партия — RPC, а не
-- цикл клиентских insert'ов. UNIQUE на equipment.serialnumber в проде нет и
-- поставить его нельзя до физической сверки наклеек (11 живых повторов), так
-- что до сих пор дубль держал только клиентский ilike-чек с гонкой двух
-- вкладок. Здесь гонку закрывает pg_advisory_xact_lock по нормализованному
-- номеру: две одновременные партии с одним серийником выстраиваются в очередь,
-- и вторая видит строку первой уже закоммиченной. Локи берутся в
-- отсортированном порядке — иначе две партии с пересечением в разном порядке
-- взяли бы друг друга в deadlock.
--
-- Дубль — не исключение, а ответ {"status":"duplicates","serials":[...]}:
-- клиент показывает список на своём языке, в базу не записано ничего.
-- Исключения оставлены случаям «так звать нельзя» (пусто, слишком много,
-- нет обязательных полей).
--
-- Функция security invoker: INSERT-политика equipment (technician/manager/
-- admin) применяется к каждой строке как обычно, журнал движений пишет
-- триггер. Проверка is_app_member в начале — только ради внятной ошибки
-- вместо голого отказа RLS.

create function public.create_equipment_batch(
  p_brand text,
  p_model text,
  p_type text,
  p_subtype text,
  p_availability text,
  p_location text,
  p_lengthinmeters text,
  p_technicalspecification text,
  p_description text,
  p_serialnumbers text[]
)
returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  serials text[];
  norm text;
  dupes text[];
  inserted_ids uuid[];
begin
  if not (select private.is_app_member()) then
    raise exception 'Not an application member';
  end if;

  -- Пустые строки выбрасываются до всех проверок: «серийник из пробелов» — это
  -- не серийник, а случайный Enter в textarea.
  select coalesce(array_agg(btrim(s)), '{}'::text[]) into serials
  from unnest(coalesce(p_serialnumbers, '{}'::text[])) s
  where btrim(s) <> '';

  if array_length(serials, 1) is null then
    raise exception 'At least one serial number is required';
  end if;
  if array_length(serials, 1) > 200 then
    raise exception 'Batch is limited to 200 serial numbers';
  end if;
  if nullif(btrim(p_brand), '') is null or nullif(btrim(p_model), '') is null
    or nullif(btrim(p_type), '') is null or nullif(btrim(p_subtype), '') is null
    or nullif(btrim(p_location), '') is null then
    raise exception 'Brand, model, type, subtype and location are required';
  end if;

  for norm in select distinct lower(s) from unnest(serials) s order by 1 loop
    perform pg_advisory_xact_lock(hashtextextended(norm, 0));
  end loop;

  -- Повторы внутри партии и совпадения с каталогом — одним списком: человеку
  -- всё равно, откуда дубль, ему нужно знать, какие номера перепроверить.
  -- Сравнение регистронезависимое, как и клиентская проверка (ilike).
  select coalesce(array_agg(distinct s), '{}'::text[]) into dupes
  from unnest(serials) s
  where lower(s) in (
      select lower(s2) from unnest(serials) s2 group by lower(s2) having count(*) > 1
    )
    or exists (
      select 1 from public.equipment e where lower(btrim(e.serialnumber)) = lower(s)
    );

  if array_length(dupes, 1) is not null then
    return jsonb_build_object('status', 'duplicates', 'serials', to_jsonb(dupes));
  end if;

  with new_rows as (
    insert into public.equipment (
      brand, model, serialnumber, type, subtype, count, availability, location,
      technicalspecification, lengthinmeters, description
    )
    select
      btrim(p_brand), btrim(p_model), s, btrim(p_type), btrim(p_subtype), 1,
      coalesce(nullif(btrim(p_availability), ''), 'available'), btrim(p_location),
      nullif(btrim(p_technicalspecification), ''),
      -- 'N/A' — способ базы сказать «длина не применима», как в одиночном заведении.
      coalesce(nullif(btrim(p_lengthinmeters), ''), 'N/A'),
      nullif(btrim(p_description), '')
    from unnest(serials) s
    returning id
  )
  select coalesce(array_agg(id), '{}'::uuid[]) into inserted_ids from new_rows;

  return jsonb_build_object(
    'status', 'created',
    'count', coalesce(array_length(inserted_ids, 1), 0),
    'ids', to_jsonb(inserted_ids)
  );
end;
$function$;

-- Default privileges Supabase раздают EXECUTE каждой новой функции, в том числе
-- anon, — снимаем явно, как во всех миграциях проекта.
revoke all on function public.create_equipment_batch(text, text, text, text, text, text, text, text, text, text[]) from public, anon;
grant execute on function public.create_equipment_batch(text, text, text, text, text, text, text, text, text, text[]) to authenticated;
