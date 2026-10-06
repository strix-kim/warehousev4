-- Индекс под серверное правило сопоставления модели: и count_equipment_model_units,
-- и update_equipment_model_and_unit, и reservation_shortages сравнивают модель как
-- lower(btrim(brand)) + lower(btrim(model)). По сырым колонкам такой предикат
-- индексом не покрывается, поэтому каждый вызов reservation_shortages шёл
-- последовательным чтением equipment (~1307 буферов на вызов).
create index if not exists equipment_model_normalized_idx
  on public.equipment (lower(btrim(brand)), lower(btrim(model)));
