import { supabase } from '../../lib/supabase'
import { hallColorAt, type Hall, type HallPlan, type Tr } from './types'

// Зал на карточке плана — цветная точка с именем. Полная строка там не нужна:
// created_by и created_at на карточке не показывают, а редактор в Ш4 читает залы
// своим запросом.
export type HallBrief = Pick<Hall, 'id' | 'name' | 'color' | 'sort_order'>
export type HallPlanWithHalls = HallPlan & { halls: HallBrief[] }

export type HallPlanInput = {
  name: string
  // Даты — строки YYYY-MM-DD, как их отдаёт AppDatePicker. Пустая строка значит
  // «не указана» и уезжает в базу как NULL: пустая дата и NULL — одно и то же,
  // и второго способа записать «не знаю» быть не должно.
  eventFrom: string
  eventTo: string
}

// Раскладка формы в строку плана. Одна на вставку и на правку: разъедься они,
// новая колонка попала бы в создание и терялась при редактировании.
// Имя тримим здесь, а не триггером: normalize_hall_name висит на залах и
// позициях, у hall_plans его нет — там от имени осталась только проверка
// «не пустое» (btrim(name) <> ''), и хвостовые пробелы срезать больше некому.
function planRow(input: HallPlanInput) {
  return {
    name: input.name.trim(),
    event_from: input.eventFrom || null,
    event_to: input.eventTo || null,
  }
}

export async function fetchHallPlans(): Promise<HallPlanWithHalls[]> {
  if (!supabase) throw new Error('Supabase не настроен')
  const { data, error } = await supabase
    .from('hall_plans')
    .select('*, halls(id, name, color, sort_order)')
    // Свежий сверху: updated_at двигает база на любую правку зала или позиции,
    // поэтому «над чем работали вчера» стоит первым. Полный ключ (…, id) — от
    // двух планов, задетых одним триггером в одну миллисекунду.
    .order('updated_at', { ascending: false })
    .order('id')
    // Сто планов — предел ВИДИМОСТИ, а не хранения: из базы ничего не пропадает,
    // просто самые старые перестают приезжать на страницу. Тот же приём, что у
    // списков с их страницей на 50; упрёмся — сюда придёт пагинация.
    .limit(100)
  if (error) throw error
  return data ?? []
}

// Один план прямо по id — вместе с залами: прямая ссылка на /halls/:planId
// обязана открываться без загруженного списка. null — строки нет (или её не
// видно политикой), и это НЕ отказ запроса: отказ прилетает исключением.
export async function fetchHallPlan(id: string): Promise<HallPlanWithHalls | null> {
  if (!supabase) throw new Error('Supabase не настроен')
  const { data, error } = await supabase
    .from('hall_plans')
    .select('*, halls(id, name, color, sort_order)')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}

// Создание идёт в ДВЕ ступени: план, потом пачка залов — одним запросом их не
// вставить, у залов нужен plan_id из ответа первой. Вторая ступень отказывает
// отдельно: план при этом УЖЕ создан, и молча «откатывать» его удалением нельзя
// (удаление тоже может не пройти). Поэтому ошибка залов не бросается, а
// возвращается рядом с планом: вызывающий уводит человека в редактор, где залы
// добавляются кнопкой «+ Зал», и докладывает отказ в канал.
//
// Имена залов — ДАННЫЕ, а не интерфейс: они лягут в базу строкой и останутся
// такими для всех. Язык берём тот, на котором работает создатель, — ровно как
// если бы он набрал «Зал 1» руками.
export async function createHallPlan(
  input: HallPlanInput,
  hallCount: number,
  tr: Tr,
): Promise<{ plan: HallPlan; hallsError: unknown }> {
  if (!supabase) throw new Error('Supabase не настроен')

  const { data: plan, error } = await supabase
    .from('hall_plans')
    .insert(planRow(input))
    .select()
    .single()
  if (error) throw error

  if (hallCount <= 0) return { plan, hallsError: null }

  const rows = Array.from({ length: hallCount }, (_, index) => ({
    plan_id: plan.id,
    name: tr(`Зал ${index + 1}`, `${index + 1}-zal`),
    color: hallColorAt(index),
    sort_order: index,
  }))

  // defaultToNull: false — это Prefer: missing=default. Без него пачечная
  // вставка подставляет NULL в НЕ переданный created_by, а политика вставки
  // требует created_by = auth.uid(): все залы отлетели бы по RLS.
  const { error: hallsError } = await supabase.from('halls').insert(rows, { defaultToNull: false })
  return { plan, hallsError: hallsError ?? null }
}

// Правка шапки плана без оптимистичной блокировки: планов десятки, правят их по
// одному — при гонке двух вкладок выигрывает последняя запись (last-write-wins).
export async function updateHallPlan(id: string, input: HallPlanInput): Promise<HallPlan> {
  if (!supabase) throw new Error('Supabase не настроен')
  const { data, error } = await supabase
    .from('hall_plans')
    .update(planRow(input))
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// Залы и позиции уходят вместе с планом каскадом внешних ключей — отдельных
// удалений здесь нет и быть не должно: три запроса вместо одного дали бы план
// без залов, если второй не прошёл.
export async function deleteHallPlan(id: string): Promise<void> {
  if (!supabase) throw new Error('Supabase не настроен')
  const { error } = await supabase.from('hall_plans').delete().eq('id', id)
  if (error) throw error
}

// Перевод отказа базы в человеческую фразу. Разбираем ИМЕНЕМ ограничения, а не
// одним кодом 23514: под ним же придёт любой будущий CHECK, и «даты не сходятся»
// в ответ на другое нарушение было бы враньём.
export function hallPlanErrorText(error: unknown, tr: Tr): string {
  const candidate = (typeof error === 'object' && error !== null ? error : {}) as { code?: unknown; message?: unknown }
  const code = typeof candidate.code === 'string' ? candidate.code : ''
  const message = typeof candidate.message === 'string' ? candidate.message : ''

  if (message.includes('hall_plans_dates_check')) {
    return tr('Дата окончания раньше даты начала.', 'Tugash sanasi boshlanish sanasidan oldin.')
  }
  if (code === '23514' && message.includes('name')) {
    return tr('Название не может быть пустым.', 'Nom bo‘sh bo‘lishi mumkin emas.')
  }
  return tr('Не удалось сохранить план. Проверьте поля и повторите попытку.', 'Rejani saqlab bo‘lmadi. Maydonlarni tekshirib, qayta urinib ko‘ring.')
}
