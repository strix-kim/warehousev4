-- Применено прорабом вставкой в SQL Editor (с45, 2026-10-06): MCP-коннектор
-- отклоняет любой вызов со словом DELETE по живым данным. В историю миграций
-- прода запись внесена руками под этой же версией.
--
-- Веха 3: настоящий UNIQUE на серийник вместо триггера из 20261004120000.
--
-- Триггер был обходом: индекс не создавался из-за 10 групп старых повторов
-- (21 строка, почти все — импорт 2025-06-28). Прораб решил (с44) убрать повторы
-- без сверки наклеек: в каждой группе остаётся старейшая строка, остальные
-- удаляются. Агент возражал по трём группам (Baseus CAHUB-CX0G, WiWU Alpha
-- HDMI, Commlite): там номер стоял у ВСЕХ единиц модели, что похоже на код
-- партии у настоящих устройств, а не на задвоение. Если на полке их окажется
-- больше, чем в каталоге, — заводить заново через «+1 единица» с настоящим
-- номером.
--
-- Удалённые строки — точные копии оставшихся (все поля, кроме id), поэтому
-- отдельного бэкапа нет: вернуть карточку = вставить копию строки-хранителя.
-- Исключение — Canon: удалена вторая карточка того же объектива под именем
-- модели «Ultrasonic-1635» (заведена вручную 2025-10-10, пустые описание,
-- характеристики и длина).
--
--   удалена                                хранитель                              номер
--   c38c2b54-3928-41f4-8bfa-a9adfc32d872   73fddfd4-62df-4e94-8e94-9a7fccb359a5   1250001369 (Canon)
--   ff64bfd6-5933-4e5a-b778-537fd6eaf314   f86c41f8-a708-45f4-b2ce-1ea463e9d8d6   2021012901 (WiWU Alpha HDMI)
--   fb5ed6f7-8b53-403a-a8e2-0200397c7b92   61cb194b-efcc-48ae-8ed4-30f993bb72b2   2181A50002822 (TP-Link TL-SG1016D)
--   7962b728-9ed7-42f7-9cea-4a9b48b57648   c62201ea-005f-49fc-8514-2c814e19663b   2300006573 23281400 (Televic BP G4)
--   ff33462c-a6ab-47e9-9d1f-c034de524315   a7c3fa3f-b224-4f5e-8605-57993aac207e   2300008797 23390018 (Televic BP G4)
--   794e6413-6163-4b77-ab8e-78155d3bab87   46d8229c-51a7-40f9-a544-7ee6d1057063   9417011003 (Commlite)
--   1c8e9fc9-c3c8-460f-a7e5-2cd427cb93e6   6b5ff881-29ed-46a0-9f97-8f5639b3c72b   AH00001EA07A0072 (ITC TS-0370HD)
--   8ebc2f17-962e-4a22-8ca0-9bbeb0b9779c   4dbc6858-bd7b-4bc9-8db5-634ae4f738a9   AH00001EK25A0036 (ITC TS-0370H-16)
--   8daf00aa-e6b7-47db-acc2-cb5a48165ccc   385e3c29-257d-4797-8863-1315b6824b79   S1J12310160 (PTZ OPTICS PT30X)
--   1bc45cdd-3670-43a1-ad95-12f4c68efea6   063e95d0-af4b-4d62-a576-0df659c291a0   XL221101 (Baseus CAHUB-CX0G)
--   fb0fee4a-0c7a-4b89-9936-7bafb50f7db6   063e95d0-af4b-4d62-a576-0df659c291a0   XL221101 (Baseus CAHUB-CX0G)
--
-- Каскадом ушли 10 строк equipment_movements — у каждой удалённой единицы была
-- одна служебная запись status_normalized от 2026-08-19.

do $$
declare
  doomed uuid[] := array[
    'c38c2b54-3928-41f4-8bfa-a9adfc32d872', 'ff64bfd6-5933-4e5a-b778-537fd6eaf314',
    'fb5ed6f7-8b53-403a-a8e2-0200397c7b92', '7962b728-9ed7-42f7-9cea-4a9b48b57648',
    'ff33462c-a6ab-47e9-9d1f-c034de524315', '794e6413-6163-4b77-ab8e-78155d3bab87',
    '1c8e9fc9-c3c8-460f-a7e5-2cd427cb93e6', '8ebc2f17-962e-4a22-8ca0-9bbeb0b9779c',
    '8daf00aa-e6b7-47db-acc2-cb5a48165ccc', '1bc45cdd-3670-43a1-ad95-12f4c68efea6',
    'fb0fee4a-0c7a-4b89-9936-7bafb50f7db6'
  ]::uuid[];
  removed integer;
begin
  -- На чистой базе (baseline + миграции) этих строк нет — шаг пропускается.
  if not exists (select 1 from public.equipment where id = any (doomed)) then
    return;
  end if;

  -- Единица в сохранённом списке — стоп: equipment_ids не внешний ключ,
  -- удаление оставило бы в списке висячую ссылку.
  if exists (
    select 1 from public.equipment_lists l
    where exists (
      select 1 from jsonb_array_elements_text(to_jsonb(l.equipment_ids)) x
      where x = any (doomed::text[])
    )
  ) then
    raise exception 'Duplicate equipment row is referenced by a saved list';
  end if;

  -- Удаляем только то, у чего хранитель с тем же номером действительно остаётся.
  delete from public.equipment e
  where e.id = any (doomed)
    and exists (
      select 1 from public.equipment k
      where k.id <> all (doomed)
        and lower(btrim(k.serialnumber)) = lower(btrim(e.serialnumber))
    );
  get diagnostics removed = row_count;

  if removed <> 11 then
    raise exception 'Expected to delete 11 duplicate rows, got %', removed;
  end if;
end;
$$;

-- Уникальность нормализованного номера. Вне индекса — то, что номером не
-- является: заглушки, нули и сгенерированные идентификаторы количественных
-- строк; набор тот же, что в add_equipment_unit и normalizeEquipment на
-- клиенте. Ручной инвентарный код (QTY::CODE::…) уникален наравне с серийником.
create unique index equipment_serialnumber_unique
  on public.equipment using btree (lower(btrim(serialnumber)))
  where lower(btrim(serialnumber)) not in ('', 'n/a', 'na', 'нет', 'без номера', 'б/н', 'none', 'null', '-')
    and btrim(serialnumber) !~ '^0+$'
    and btrim(serialnumber) not like 'QTY::AUTO::%'
    and btrim(serialnumber) not like 'AUTO-%';

-- Триггер делал то же самое руками и с отдельным списком исключений — второй
-- владелец одного правила. Индекс закрывает и гонку, и прямой REST сам.
-- equipment_serial_normalized_idx (обычный, из той же миграции) остаётся:
-- частичный индекс не обслуживает поиск дубля в RPC без его предиката.
drop trigger trg_equipment_serial_unique on public.equipment;
drop function private.enforce_equipment_serial_unique();
