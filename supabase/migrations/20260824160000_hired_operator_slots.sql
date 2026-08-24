-- Слот «Наём» (с21, решение прораба): кор-группа живёт в employees, а операторов
-- часто берут со стороны, и на этапе планирования важно занять место «просто
-- оператором», не зная имени, — чтобы счётчик честно говорил, сколько внешних
-- нанимать. Ячейка теперь бывает в трёх состояниях: пустая (не решено), человек,
-- слот наёма (решено: берём внешнего). Слот — НЕ возврат вакансий-записей с20:
-- вакансия по-прежнему выражается отсутствием строки.
--
-- Правило «слот только в строке с ролью оператора» живёт в UI (кнопка видна
-- только там), базой не проверяется — планирование черновик; строка в backlog.

-- 1. employee_id снова nullable: слот занимает ячейку без человека.
alter table public.hall_assignments
  alter column employee_id drop not null;

-- 2. Флаг слота. Ровно одно из двух: либо человек, либо слот. Запись без обоих
-- (вакансия-призрак, упразднённая в 20260824140000) и запись с обоими база не
-- пустит; существующие строки проходят CHECK как есть (человек + false).
alter table public.hall_assignments
  add column if not exists is_external boolean not null default false;

alter table public.hall_assignments
  add constraint hall_assignments_person_or_slot_check
  check ((employee_id is null) = is_external);

-- 3. FK на сотрудника: был on delete set null — при NOT NULL с20 удаление
-- занятого в плане сотрудника падало нарушением NOT NULL, а с CHECK-ом выше
-- падало бы нарушением CHECK: set null оставил бы «не слот и без человека».
-- Каскад честнее: ушёл из реестра — его ячейки в планах освобождаются
-- (планы — черновики со staff-DELETE, а не реестр).
alter table public.hall_assignments
  drop constraint if exists hall_assignments_employee_id_fkey;

alter table public.hall_assignments
  add constraint hall_assignments_employee_id_fkey
  foreign key (employee_id) references public.employees(id) on delete cascade;

notify pgrst, 'reload schema';
