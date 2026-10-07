import { supabase } from '../../lib/supabase'
import { cachedQuery, readCachedQuery, readCachedQueryMeta } from '../../lib/persistentCache'
import { escapeLikePattern } from '../../lib/postgrest'
import { invalidateProjectsCache, PROJECTS_LIST_CACHE_KEY, VENUES_CACHE_KEY } from './cacheKeys'
import type { ProjectBrief, ProjectHallPlanRow, ProjectInput, ProjectListItem, ProjectListRow, ProjectWithVenue, Tr, Venue, VenueInput } from './types'

// TTL как у планов залов: мероприятие правят с трёх сторон (реквизиты, состав,
// списки), и чужая правка должна доезжать за минуты.
const PROJECTS_CACHE_TTL = 5 * 60 * 1000
// Места меняются редко, но новое место заводят прямо из формы — его приносит
// сброс префикса, а не TTL.
const VENUES_CACHE_TTL = 10 * 60 * 1000

// Предел Data API на один ответ (gotchas §1). Реестр читается батчами этого
// размера до первого неполного.
const BATCH_SIZE = 1000

const VENUE_BRIEF_COLUMNS = 'id, name, city, country'

// Счётчики приезжают вложенными id, а не `relation(count)`: агрегаты в PostgREST
// выключены по умолчанию (db-aggregates-enabled), у роли authenticator в проде
// настройка не задана, и опираться на счёт в embed без проверки на живом API
// нельзя. Вложенные id работают всегда; в числа их сворачивает toListItem ДО
// кэша, так что на диск id состава не попадают.
const PROJECT_LIST_SELECT = `id, name, client_name, date_from, date_to, updated_at, venue:venues(${VENUE_BRIEF_COLUMNS}), lists:equipment_lists(id), staff:project_staff(id), plans:hall_plans(id)`

const PROJECT_SELECT = `*, venue:venues(${VENUE_BRIEF_COLUMNS})`

// Раскладка формы в строку. Одна на вставку и на правку: разъедься они, новая
// колонка попала бы в создание и терялась при редактировании. Края не режем —
// это делает триггер normalize_project_fields, он же превращает пустые заказчика
// и описание в NULL; запись возвращает уже нормализованную строку.
// created_by не шлём: вставка одиночная, и default auth.uid() подставляет база
// (политика требует created_by = auth.uid()). Грабля defaultToNull касается
// только пачечной вставки — см. createHallPlan.
function projectRow(input: ProjectInput) {
  return {
    name: input.name,
    client_name: input.clientName,
    date_from: input.dateFrom || null,
    date_to: input.dateTo || null,
    venue_id: input.venueId,
    description: input.description,
  }
}

function touched<T>(value: T): T {
  invalidateProjectsCache()
  return value
}

// ─── Реестр ─────────────────────────────────────────────────────────────────

export function fetchProjects({ bypassCache = false } = {}): Promise<ProjectListItem[]> {
  return cachedQuery(PROJECTS_LIST_CACHE_KEY, PROJECTS_CACHE_TTL, () => loadProjects(), { bypass: bypassCache })
}

// Синхронное чтение той же записи — для первого кадра страницы.
export function readCachedProjects(): ProjectListItem[] | null {
  return readCachedQuery<ProjectListItem[]>(PROJECTS_LIST_CACHE_KEY)
}

export function readCachedProjectsMeta() {
  return readCachedQueryMeta(PROJECTS_LIST_CACHE_KEY)
}

// Мероприятия для пикера «выбрать мероприятие». Отдельного запроса нет: строка
// реестра уже несёт все поля ProjectBrief, и второй ключ кэша с теми же
// данными был бы вторым источником правды.
export function fetchProjectBriefs(): Promise<ProjectBrief[]> {
  return fetchProjects()
}

async function loadProjects(): Promise<ProjectListItem[]> {
  if (!supabase) throw new Error('Supabase не настроен')
  const rows: ProjectListItem[] = []
  for (let from = 0; ; from += BATCH_SIZE) {
    const { data, error } = await supabase
      .from('projects')
      .select(PROJECT_LIST_SELECT)
      // Ближайшие и недавние сверху, без даты — в хвосте; под этот порядок стоит
      // индекс projects_date_from_idx. Полный ключ (…, id): дата не уникальна, и
      // без него строка попала бы в два батча сразу либо ни в один.
      .order('date_from', { ascending: false, nullsFirst: false })
      .order('id')
      .range(from, from + BATCH_SIZE - 1)
    if (error) throw error
    const batch = data ?? []
    for (const row of batch) {
      const { lists, staff, plans, ...brief } = row
      rows.push({ ...brief, listCount: lists.length, staffCount: staff.length, hasHallPlan: plans.length > 0 })
    }
    if (batch.length < BATCH_SIZE) return rows
  }
}

// ─── Одно мероприятие ───────────────────────────────────────────────────────

// Прямо по id и мимо кэша: прямая ссылка на /projects/:id обязана открываться
// без загруженного реестра. null — строки нет (или её не видно политикой), и
// это НЕ отказ запроса: отказ прилетает исключением.
export async function fetchProject(id: string): Promise<ProjectWithVenue | null> {
  if (!supabase) throw new Error('Supabase не настроен')
  const { data, error } = await supabase
    .from('projects')
    .select(PROJECT_SELECT)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}

// Дубль (то же название и та же дата начала) клиент заранее не ищет: правило
// держит projects_identity_key, отказ 23505 разбирает projectErrorText.
export async function createProject(input: ProjectInput): Promise<ProjectWithVenue> {
  if (!supabase) throw new Error('Supabase не настроен')
  const { data, error } = await supabase
    .from('projects')
    .insert(projectRow(input))
    .select(PROJECT_SELECT)
    .single()
  if (error) throw error
  return touched(data)
}

// Без оптимистичной блокировки: при гонке двух вкладок выигрывает последняя
// запись (план event-s53, «Общие реквизиты»).
export async function updateProject(id: string, input: ProjectInput): Promise<ProjectWithVenue> {
  if (!supabase) throw new Error('Supabase не настроен')
  const { data, error } = await supabase
    .from('projects')
    .update(projectRow(input))
    .eq('id', id)
    .select(PROJECT_SELECT)
    .single()
  if (error) throw error
  return touched(data)
}

// Отказ удаления, который база не называет ошибкой: RLS молча отсекает строку,
// `.delete()` без прав возвращает пустой ответ и `error: null`. Поэтому просим
// удалённые id назад и ноль строк считаем отказом (тот же приём — deleteRow в
// halls/api).
export const PROJECT_DELETE_NOT_APPLIED = 'project-delete-not-applied'

// Состав уходит каскадом, планы залов отвязываются (set null), а привязанные
// списки удаление БЛОКИРУЮТ: FK restrict отдаёт 23503. Клиент списки заранее не
// считает — показанное число могло устареть, решает база.
export async function deleteProject(id: string): Promise<void> {
  if (!supabase) throw new Error('Supabase не настроен')
  const { data, error } = await supabase.from('projects').delete().eq('id', id).select('id')
  if (error) throw error
  if (!data?.length) throw new Error(PROJECT_DELETE_NOT_APPLIED)
  touched(null)
}

// Списки оборудования мероприятия. Свой узкий select, а не fetchEquipmentLists:
// странице нужны три колонки, а импорт lists/api замкнул бы цикл фич. Кэша нет —
// блок показывает то, что есть в базе сейчас.
export async function fetchProjectLists(projectId: string): Promise<ProjectListRow[]> {
  if (!supabase) throw new Error('Supabase не настроен')
  const { data, error } = await supabase
    .from('equipment_lists')
    .select('id, name, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function fetchProjectHallPlans(projectId: string): Promise<ProjectHallPlanRow[]> {
  if (!supabase) throw new Error('Supabase не настроен')
  const { data, error } = await supabase
    .from('hall_plans')
    .select('id, name, event_from, event_to')
    .eq('project_id', projectId)
    .order('event_from', { ascending: true, nullsFirst: false })
    .order('id')
  if (error) throw error
  return data ?? []
}

// ─── Места ──────────────────────────────────────────────────────────────────

// Справочник целиком: мест десятки, выбор идёт из выпадающего списка. Порядок с
// полным ключом (…, id) — два «Hilton» в разных городах не должны меняться
// местами между запросами.
export function fetchVenues({ bypassCache = false } = {}): Promise<Venue[]> {
  return cachedQuery(VENUES_CACHE_KEY, VENUES_CACHE_TTL, async () => {
    if (!supabase) throw new Error('Supabase не настроен')
    const { data, error } = await supabase
      .from('venues')
      .select('*')
      .order('name')
      .order('city')
      .order('id')
      .limit(BATCH_SIZE)
    if (error) throw error
    return data ?? []
  }, { bypass: bypassCache })
}

// Новое место. Дубль (venues_identity_key: название + город + страна без учёта
// регистра и краёв) — не ошибка человека: он хотел это место, и оно уже есть.
// Поэтому на 23505 подхватываем существующую строку и возвращаем её. Проверки
// «до вставки» нет намеренно: её не спасла бы гонка двух вкладок, решает индекс.
export async function createVenue(input: VenueInput): Promise<Venue> {
  if (!supabase) throw new Error('Supabase не настроен')
  const { data, error } = await supabase
    .from('venues')
    .insert({ name: input.name, city: input.city, country: input.country })
    .select()
    .single()
  if (!error) return touched(data)
  if (error.code !== '23505' || !error.message.includes('venues_identity_key')) throw error

  // ilike без подстановочных знаков — точное совпадение без учёта регистра;
  // escapeLikePattern гасит `%` и `_` в самом названии. Края режем сами: индекс
  // сравнивает btrim-значения.
  const { data: existing, error: lookupError } = await supabase
    .from('venues')
    .select('*')
    .ilike('name', escapeLikePattern(input.name.trim()))
    .ilike('city', escapeLikePattern(input.city.trim()))
    .ilike('country', escapeLikePattern(input.country.trim()))
    .order('id')
    .limit(1)
    .maybeSingle()
  // Поиск не нашёл или сам отказал — возвращаем ИСХОДНЫЙ отказ вставки: фраза
  // «такое место уже есть» честнее, чем молчаливое «создано».
  if (lookupError || !existing) throw error
  // Справочник в кэше мог быть без этой строки (её завели из другой вкладки).
  return touched(existing)
}

// ─── Отказы ─────────────────────────────────────────────────────────────────

function errorParts(error: unknown) {
  const candidate = (typeof error === 'object' && error !== null ? error : {}) as { code?: unknown; message?: unknown }
  return {
    code: typeof candidate.code === 'string' ? candidate.code : '',
    message: typeof candidate.message === 'string' ? candidate.message : '',
  }
}

// Перевод отказа базы в человеческую фразу. Разбираем ИМЕНЕМ ограничения, а не
// одним кодом: под 23514 и 23505 придёт любой будущий CHECK и индекс, и чужая
// фраза в ответ на другое нарушение была бы враньём.
export function projectErrorText(error: unknown, tr: Tr): string {
  const { code, message } = errorParts(error)

  if (message === PROJECT_DELETE_NOT_APPLIED) {
    return tr('Не удалено: нет прав или мероприятие уже удалили. Обновите страницу.', 'O‘chirilmadi: huquq yo‘q yoki tadbir allaqachon o‘chirilgan. Sahifani yangilang.')
  }
  if (code === '23505' && message.includes('projects_identity_key')) {
    return tr('Такое мероприятие уже есть: то же название и та же дата начала.', 'Bunday tadbir allaqachon bor: nomi va boshlanish sanasi bir xil.')
  }
  if (code === '23514' && message.includes('projects_dates_check')) {
    return tr('Проверьте период: окончание не раньше начала, и без начала окончание не ставится.', 'Davrni tekshiring: tugash sanasi boshlanishdan oldin bo‘lmasin, boshlanishsiz tugash qo‘yilmaydi.')
  }
  if (code === '23514' && message.includes('projects_name_check')) {
    return tr('Название не может быть пустым и длиннее 200 знаков.', 'Nom bo‘sh yoki 200 belgidan uzun bo‘lishi mumkin emas.')
  }
  if (code === '23514' && message.includes('projects_client_check')) {
    return tr('Заказчик — не длиннее 200 знаков.', 'Buyurtmachi — 200 belgidan oshmasin.')
  }
  // Удаление мероприятия, к которому привязаны списки (FK restrict).
  if (code === '23503' && message.includes('equipment_lists_project_id_fkey')) {
    return tr('К мероприятию привязаны списки оборудования. Сначала отвяжите или удалите списки.', 'Tadbirga uskunalar ro‘yxatlari biriktirilgan. Avval ro‘yxatlarni ajrating yoki o‘chiring.')
  }
  // Выбранное место успели удалить, пока форма была открыта.
  if (code === '23503' && message.includes('projects_venue_id_fkey')) {
    return tr('Выбранной площадки больше нет — выберите другую.', 'Tanlangan maydon endi yo‘q — boshqasini tanlang.')
  }
  if (code === '42501') {
    return tr('Недостаточно прав: мероприятия ведут техники, менеджеры и администраторы.', 'Huquq yetarli emas: tadbirlarni texniklar, menejerlar va administratorlar yuritadi.')
  }
  return tr('Не удалось сохранить мероприятие. Проверьте поля и повторите попытку.', 'Tadbirni saqlab bo‘lmadi. Maydonlarni tekshirib, qayta urinib ko‘ring.')
}

export function venueErrorText(error: unknown, tr: Tr): string {
  const { code, message } = errorParts(error)

  // Сюда 23505 доходит, только если подхват существующего места не удался.
  if (code === '23505' && message.includes('venues_identity_key')) {
    return tr('Такое место уже есть — выберите его из списка.', 'Bunday joy allaqachon bor — uni ro‘yxatdan tanlang.')
  }
  if (code === '23514' && message.includes('venues_name_check')) {
    return tr('Название места не может быть пустым и длиннее 200 знаков.', 'Joy nomi bo‘sh yoki 200 belgidan uzun bo‘lishi mumkin emas.')
  }
  if (code === '23514' && message.includes('venues_city_check')) {
    return tr('Укажите город (до 100 знаков).', 'Shaharni ko‘rsating (100 belgigacha).')
  }
  if (code === '23514' && message.includes('venues_country_check')) {
    return tr('Укажите страну (до 100 знаков).', 'Mamlakatni ko‘rsating (100 belgigacha).')
  }
  if (code === '42501') {
    return tr('Недостаточно прав: места заводят техники, менеджеры и администраторы.', 'Huquq yetarli emas: joylarni texniklar, menejerlar va administratorlar kiritadi.')
  }
  return tr('Не удалось сохранить место. Проверьте поля и повторите попытку.', 'Joyni saqlab bo‘lmadi. Maydonlarni tekshirib, qayta urinib ko‘ring.')
}
