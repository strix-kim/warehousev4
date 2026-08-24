-- Порядок чипов справочника = порядок бумажного образца прораба.
-- Шестёрка засева легла insert-ами с одинаковым created_at (до микросекунды),
-- и `order by created_at, id` разводил их случайным uuid — стабильно, но не так,
-- как на бумаге. Разносим created_at фиксированной лесенкой в прошлом: данные,
-- не схема; позиции, добавленные людьми, получают now() и всегда встают ПОСЛЕ
-- стандартных. UPDATE по живым засеянным строкам — косметика порядка, объявлено.

update public.position_catalog
set created_at = timestamptz '2026-08-24 00:00:00+00' + make_interval(secs => ord.n)
from (values
  ('millumin', 0),
  ('zoom', 1),
  ('ppt', 2),
  ('камеры / ptz', 3),
  ('страховка', 4),
  ('операторы', 5)
) as ord(key, n)
where lower(btrim(position_catalog.name)) = ord.key
  and position_catalog.created_by is null; -- только засеянные: одноимённую людскую не трогаем

notify pgrst, 'reload schema';
