-- Веха 3, «клиенту не верим»: уникальность серийника держит база на ВСЕХ путях
-- записи, а не только в двух RPC.
--
-- До этой миграции дубль проверяли create_equipment_batch и add_equipment_unit
-- (под advisory-локом), а одиночное заведение шло прямым insert'ом с клиентским
-- check-then-insert: две вкладки создавали дубль, прямой REST-запрос — тоже.
-- Правка serialnumber прямым UPDATE не проверялась вообще.
--
-- Почему триггер, а не UNIQUE-индекс: в проде 10 групп живых повторов (21
-- строка) плюс повтор заглушки — индекс на них не создаётся, а развести их
-- можно только сверкой наклеек на складе. Триггер запрещает НОВЫЕ дубли и не
-- трогает старые: UPDATE срабатывает, лишь когда нормализованный номер
-- меняется, поэтому строки из старых повторов остаются редактируемыми.
-- Настоящий UNIQUE — после сверки, отдельной миграцией.
--
-- Ключ лока тот же, что в обеих RPC (hashtextextended(lower(btrim(номер)), 0)):
-- триггер встаёт с ними в одну очередь, а внутри RPC лок реентерабелен.
--
-- Что не считается номером и не проверяется — тот же набор, что в
-- add_equipment_unit и normalizeEquipment на клиенте: заглушки, нули и
-- сгенерированные идентификаторы количественных строк. Ручной инвентарный код
-- (QTY::CODE::…) проверяется наравне с серийником.
--
-- security definer: проверка обязана видеть все строки независимо от
-- SELECT-политики вызывающего. Наружу функция не торчит — схема private.

create function private.enforce_equipment_serial_unique()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  norm text;
begin
  norm := lower(btrim(new.serialnumber));

  -- NULL отклонит NOT NULL колонки — своим, более внятным текстом.
  if norm is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and norm is not distinct from lower(btrim(old.serialnumber)) then
    return new;
  end if;

  if norm in ('', 'n/a', 'na', 'нет', 'без номера', 'б/н', 'none', 'null', '-')
    or norm ~ '^0+$'
    or btrim(new.serialnumber) like 'QTY::AUTO::%'
    or btrim(new.serialnumber) like 'AUTO-%' then
    return new;
  end if;

  -- Многострочный insert в обход RPC берёт локи в порядке строк, а не
  -- отсортированно: пересечение с партией может дать deadlock, Postgres его
  -- снимет ошибкой. Клиент многострочных прямых вставок не делает.
  perform pg_advisory_xact_lock(hashtextextended(norm, 0));

  if exists (
    select 1 from public.equipment e
    where lower(btrim(e.serialnumber)) = norm
      and e.id is distinct from new.id
  ) then
    raise exception using
      errcode = 'unique_violation',
      message = 'Equipment serial number already exists',
      constraint = 'equipment_serialnumber_unique';
  end if;

  return new;
end;
$function$;

revoke all on function private.enforce_equipment_serial_unique() from public, anon, authenticated;

create trigger trg_equipment_serial_unique
  before insert or update of serialnumber on public.equipment
  for each row execute function private.enforce_equipment_serial_unique();

-- Под выражение, по которому ищут и триггер, и обе RPC: обычный btree по сырой
-- колонке (idx_equipment_serialnumber) для lower(btrim(...)) не используется.
create index equipment_serial_normalized_idx
  on public.equipment using btree (lower(btrim(serialnumber)));
