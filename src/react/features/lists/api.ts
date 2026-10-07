import { supabase } from '../../lib/supabase'
import { cachedQuery, invalidateCachePrefix, primeCachedQuery, readCachedQuery, readCachedQueryMeta } from '../../lib/persistentCache'
import type { Json, Tables } from '../../lib/database.types'
import { MOBILE_MEDIA_QUERY } from '../../lib/breakpoints'
import { reportAppError } from '../../lib/reportAppError'
import { fetchEquipmentByIds } from '../equipment/api'
import type { Equipment } from '../equipment/types'
import { projectErrorText } from '../projects/api'
import { invalidateProjectCounters, invalidateProjectsCache } from '../projects/cacheKeys'
import type { ProjectBrief, VenueBrief } from '../projects/types'
import { LIST_DRAFT_TTL_MS, listCompositionCacheKey, listDraftCacheKey } from './cacheKeys'
import type { ExportListRow } from './xlsxExport'

export type EquipmentListItem = Pick<Equipment, 'brand' | 'model' | 'type' | 'subtype'> & {
  count: number
  equipment_id?: string
  tracking_mode: 'serialized' | 'quantity' | 'planned'
}

// Колонки equipment_lists, которые читает интерфейс (селект listColumns).
// Разъедется со схемой — упадёт компиляция нормализации ниже.
type EquipmentListRow = Pick<
  Tables<'equipment_lists'>,
  'id' | 'name' | 'description' | 'type' | 'list_mode'
  | 'equipment_ids' | 'equipment_items' | 'created_at' | 'is_archived' | 'project_id'
>

// Строка списка вместе с мероприятием — так её отдают и одиночная выборка
// (embed), и RPC реестра. Реквизиты (название, заказчик, период, площадка) живут
// ТОЛЬКО в мероприятии: своих у списка нет, project === null — черновой набор.
type EquipmentListRowWithProject = EquipmentListRow & { project: ProjectBrief | null }

// Доменный список: строка базы, где текстовый list_mode под CHECK и jsonb-колонка
// состава сужены до наших типов.
export type EquipmentList = Omit<
  EquipmentListRowWithProject,
  'list_mode' | 'equipment_items'
> & {
  list_mode: 'specific' | 'abstract'
  equipment_items: EquipmentListItem[] | null
}

const listColumns = 'id,name,description,type,list_mode,equipment_ids,equipment_items,created_at,is_archived,project_id'

// Мероприятие встроенным ресурсом — те же поля и те же имена, что кладёт в строку
// RPC fetch_equipment_lists_page: карточка реестра и редактор читают одну форму.
const listSelect = `${listColumns},project:projects(id,name,client_name,date_from,date_to,venue:venues(id,name,city,country))`

export const LISTS_PAGE_SIZE = 12
export const MOBILE_LISTS_PAGE_SIZE = 6

// Размер страницы входит в ключ кэша, поэтому его выбирает сама фича: и страница,
// и прогрев в App.tsx обязаны спросить одно и то же число, иначе прогрев ляжет
// мимо ключа, который потом читает список.
export function preferredListsPageSize() {
  return window.matchMedia(MOBILE_MEDIA_QUERY).matches ? MOBILE_LISTS_PAGE_SIZE : LISTS_PAGE_SIZE
}

// list_mode держит CHECK в базе, но в схеме это обычный text — сужаем на входе,
// чтобы дальше по коду ходил доменный тип.
function toListMode(value: string | null): 'specific' | 'abstract' {
  return value === 'abstract' ? 'abstract' : 'specific'
}

// jsonb-колонки схема отдаёт как Json. Проверяем, что пришёл массив; форму
// элементов задаёт та же RPC, которая их и пишет, поэтому их не пересобираем.
function toEquipmentListItems(value: Json): EquipmentListItem[] | null {
  return Array.isArray(value) ? (value as EquipmentListItem[]) : null
}

// Поля перечислены явно, а не через spread: RPC реестра отдаёт в строке ещё и
// updated_at, а эта же строка кладётся в кэш детали (prefetchSavedListDetails) —
// форма обязана совпасть с одиночной выборкой до ключа.
function normalizeList(row: EquipmentListRowWithProject): EquipmentList {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.type,
    list_mode: toListMode(row.list_mode),
    equipment_ids: row.equipment_ids,
    equipment_items: toEquipmentListItems(row.equipment_items),
    created_at: row.created_at,
    is_archived: row.is_archived,
    project_id: row.project_id,
    project: row.project ?? null,
  }
}

// Ответ fetch_equipment_lists_page — jsonb {rows, total}. Конверт проверяем, а не
// приводим: разъедется RPC с клиентом — реестр покажет отказ загрузки, а не
// «списков нет». Форму самой строки задаёт функция (миграция 20261007185009).
function toListsPage(value: Json): EquipmentListsPage {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('fetch_equipment_lists_page: ответ не объект')
  const { rows, total } = value
  if (!Array.isArray(rows) || typeof total !== 'number') throw new Error('fetch_equipment_lists_page: нет rows или total')
  return {
    rows: (rows as unknown as EquipmentListRowWithProject[]).map((item) => normalizeList(item)),
    total,
  }
}

// equipment_ids и equipment_items не пересекаются: RPC кладёт серийные позиции в первый
// массив, все остальные — во второй. Поэтому размер списка — их сумма при любом list_mode.
// Живёт здесь, а не в ListsPage: то же число показывает строка списка на главной.
export function listSize(list: EquipmentList) {
  const quantity = list.equipment_items?.reduce((sum, item) => sum + (Number(item.count) || 0), 0) ?? 0
  return (list.equipment_ids?.length ?? 0) + quantity
}

export type EquipmentListsQuery = {
  page?: number
  search?: string
  // Период приходит готовыми границами (YYYY-MM-DD), а не названием («этот
  // месяц»): название в ключе кэша означало бы, что первого числа страница
  // покажет прошлый месяц под видом текущего — границы же меняются сами и
  // уводят запрос на новый ключ.
  periodFrom?: string
  periodTo?: string
  pageSize?: number
  bypassCache?: boolean
}

export type EquipmentListsPage = {
  rows: EquipmentList[]
  // Счётчик ТЕКУЩЕЙ выборки: с фильтрами это «найдено», без них — «всего».
  // Второй ходки за общим числом нет намеренно.
  total: number
}

type NormalizedListsQuery = Required<Omit<EquipmentListsQuery, 'bypassCache'>>

function normalizeListsQuery({ page = 1, search = '', periodFrom = '', periodTo = '', pageSize = LISTS_PAGE_SIZE }: EquipmentListsQuery): NormalizedListsQuery {
  return { page, search: search.trim(), periodFrom, periodTo, pageSize }
}

// Ключ остаётся под префиксом `equipment-lists:` — его целиком сбрасывает любая
// запись (создание, правка, удаление, смена этапа), и страницы обязаны уехать
// вместе с ней. v2 — форма строки сменилась (реквизиты переехали в project), а
// записи прошлой формы лежат в localStorage у всех, кто открывал реестр.
function equipmentListsCacheKey(query: NormalizedListsQuery) {
  return `equipment-lists:page:v2:${JSON.stringify(query)}`
}

export function readCachedEquipmentLists(query: Omit<EquipmentListsQuery, 'bypassCache'> = {}) {
  return readCachedQuery<EquipmentListsPage>(equipmentListsCacheKey(normalizeListsQuery(query)))
}

// Возраст той же страницы списков: ключ собирают те же две функции, что и выше.
export function readCachedEquipmentListsMeta(query: Omit<EquipmentListsQuery, 'bypassCache'> = {}) {
  return readCachedQueryMeta(equipmentListsCacheKey(normalizeListsQuery(query)))
}

export async function fetchEquipmentLists(query: EquipmentListsQuery = {}): Promise<EquipmentListsPage> {
  if (!supabase) throw new Error('Supabase не настроен')
  const client = supabase
  const normalized = normalizeListsQuery(query)
  const { page, search, periodFrom, periodTo, pageSize } = normalized

  // Реестр считает RPC, а не embed: поиск идёт по имени списка, имени
  // мероприятия, заказчику и площадке — полям трёх таблиц, а PostgREST не строит
  // `or` поперёк родителя и встроенного ресурса. Экранирование шаблона, порядок
  // (created_at desc, id desc) и счётчик выборки — внутри функции. Период
  // меряется по дате НАЧАЛА мероприятия: список без мероприятия или без даты в
  // любой период не попадает.
  return cachedQuery(equipmentListsCacheKey(normalized), 10 * 60 * 1000, async () => {
    const { data, error } = await client.rpc('fetch_equipment_lists_page', {
      p_search: search,
      p_from: periodFrom || null,
      p_to: periodTo || null,
      p_limit: pageSize,
      p_offset: (page - 1) * pageSize,
    })
    if (error) throw error
    return toListsPage(data)
  }, { bypass: query.bypassCache ?? false })
}

function equipmentListCacheKey(listId: string) {
  return `equipment-lists:detail:v2:${listId}`
}

export function readCachedEquipmentList(listId: string) {
  return readCachedQuery<EquipmentList>(equipmentListCacheKey(listId))
}

export async function fetchEquipmentList(listId: string, { bypassCache = false } = {}) {
  if (!supabase) throw new Error('Supabase не настроен')
  const client = supabase
  return cachedQuery(equipmentListCacheKey(listId), 10 * 60 * 1000, async () => {
    const { data, error } = await client
      .from('equipment_lists')
      .select(listSelect)
      .eq('id', listId)
      .single()
    if (error) throw error
    return normalizeList(data)
  }, { bypass: bypassCache })
}

// Состав сохранённого списка — строки для деталей и для Excel. Ключ кэша
// принадлежит этой фиче, но лежит в листовом cacheKeys.ts: сбрасывать его
// нужно и из equipment/api, а зависимость equipment → lists/api замкнула бы
// граф фич в цикл.
export { invalidateListCompositionCache } from './cacheKeys'

export type SavedListComposition = {
  rows: ExportListRow[]
  // Серийные единицы, чьи id остались в equipment_ids, а строк на складе уже нет
  // (позицию удалили). Счётчик в шапке списка считает по equipment_ids, состав —
  // по пришедшим строкам, и без этого числа расхождение ничем не объяснено.
  missingUnits: number
}

export function readCachedSavedListComposition(listId: string) {
  return readCachedQuery<SavedListComposition>(listCompositionCacheKey(listId))
}

// Ключ группировки позиции. Модель определяет нормализованная пара
// lower(trim(brand)) + lower(trim(model)) — ровно то правило, по которому модель
// правит серверная RPC. Сырой текст давал две строки на одну модель там, где в
// базе у одной единицы «Sony » с пробелом, а у другой «sony».
function modelGroupKey(brand: string, model: string) {
  return `${brand.trim().toLocaleLowerCase('ru')}::${model.trim().toLocaleLowerCase('ru')}`
}

async function loadSavedListComposition(list: EquipmentList): Promise<SavedListComposition> {
  const serializedIds = [...new Set(list.equipment_ids ?? [])]
  const quantityItems = list.equipment_items ?? []
  // Живые строки склада тянем и для количественных позиций: в jsonb у них лежит
  // СНИМОК бренда и модели на момент сохранения, а у серийной части подпись
  // читается из equipment. После переименования модели два источника расходились,
  // и одна позиция показывалась двумя строками. equipment_id авторитетнее текста,
  // поэтому подпись берём по нему; снимок остаётся фолбэком для позиций без id.
  const referencedIds = [...new Set([
    ...serializedIds,
    ...quantityItems.flatMap((item) => item.equipment_id ? [item.equipment_id] : []),
  ])]
  const units = await fetchEquipmentByIds(referencedIds)
  const unitById = new Map(units.map((unit) => [unit.id, unit]))

  const grouped = new Map<string, ExportListRow>()
  const addRow = (source: Pick<Equipment, 'brand' | 'model' | 'type' | 'subtype'>, count: number, serialNumber?: string | null) => {
    const key = modelGroupKey(source.brand, source.model)
    const current = grouped.get(key)
    if (current) {
      current.count += count
      if (serialNumber) current.serialNumbers.push(serialNumber)
      return
    }
    grouped.set(key, {
      category: source.type,
      equipment: `${source.brand} ${source.model}`.trim(),
      subtype: source.subtype,
      count,
      serialNumbers: serialNumber ? [serialNumber] : [],
    })
  }

  for (const equipmentId of serializedIds) {
    const unit = unitById.get(equipmentId)
    if (!unit) continue
    addRow(unit, 1, unit.serialnumber)
  }
  for (const item of quantityItems) {
    const unit = item.equipment_id ? unitById.get(item.equipment_id) : undefined
    addRow(unit ?? item, item.count)
  }

  return {
    rows: [...grouped.values()],
    missingUnits: serializedIds.filter((equipmentId) => !unitById.has(equipmentId)).length,
  }
}

export function buildSavedListComposition(list: EquipmentList, { bypassCache = false } = {}) {
  return cachedQuery(listCompositionCacheKey(list.id), 10 * 60 * 1000, () => loadSavedListComposition(list), { bypass: bypassCache })
}

// Прогрев карточки списка стоит РОВНО один запрос — состав. Деталь списка мы уже
// держим в руках: строка реестра нормализована в ту же форму, что и одиночная
// выборка (normalizeList), поэтому кладём её в кэш детали напрямую. История и дефицит
// грузятся при открытии деталей: reservation_shortages — полная агрегация склада,
// звать её вслепую на шесть карточек нечем оправдать.
export function prefetchSavedListDetails(list: EquipmentList) {
  primeCachedQuery(equipmentListCacheKey(list.id), 10 * 60 * 1000, list)
  return buildSavedListComposition(list).catch((error: unknown) => reportAppError(error, { scope: 'prefetch', detail: { source: 'list-composition', listId: list.id } }))
}

// Черновик редактора нового списка. Позиция хранится КЛЮЧОМ ГРУППЫ, а не снимком
// бренда и модели: восстановление всё равно пересобирает выборку по живому
// каталогу, и снимок разошёлся бы с ним после переименования модели.
export type ListDraftItem = {
  key: string
  count: number
  serialIds: string[]
}

// Мероприятие в форме редактора списка. null на месте всего объекта — список
// без мероприятия (черновой набор).
export type ListProjectDraft = {
  // null — новое мероприятие: его создаст RPC тем же сохранением, что и список.
  id: string | null
  name: string
  clientName: string
  // Даты — строки YYYY-MM-DD, как их отдаёт AppDatePicker; пустая строка — «не
  // указана». dateTo пусто при заданном dateFrom — один день.
  dateFrom: string
  dateTo: string
  // Место целиком, а не id: подпись площадки нужна полосе реквизитов и шапке
  // документа, а справочник мест редактор сам не держит.
  venue: VenueBrief | null
  // Реквизиты СУЩЕСТВУЮЩЕГО мероприятия правили в этом редакторе. Только тогда
  // они уезжают в базу: мероприятие общее, и сохранение списка, в котором их не
  // трогали, не должно затирать чужую правку снимком суточной давности.
  edited: boolean
}

export type ListDraft = {
  name: string
  description: string
  project: ListProjectDraft | null
  items: ListDraftItem[]
}

// Без listId — черновик /lists/new; с listId — несохранённые правки открытого
// списка. Одна машинерия на оба случая: разница только в ключе.
export function readListDraft(listId?: string) {
  return readCachedQuery<ListDraft>(listDraftCacheKey(listId))
}

export function saveListDraft(draft: ListDraft, listId?: string) {
  primeCachedQuery(listDraftCacheKey(listId), LIST_DRAFT_TTL_MS, draft)
}

// Момент последней записи черновика — «Не сохранён · изменён 21.08, 18:40» на
// карточке реестра и в плашке восстановления. Спрашивать эту метку можно ТОЛЬКО
// про черновик, который вернул readListDraft: гейта по TTL у меты нет, и для
// протухшей записи она честно отдала бы время суточной давности.
export function readListDraftMeta(listId?: string) {
  return readCachedQueryMeta(listDraftCacheKey(listId))
}

// Точечного удаления одного ключа у persistentCache нет, поэтому стираем
// префиксом. Пустой вызов гасим сразу: invalidateCachePrefix поднимает поколение
// кэша, а это отменяет запись ВСЕХ ответов, летящих прямо сейчас, — и обычный
// заход на /lists/new без черновика выбрасывал бы прогрев каталога.
export function clearListDraft(listId?: string) {
  if (readListDraft(listId) === null) return
  invalidateCachePrefix(listDraftCacheKey(listId))
}

export type EquipmentListDocumentInput = {
  name: string
  description: string
  listMode: 'specific' | 'abstract'
  equipmentItems: EquipmentListItem[]
  // Привязка к мероприятию — ровно семантика RPC (миграция 20261007185009):
  //   оба null             → список без мероприятия;
  //   project без id       → мероприятие создаётся тем же сохранением;
  //   id и project         → реквизиты существующего ПЕРЕПИСЫВАЮТСЯ целиком;
  //   только id            → привязка как есть, мероприятие не трогается.
  projectId: string | null
  project: Pick<ListProjectDraft, 'name' | 'clientName' | 'dateFrom' | 'dateTo' | 'venue'> | null
}

export type SavedEquipmentList = { listId: string; projectId: string | null }

// Пять полей мероприятия, как их читает RPC: пишутся все, отсутствующий ключ
// стал бы NULL. Края не режем — это делает триггер normalize_project_fields, он
// же превращает пустого заказчика в NULL.
function projectPayload(project: NonNullable<EquipmentListDocumentInput['project']>): Json {
  return {
    name: project.name,
    client_name: project.clientName,
    venue_id: project.venue?.id ?? null,
    date_from: project.dateFrom || null,
    date_to: project.dateTo || null,
  }
}

function toSavedList(value: Json): SavedEquipmentList {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('save_project_equipment_list: ответ не объект')
  const { list_id: listId, project_id: projectId } = value
  if (typeof listId !== 'string') throw new Error('save_project_equipment_list: нет list_id')
  return { listId, projectId: typeof projectId === 'string' ? projectId : null }
}

// Сброс после записи списка. Мероприятие создано или его реквизиты переписаны —
// уезжает всё, что их показывает (реестр мероприятий и кэш списков одним
// вызовом). Иначе менялась только привязка: кэш списков и счётчики мероприятий.
function invalidateAfterSave(input: EquipmentListDocumentInput) {
  if (input.project) {
    invalidateProjectsCache()
    return
  }
  invalidateCachePrefix('equipment-lists:')
  invalidateProjectCounters()
}

export async function createEquipmentList(input: EquipmentListDocumentInput): Promise<SavedEquipmentList> {
  if (!supabase) throw new Error('Supabase не настроен')

  const { data, error } = await supabase.rpc('create_project_equipment_list', {
    p_project_id: input.projectId,
    p_project: input.project ? projectPayload(input.project) : null,
    p_name: input.name.trim(),
    p_description: input.description.trim(),
    p_list_mode: input.listMode,
    p_items: input.equipmentItems,
  })

  if (error) throw error
  invalidateAfterSave(input)
  return toSavedList(data)
}

export async function updateEquipmentList(listId: string, input: EquipmentListDocumentInput): Promise<SavedEquipmentList> {
  if (!supabase) throw new Error('Supabase не настроен')

  const { data, error } = await supabase.rpc('update_project_equipment_list', {
    p_list_id: listId,
    p_project_id: input.projectId,
    p_project: input.project ? projectPayload(input.project) : null,
    p_name: input.name.trim(),
    p_description: input.description.trim(),
    p_list_mode: input.listMode,
    p_items: input.equipmentItems,
  })

  if (error) throw error
  invalidateAfterSave(input)
  return toSavedList(data)
}

// Отказ сохранения словами. Свои, списочные, причины остаются одной общей фразой,
// как и раньше; отказы МЕРОПРИЯТИЯ разбираются именем ограничения — у них есть
// что исправить в полях. Признак «это про мероприятие» — имя таблицы projects в
// сообщении базы: под теми же кодами приходят и нарушения самого списка.
export function listSaveErrorText(error: unknown, tr: (ru: string, uz: string) => string): string {
  const candidate = (typeof error === 'object' && error !== null ? error : {}) as { code?: unknown; message?: unknown }
  const code = typeof candidate.code === 'string' ? candidate.code : ''
  const message = typeof candidate.message === 'string' ? candidate.message : ''

  // Выбранное мероприятие удалили, пока редактор был открыт: внешний ключ списка
  // (вставка или правка) либо явный отказ RPC при правке реквизитов. Тот же ключ
  // projectErrorText читает как «нельзя удалить мероприятие со списками» —
  // поэтому разбираем его раньше.
  if ((code === '23503' && message.includes('equipment_lists_project_id_fkey')) || message.includes('Project not found')) {
    return tr('Выбранного мероприятия больше нет или его нельзя править. Выберите другое или сохраните список без мероприятия.', 'Tanlangan tadbir endi yo‘q yoki uni tahrirlab bo‘lmaydi. Boshqasini tanlang yoki ro‘yxatni tadbirsiz saqlang.')
  }
  if (['23505', '23514', '23503', '42501'].includes(code) && message.includes('projects')) {
    return projectErrorText(error, tr)
  }
  return tr('Не удалось сохранить список. Файл всё ещё можно скачать.', 'Ro‘yxatni saqlab bo‘lmadi. Faylni baribir yuklab olish mumkin.')
}

// Отказ RLS на удалении: политика не возвращает ошибку — строка просто не попадает
// под delete, и ответ приходит пустым. Код-строка, а не текст: сообщение собирает
// интерфейс, здесь только причина.
export const LIST_DELETE_FORBIDDEN = 'list-delete-forbidden'

export async function deleteEquipmentList(listId: string) {
  if (!supabase) throw new Error('Supabase не настроен')

  const { data, error } = await supabase
    .from('equipment_lists')
    .delete()
    .eq('id', listId)
    .select('id')
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error(LIST_DELETE_FORBIDDEN)
  invalidateCachePrefix('equipment-lists:')
  // Список мог стоять на мероприятии — его счётчик списков стал меньше.
  invalidateProjectCounters()
  return data.id as string
}
