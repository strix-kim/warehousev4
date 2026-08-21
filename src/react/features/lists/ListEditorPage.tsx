import {
  ArrowDown,
  ArrowLeft,
  Check,
  CircleAlert,
  FileCheck2,
  FileSpreadsheet,
  Info,
  ListChecks,
  Minus,
  Plus,
  Save,
  ScanBarcode,
  Trash2,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { preloadEquipmentImages } from '../../components/EquipmentVisual'
import { formatDateTime, formatTime, parseDateValue, todayDateValue } from '../../lib/date'
import { translateEquipmentTaxonomy } from '../../lib/equipmentTaxonomy'
import { useLanguage } from '../../lib/i18n'
import { useArmedAction } from '../../lib/useArmedAction'
import { fetchAllEquipment, readCachedAllEquipment } from '../equipment/api'
import type { Equipment } from '../equipment/types'
import {
  clearListDraft,
  createEquipmentList,
  fetchEquipmentList,
  readCachedEquipmentList,
  readListDraft,
  readListDraftMeta,
  updateEquipmentList,
  type EquipmentList,
  type EquipmentListItem,
} from './api'
import { buildCatalogGroups, groupKey, type CatalogGroup } from './catalogGroups'
import { CatalogPanel, CatalogPreviewDrawer } from './ListEditorCatalog'
import { ListEditorMeta, type ListMetaField, type RequisiteField } from './ListEditorMeta'
import { useEditorChrome } from './useEditorChrome'
import { useListDraftAutosave } from './useListDraftAutosave'
import { downloadEquipmentListXlsx } from './xlsxExport'

// Подпись позиции — минимальный снимок группы. Нужен ровно в одном случае:
// группы больше нет в свежем каталоге, и строку нечем было бы нарисовать.
type SelectionLabel = Pick<CatalogGroup, 'brand' | 'model' | 'type' | 'subtype'>

// Выборка хранит КЛЮЧ группы, а не саму группу: сам объект берётся из актуальной
// Map на рендере. Иначе остатки, серийники и payload считались бы по каталогу
// на момент клика — обновление склада до выборки не доезжало.
type SelectedGroup = {
  key: string
  label: SelectionLabel
  count: number
  serialIds: string[]
  serialPickerOpen: boolean
}

// Причина отказа при открытии сохранённого списка. Держим кодом, а не готовой
// строкой: строка потянула бы tr в зависимости эффекта, и смена языка
// перезапрашивала бы список из базы.
type OpenErrorCode = '' | 'failed'

// Высота липкой полосы табов на телефоне (8 сверху + кнопка 44 + 4 снизу + рамка 1).
// Держится в паре с .mobile-editor-tabs и .quick-catalog-toolbar в styles.css:
// разъедется — таб «В списке» снова приземлится под срезанным заголовком.
const MOBILE_TABS_HEIGHT = 57

// Потолок количества в позиции. Ограничение чисто интерфейсное — база принимает
// любое число, но в рабочем списке четырёхзначное количество означает опечатку.
const MAX_ITEM_COUNT = 999

// Снимок документа одной строкой — по нему считается «есть несохранённые
// правки». Серийники сортируются, порядок ключей фиксирован: иначе одна и та же
// правка давала бы разные строки, и предупреждение загоралось бы на ровном месте.
function serializeDocument(input: {
  name: string
  clientName: string
  venue: string
  description: string
  eventDate: string
  items: { key: string; count: number; serialIds: string[] }[]
}) {
  return JSON.stringify({
    name: input.name.trim(),
    clientName: input.clientName.trim(),
    venue: input.venue.trim(),
    description: input.description.trim(),
    eventDate: input.eventDate,
    items: input.items.map(({ key, count, serialIds }) => ({ key, count, serialIds: [...serialIds].sort() })),
  })
}

function selectionLabel(group: CatalogGroup): SelectionLabel {
  return { brand: group.brand, model: group.model, type: group.type, subtype: group.subtype }
}

export function ListEditorPage() {
  const navigate = useNavigate()
  const { listId } = useParams<{ listId: string }>()
  const { tr, language, locale } = useLanguage()
  // Черновик восстанавливается ТОЛЬКО в режиме создания: у открытого списка
  // источник правды — строка в базе. Реквизиты стартуют пустыми: подставленный
  // текст пользователь принимал за свой и увозил в документ и в базу.
  const [restoredDraft] = useState(() => listId ? null : readListDraft())
  // Момент последней записи черновика — «изменён 21.08, 18:40» в плашке. Спрашиваем
  // только про живой черновик: у меты нет гейта по TTL, и для протухшей записи она
  // отдала бы время суточной давности.
  const [restoredDraftAt] = useState(() => restoredDraft ? readListDraftMeta()?.touchedAt ?? null : null)
  const [name, setName] = useState<string>(() => restoredDraft?.name ?? '')
  const [clientName, setClientName] = useState<string>(() => restoredDraft?.clientName ?? '')
  const [venue, setVenue] = useState<string>(() => restoredDraft?.venue ?? '')
  const [description, setDescription] = useState(() => restoredDraft?.description ?? '')
  const [eventDate, setEventDate] = useState(() => restoredDraft?.eventDate ?? todayDateValue())
  const [cachedEquipment] = useState(readCachedAllEquipment)
  const [cachedList] = useState(() => listId ? readCachedEquipmentList(listId) : null)
  const [equipment, setEquipment] = useState<Equipment[]>(() => cachedEquipment ?? [])
  const [selected, setSelected] = useState<SelectedGroup[]>([])
  const [isLoading, setIsLoading] = useState(() => !cachedEquipment)
  const [isSaving, setIsSaving] = useState(false)
  // Режим экспорта, а не флаг: «Готовим…» должна гореть на нажатой кнопке, а не на обеих.
  const [isExporting, setIsExporting] = useState<'' | 'working' | 'approval'>('')
  // Каталог: тоже только флаг — текст ошибки собирается на рендере.
  const [hasLoadError, setHasLoadError] = useState(false)
  const [openError, setOpenError] = useState<OpenErrorCode>('')
  const [isOpening, setIsOpening] = useState(Boolean(listId && !cachedList))
  const [listToEdit, setListToEdit] = useState<EquipmentList | null>(() => cachedList ?? null)
  const [saveError, setSaveError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  // Незаполненные реквизиты, на которые указала попытка собрать документ на
  // согласование. Подсветка снимается с поля, как только его начали править.
  const [requisiteErrors, setRequisiteErrors] = useState<Set<RequisiteField>>(() => new Set())
  // Момент последней записи в базу. Нужен только строке состояния в шапке.
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)
  // Количество, которое пользователь СЕЙЧАС набирает. Держим отдельно от выборки:
  // пустое поле — законное промежуточное состояние, а count = 0 выбросил бы позицию.
  const [countDraft, setCountDraft] = useState<{ key: string; text: string } | null>(null)
  const [previewGroup, setPreviewGroup] = useState<CatalogGroup | null>(null)
  const [mobilePanel, setMobilePanel] = useState<'catalog' | 'selection'>('catalog')
  // Панель реквизитов свёрнута по умолчанию: список собирают без неё, а документу
  // на согласование страница раскроет её сама (см. exportList).
  const [metaOpen, setMetaOpen] = useState(false)
  const catalogRef = useRef<HTMLElement>(null)
  const selectionRef = useRef<HTMLElement>(null)
  const metaRef = useRef<HTMLElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  // Прокрутка каждой вкладки телефона на момент ухода с неё: возврат в каталог
  // приводит к той же модели, а не к первой.
  const panelScrollRef = useRef<Partial<Record<'catalog' | 'selection', number>>>({})
  useEditorChrome(gridRef)
  // Снимок документа на момент последней записи в базу. Пустая строка — снимка
  // ещё нет (список не открыт или не догрузился), и предупреждать не о чем.
  const savedSnapshotRef = useRef('')
  // Что именно восстановилось: сколько единиц вернулось и сколько позиций не
  // нашлось в живом каталоге. null — плашки нет.
  const [draftNotice, setDraftNotice] = useState<{ missingGroups: number; units: number } | null>(null)
  // Гидратация разведена на две: шапка документа заполняется сразу из строки
  // списка, состав — только когда приехал каталог.
  const hydratedMetaRef = useRef('')
  const hydratedSelectionRef = useRef('')
  // Автосейв заблокирован, пока восстановление не закончилось: стартовый пустой
  // стейт затёр бы сохранённый черновик раньше, чем тот успеет подняться.
  // Восстанавливать нечего — снят сразу.
  const draftRestoredRef = useRef(!restoredDraft)
  // Оба действия необратимы и стоят рядом с обычными кнопками, поэтому спрашивают
  // подтверждение вторым нажатием. Экземпляры независимые: взведённая «Очистить»
  // не должна взводить «Начать заново».
  const clearArmed = useArmedAction()
  const restartArmed = useArmedAction()

  useEffect(() => {
    let current = true
    setIsLoading(!cachedEquipment)
    setHasLoadError(false)
    fetchAllEquipment({ bypassCache: Boolean(cachedEquipment) })
      .then((result) => {
        if (!current) return
        setEquipment(result)
        preloadEquipmentImages(result, 32)
      })
      .catch(() => { if (current && !cachedEquipment) setHasLoadError(true) })
      .finally(() => { if (current) setIsLoading(false) })
    return () => { current = false }
  }, [])

  useEffect(() => {
    if (!listId) {
      setIsOpening(false)
      setListToEdit(null)
      setOpenError('')
      return
    }
    let current = true
    const cached = readCachedEquipmentList(listId)
    if (cached) setListToEdit(cached)
    setIsOpening(!cached)
    setOpenError('')
    fetchEquipmentList(listId, { bypassCache: Boolean(cached) })
      .then((list) => {
        if (!current) return
        setListToEdit(list)
      })
      .catch(() => {
        if (!current) return
        // Живой кэш уже показан — сбой обновления не повод рушить открытый редактор.
        if (cached) return
        setOpenError('failed')
      })
      .finally(() => { if (current) setIsOpening(false) })
    return () => { current = false }
  }, [listId])

  // Шапка документа заполняется, как только приехала САМА строка списка, и не
  // ждёт каталог. Раньше и шапка, и состав гидратировались одним эффектом по
  // приходу каталога — на холодном старте с медленной сетью приехавшие данные
  // затирали название, которое пользователь успел набрать за эти секунды.
  useEffect(() => {
    if (!listToEdit || hydratedMetaRef.current === listToEdit.id) return
    setName(listToEdit.name)
    setClientName(listToEdit.client_name ?? '')
    setVenue(listToEdit.venue ?? '')
    setDescription(listToEdit.description ?? '')
    setEventDate(listToEdit.reservation_start ?? todayDateValue())
    const savedAt = Date.parse(listToEdit.created_at ?? '')
    setLastSavedAt(Number.isNaN(savedAt) ? null : savedAt)
    hydratedMetaRef.current = listToEdit.id
  }, [listToEdit])

  const groups = useMemo(() => buildCatalogGroups(equipment), [equipment])

  // Единственный источник группы по ключу: и восстановление, и рендер выборки,
  // и payload читают каталог отсюда, а не из снимков в стейте.
  const groupsByKey = useMemo(() => new Map(groups.map((group) => [group.key, group])), [groups])

  useEffect(() => {
    if (!listToEdit || groups.length === 0 || hydratedSelectionRef.current === listToEdit.id) return
    const equipmentById = new Map(equipment.map((item) => [item.id, item]))
    const restored = new Map<string, SelectedGroup>()
    const addRestored = (group: CatalogGroup, count: number, serialId?: string) => {
      const current = restored.get(group.key) ?? { key: group.key, label: selectionLabel(group), count: 0, serialIds: [], serialPickerOpen: false }
      current.count += count
      if (serialId && group.serializedItems.some((item) => item.id === serialId)) current.serialIds.push(serialId)
      restored.set(group.key, current)
    }

    for (const equipmentId of listToEdit.equipment_ids ?? []) {
      const item = equipmentById.get(equipmentId)
      const group = item ? groupsByKey.get(groupKey(item)) : undefined
      if (group) addRestored(group, 1, equipmentId)
    }
    for (const item of listToEdit.equipment_items ?? []) {
      const group = groupsByKey.get(groupKey(item))
      if (group) addRestored(group, Math.max(1, Number(item.count) || 1), item.tracking_mode === 'serialized' ? item.equipment_id : undefined)
    }

    const restoredItems = [...restored.values()]
    setSelected(restoredItems)
    // Точка отсчёта для «есть несохранённые правки»: считаем её по строке из
    // базы, а не по стейту — стейт шапки мог уже разъехаться с ней, если
    // пользователь начал печатать, пока ехал каталог.
    savedSnapshotRef.current = serializeDocument({
      name: listToEdit.name,
      clientName: listToEdit.client_name ?? '',
      venue: listToEdit.venue ?? '',
      description: listToEdit.description ?? '',
      eventDate: listToEdit.reservation_start ?? todayDateValue(),
      items: restoredItems,
    })
    hydratedSelectionRef.current = listToEdit.id
  }, [equipment, groups, groupsByKey, listToEdit])

  // Выборка черновика поднимается только по живому каталогу: позицию ищем по
  // ключу группы, серийники оставляем те, что ещё существуют. Пока каталог
  // грузится или не загрузился вовсе, восстановление не запускается — иначе
  // «ничего не нашлось» стёрло бы черновик вместо того, чтобы его вернуть.
  useEffect(() => {
    if (!restoredDraft || draftRestoredRef.current || isLoading || hasLoadError) return
    const restored: SelectedGroup[] = []
    let missingGroups = 0

    for (const item of restoredDraft.items) {
      const group = groupsByKey.get(item.key)
      if (!group) {
        missingGroups += 1
        continue
      }
      const serialIds = item.serialIds.filter((id) => group.serializedItems.some((unit) => unit.id === id))
      restored.push({ key: group.key, label: selectionLabel(group), count: Math.max(1, item.count), serialIds, serialPickerOpen: false })
    }

    setSelected(restored)
    // Единицы, а не строки: то же число, что и «Всего единиц» в подвале выборки, —
    // иначе плашка и подвал спорят друг с другом на одном экране.
    setDraftNotice({ missingGroups, units: restored.reduce((sum, item) => sum + item.count, 0) })
    draftRestoredRef.current = true
  }, [groupsByKey, hasLoadError, isLoading, restoredDraft])

  const draftItems = useMemo(() => selected.map((item) => ({
    key: item.key,
    count: item.count,
    serialIds: item.serialIds,
  })), [selected])

  useListDraftAutosave({ listId, restoredRef: draftRestoredRef, name, clientName, venue, description, eventDate, items: draftItems })

  // Правки сохранённого списка не автосохраняются, поэтому закрытие вкладки
  // спрашивает подтверждение. На /lists/new предупреждения нет — там черновик
  // лежит в localStorage. Текст диалога свой у каждого браузера, задать его нельзя.
  const isDirty = savedSnapshotRef.current !== ''
    && savedSnapshotRef.current !== serializeDocument({ name, clientName, venue, description, eventDate, items: draftItems })

  useEffect(() => {
    if (!listId || !isDirty) return
    const warnOnUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      // Хвост для Chrome/Edge младше 119: они не смотрят на preventDefault, а
      // диалог показывают, только если returnValue стал НЕ пустой строкой
      // (пустая — его же значение по умолчанию, то есть присвоение впустую).
      event.returnValue = true
    }
    window.addEventListener('beforeunload', warnOnUnload)
    return () => window.removeEventListener('beforeunload', warnOnUnload)
  }, [isDirty, listId])

  // «Начать заново»: черновик стирается, форма пустеет.
  function discardDraft() {
    clearListDraft()
    setDraftNotice(null)
    setSelected([])
    setName('')
    setClientName('')
    setVenue('')
    setDescription('')
    setEventDate(todayDateValue())
    setSuccessMessage('')
    setRequisiteErrors(new Set())
  }

  function clearRequisiteError(field: RequisiteField) {
    setRequisiteErrors((current) => {
      if (!current.has(field)) return current
      const next = new Set(current)
      next.delete(field)
      return next
    })
  }

  // Правка реквизита снимает с поля подсветку «обязательно для согласования»:
  // пользователь уже отвечает на подсказку, держать её дальше незачем.
  function changeMeta(field: ListMetaField, value: string) {
    switch (field) {
      case 'name': setName(value); clearRequisiteError(field); break
      case 'clientName': setClientName(value); clearRequisiteError(field); break
      case 'venue': setVenue(value); clearRequisiteError(field); break
      case 'description': setDescription(value); break
      case 'eventDate': setEventDate(value); break
    }
  }

  const selectedCount = selected.reduce((sum, item) => sum + item.count, 0)
  const selectedKeys = useMemo(() => new Set(selected.map((item) => item.key)), [selected])
  const selectedByKey = useMemo(() => new Map(selected.map((item) => [item.key, item])), [selected])
  // Выборка, склеенная со свежим каталогом. group === null означает, что модели
  // в каталоге больше нет: позицию не выбрасываем, рисуем по снимку подписи.
  const resolvedSelection = useMemo(() => selected.map((item) => ({
    item,
    group: groupsByKey.get(item.key) ?? null,
    label: groupsByKey.get(item.key) ?? item.label,
  })), [groupsByKey, selected])
  const canSubmit = selectedCount > 0 && !isOpening && !openError

  function moveToMobilePanel(panel: 'catalog' | 'selection') {
    const switching = panel !== mobilePanel
    if (switching) panelScrollRef.current[mobilePanel] = window.scrollY
    setMobilePanel(panel)
    window.requestAnimationFrame(() => {
      // Вкладка уже открывалась — возвращаемся туда, где с неё ушли. Повторное
      // нажатие на активную вкладку — к её заголовку, как и первое открытие.
      const remembered = switching ? panelScrollRef.current[panel] : undefined
      if (remembered !== undefined) {
        window.scrollTo({ top: remembered })
        return
      }
      const target = panel === 'catalog' ? catalogRef.current : selectionRef.current
      if (!target) return
      // scrollIntoView прижимал панель к самому верху окна — липкие табы накрывали
      // её заголовок. Скроллим руками, оставляя ровно высоту полосы табов.
      window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - MOBILE_TABS_HEIGHT, behavior: 'smooth' })
    })
  }

  function addGroup(group: CatalogGroup) {
    setSuccessMessage('')
    setSelected((current) => {
      const existing = current.find((item) => item.key === group.key)
      if (existing) return current.map((item) => item.key === group.key ? { ...item, count: item.count + 1 } : item)
      return [...current, { key: group.key, label: selectionLabel(group), count: 1, serialIds: [], serialPickerOpen: false }]
    })
  }

  function changeCount(key: string, delta: number) {
    setSelected((current) => current
      .map((item) => {
        if (item.key !== key) return item
        const count = Math.max(0, item.count + delta)
        return { ...item, count, serialIds: item.serialIds.slice(0, count) }
      })
      .filter((item) => item.count > 0))
  }

  // Количество, набранное с клавиатуры. Ноль сюда не доходит: удаление позиции —
  // это корзина и «−» с единицы, а не пустое поле.
  function setCount(key: string, count: number) {
    const next = Math.min(MAX_ITEM_COUNT, Math.max(1, count))
    setSelected((current) => current.map((item) => item.key === key
      ? { ...item, count: next, serialIds: item.serialIds.slice(0, next) }
      : item))
  }

  // Набранное число применяется ОДИН раз — на blur или Enter, а не на каждый символ:
  // иначе «12» поверх «5» проходило бы через count = 1 и резало бы выбранные S/N до
  // одного, восстановить которые нечем. Клик по любой кнопке сначала снимает фокус,
  // так что «Сохранить»/«Excel» всегда видят уже зафиксированное количество.
  function commitCountDraft(key: string) {
    if (countDraft?.key === key && Number(countDraft.text) >= 1) setCount(key, Number(countDraft.text))
    setCountDraft(null)
  }

  function toggleSerialPicker(key: string) {
    setSelected((current) => current.map((item) => item.key === key ? { ...item, serialPickerOpen: !item.serialPickerOpen } : item))
  }

  function toggleSerial(key: string, equipmentId: string) {
    setSelected((current) => current.map((item) => {
      if (item.key !== key) return item
      const exists = item.serialIds.includes(equipmentId)
      const serialIds = exists ? item.serialIds.filter((id) => id !== equipmentId) : [...item.serialIds, equipmentId]
      return { ...item, serialIds, count: Math.max(item.count, serialIds.length) }
    }))
  }

  function clearSelection() {
    setSuccessMessage('')
    setSelected([])
  }

  // Состав документа собирается по АКТУАЛЬНОМУ каталогу: конкретные единицы
  // берутся только из живой группы. Группы уже нет — вся позиция уходит
  // планируемой строкой по снимку подписи, как и раньше.
  function buildItems(): EquipmentListItem[] {
    return resolvedSelection.flatMap(({ item: selectedItem, group, label }) => {
      const concrete = selectedItem.serialIds.flatMap((id) => {
        const item = group?.serializedItems.find((candidate) => candidate.id === id)
        return item ? [{
          equipment_id: item.id,
          brand: item.brand,
          model: item.model,
          type: item.type,
          subtype: item.subtype,
          count: 1,
          tracking_mode: 'serialized' as const,
        }] : []
      })
      let remaining = selectedItem.count - concrete.length
      const quantityItems: EquipmentListItem[] = []
      for (const item of group?.quantityItems ?? []) {
        if (remaining <= 0) break
        const allocated = Math.min(remaining, Math.max(0, item.count))
        if (allocated <= 0) continue
        quantityItems.push({
          equipment_id: item.id,
          brand: item.brand,
          model: item.model,
          type: item.type,
          subtype: item.subtype,
          count: allocated,
          tracking_mode: 'quantity',
        })
        remaining -= allocated
      }
      const planned: EquipmentListItem[] = remaining > 0 ? [{
        brand: label.brand,
        model: label.model,
        type: label.type,
        subtype: label.subtype,
        count: remaining,
        tracking_mode: 'planned',
      }] : []
      return [...concrete, ...quantityItems, ...planned]
    })
  }

  // Имя собирается в момент действия и только если поле пустое: дата мероприятия
  // отвечает на «что искать в реестре», время — на «который из сегодняшних».
  // Само поле не трогаем — пустое поле законно, и подставлять в него нечего.
  function resolveListName() {
    const trimmed = name.trim()
    if (trimmed) return trimmed
    const date = new Intl.DateTimeFormat(locale).format(parseDateValue(eventDate) ?? new Date())
    const time = formatTime(Date.now(), locale)
    return tr(`Список ${date} · ${time}`, `Ro‘yxat ${date} · ${time}`)
  }

  async function persistList() {
    const items = buildItems()
    const listMode: 'specific' | 'abstract' = items.every((item) => item.tracking_mode !== 'planned') ? 'specific' : 'abstract'
    const input = {
      name: resolveListName(),
      description,
      clientName: clientName.trim(),
      venue: venue.trim(),
      listMode,
      reservationStart: eventDate || null,
      reservationEnd: eventDate || null,
      equipmentItems: items,
    }
    const id = listId ? await updateEquipmentList(listId, input) : await createEquipmentList(input)
    // Имя возвращаем разрешённым: снимок «сохранено» должен совпасть с тем, что
    // приедет из базы гидратацией, иначе список сразу окажется «изменённым».
    return { id, name: input.name }
  }

  async function saveList() {
    if (!canSubmit) return
    const isCreating = !listId
    setIsSaving(true)
    setSaveError('')
    setSuccessMessage('')
    try {
      const saved = await persistList()
      savedSnapshotRef.current = serializeDocument({ name: saved.name, clientName, venue, description, eventDate, items: draftItems })
      // Пустое поле после записи показывает то имя, что уехало в базу: иначе у
      // открытого списка (гидратация для него уже отработала) поле и h1 остались
      // бы пустыми, а «есть несохранённые правки» — взведённым до перезагрузки.
      if (!name.trim()) setName(saved.name)
      setSuccessMessage(isCreating ? tr('Список сохранён в системе.', 'Ro‘yxat tizimda saqlandi.') : tr('Изменения сохранены.', 'O‘zgarishlar saqlandi.'))
      setLastSavedAt(Date.now())
      // После создания источник правды — listId из URL: следующее «Сохранить» обновит эту же запись, а не заведёт вторую.
      if (isCreating) {
        // Черновик своё отработал: дальше запись живёт в базе.
        clearListDraft()
        setDraftNotice(null)
        navigate(`/lists/${saved.id}/edit`, { replace: true })
      }
    } catch {
      setSaveError(tr('Не удалось сохранить список. Файл всё ещё можно скачать.', 'Ro‘yxatni saqlab bo‘lmadi. Faylni baribir yuklab olish mumkin.'))
    } finally {
      setIsSaving(false)
    }
  }

  function exportList(documentMode: 'working' | 'approval') {
    if (!canSubmit) return
    // Реквизиты обязательны только для документа на согласование: он идёт
    // заказчику под грифом «УТВЕРЖДАЮ», и пустых строк в нём быть не должно.
    // «Рабочий Excel» и «Сохранить» не требуют ни одного заполненного поля.
    if (documentMode === 'approval') {
      const fields: [RequisiteField, string][] = [['name', name], ['clientName', clientName], ['venue', venue]]
      const missing = fields.filter(([, value]) => !value.trim()).map(([field]) => field)
      if (missing.length > 0) {
        setRequisiteErrors(new Set(missing))
        setSaveError(tr(
          'Для документа на согласование заполните название, заказчика и площадку.',
          'Kelishuv hujjati uchun nom, buyurtmachi va maydonni to‘ldiring.',
        ))
        setSuccessMessage('')
        setMetaOpen(true)
        // Поля свёрнутой панели появляются в DOM только после раскрытия, поэтому
        // прокрутка и фокус — следующим кадром. preventScroll обязателен: обычный
        // фокус прыгает к полю мгновенно и обрывает плавную прокрутку к панели.
        window.requestAnimationFrame(() => {
          metaRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
          document.getElementById(`quick-list-${missing[0]}`)?.focus({ preventScroll: true })
        })
        return
      }
    }
    setRequisiteErrors(new Set())
    setIsExporting(documentMode)
    setSaveError('')
    setSuccessMessage('')
    try {
      downloadEquipmentListXlsx({
        name: resolveListName(),
        clientName: clientName.trim(),
        venue: venue.trim(),
        description: description.trim(),
        eventDate: eventDate || null,
        locale,
        language,
        documentMode,
        rows: resolvedSelection.map(({ item, group, label }) => ({
          category: label.type,
          equipment: `${label.brand} ${label.model}`.trim(),
          subtype: label.subtype,
          count: item.count,
          serialNumbers: item.serialIds.flatMap((id) => {
            const equipmentItem = group?.serializedItems.find((candidate) => candidate.id === id)
            return equipmentItem?.serialnumber ? [equipmentItem.serialnumber] : []
          }),
        })),
      })
      setSuccessMessage(tr('Excel скачан. Сохранять список в системе необязательно.', 'Excel yuklandi. Ro‘yxatni tizimda saqlash shart emas.'))
    } catch {
      setSaveError(tr('Не удалось подготовить Excel. Попробуйте ещё раз.', 'Excelni tayyorlab bo‘lmadi. Qayta urinib ko‘ring.'))
    } finally {
      setIsExporting('')
    }
  }

  const isBusy = isSaving || isExporting !== ''
  // Один набор действий на две точки монтажа: шапка (десктоп) и футер выборки
  // (телефон). Разные подписи в двух местах разошлись бы при первой же правке.
  const actionButtons = (
    <>
      <button className="button button--secondary" onClick={() => void saveList()} disabled={!canSubmit || isBusy}>
        <Save size={17} /> {isSaving ? tr('Сохраняем…', 'Saqlanmoqda…') : tr('Сохранить', 'Saqlash')}
      </button>
      <button className="button button--secondary" onClick={() => exportList('working')} disabled={!canSubmit || isBusy} title={tr('Только список оборудования — для команды и работы', 'Faqat uskunalar ro‘yxati — jamoa va ish uchun')}>
        <FileSpreadsheet size={17} />{isExporting === 'working' ? tr('Готовим…', 'Tayyorlanmoqda…') : tr('Рабочий Excel', 'Ishchi Excel')}
      </button>
      <button className="button button--primary" onClick={() => exportList('approval')} disabled={!canSubmit || isBusy} title={tr('Документ для заказчика: с реквизитами и подписями', 'Buyurtmachi uchun hujjat: rekvizitlar va imzolar bilan')}>
        <FileCheck2 size={17} />{isExporting === 'approval' ? tr('Готовим…', 'Tayyorlanmoqda…') : tr('С реквизитами', 'Rekvizitlar bilan')}
      </button>
    </>
  )

  // Строка состояния занимает место eyebrow и имеет фиксированную высоту: результат
  // действия сменяет нейтральный статус, не двигая раскладку и не заводя тостов.
  const statusTone = saveError ? 'error' : successMessage ? 'success' : ''
  const statusText = saveError || successMessage || (listId
    ? (lastSavedAt
      ? tr(`Черновик · сохранён ${formatDateTime(lastSavedAt, locale)}`, `Qoralama · saqlangan ${formatDateTime(lastSavedAt, locale)}`)
      : tr('Черновик', 'Qoralama'))
    : tr('Новый список — Excel скачивается без сохранения', 'Yangi ro‘yxat — Excel saqlamasdan yuklanadi'))
  const statusBody = (
    <>
      {statusText}
      {Boolean(successMessage) && listId && <> · <Link to="/lists">{tr('Открыть в реестре', 'Reestrda ochish')}</Link></>}
    </>
  )

  return (
    <>
      <header className="editor-header editor-header--quick">
        <button className="icon-button icon-button--bordered" onClick={() => navigate('/lists')} aria-label={tr('Назад к спискам', 'Ro‘yxatlarga qaytish')}>
          <ArrowLeft size={18} />
        </button>
        <div>
          <p className={`editor-status ${statusTone ? `editor-status--${statusTone}` : ''}`} role="status">{statusBody}</p>
          <h1>{name.trim() || tr('Новый список', 'Yangi ro‘yxat')}</h1>
        </div>
        <div className="editor-header__actions">{actionButtons}</div>
      </header>

      {openError && <div className="state-block state-block--error editor-open-error"><CircleAlert size={23} /><strong>{tr('Список не открыт', 'Ro‘yxat ochilmadi')}</strong><span>{tr('Не удалось открыть сохранённый список.', 'Saqlangan ro‘yxatni ochib bo‘lmadi.')}</span><button className="button button--secondary" onClick={() => navigate('/lists')}>{tr('Вернуться к спискам', 'Ro‘yxatlarga qaytish')}</button></div>}

      {draftNotice && (
        <div className="editor-draft-notice">
          <Info size={18} />
          <span>
            <strong>{tr('Черновик восстановлен', 'Qoralama tiklandi')}</strong>
            {/* Что именно вернулось и когда: состав лежит на другой вкладке, и без
                этих двух чисел «восстановлен» относится непонятно к чему, а решение
                нажать «Начать заново» принимается вслепую. */}
            <small>{restoredDraftAt === null
              ? tr(`единиц: ${draftNotice.units}`, `birliklar: ${draftNotice.units}`)
              : tr(
                `единиц: ${draftNotice.units} · изменён ${formatDateTime(restoredDraftAt, locale)}`,
                `birliklar: ${draftNotice.units} · ${formatDateTime(restoredDraftAt, locale)} da o‘zgartirilgan`,
              )}</small>
            {draftNotice.missingGroups > 0 && <small>{tr(
              `позиций больше нет в каталоге: ${draftNotice.missingGroups}`,
              `katalogda qolmagan pozitsiyalar: ${draftNotice.missingGroups}`,
            )}</small>}
          </span>
          <button className="button button--secondary" type="button" onClick={() => restartArmed.fire(discardDraft)} onBlur={restartArmed.disarm}>
            {restartArmed.armed ? tr('Да, начать заново', 'Ha, yangidan boshlansin') : tr('Начать заново', 'Yangidan boshlash')}
          </button>
        </div>
      )}

      <ListEditorMeta
        panelRef={metaRef}
        values={{ name, clientName, venue, description, eventDate }}
        requisiteErrors={requisiteErrors}
        open={metaOpen}
        onToggle={() => setMetaOpen((current) => !current)}
        onChange={changeMeta}
      />

      <div className="mobile-editor-tabs" role="tablist" aria-label={tr('Раздел редактора', 'Tahrirchi bo‘limi')}>
        <button className={mobilePanel === 'catalog' ? 'active' : ''} onClick={() => moveToMobilePanel('catalog')} role="tab" aria-selected={mobilePanel === 'catalog'}>{tr('Каталог', 'Katalog')}</button>
        <button className={mobilePanel === 'selection' ? 'active' : ''} onClick={() => moveToMobilePanel('selection')} role="tab" aria-selected={mobilePanel === 'selection'}>{tr('В списке', 'Ro‘yxatda')} <strong>{selectedCount}</strong></button>
      </div>

      <div ref={gridRef} className="editor-grid editor-grid--quick">
        <CatalogPanel
          panelRef={catalogRef}
          isMobileActive={mobilePanel === 'catalog'}
          groups={groups}
          equipmentCount={equipment.length}
          isLoading={isLoading}
          hasLoadError={hasLoadError}
          selectedKeys={selectedKeys}
          selectedByKey={selectedByKey}
          onPreview={setPreviewGroup}
          onAdd={addGroup}
        />

        <section ref={selectionRef} className={`data-panel selection-panel ${mobilePanel === 'selection' ? 'mobile-active' : ''}`}>
          <div className="panel-heading">
            <div><h2>{tr('Рабочий список', 'Ish ro‘yxati')}</h2><p>{tr('Количество сейчас, серийные номера — при необходимости.', 'Hozir miqdor, zarur bo‘lsa seriya raqamlari.')}</p></div>
            <strong className="selection-count">{selectedCount}</strong>
          </div>

          <div className="selection-list quick-selection-list">
            {selected.length === 0 && (
              <div className="state-block state-block--illustrated">
                <img src="/illustrations/equipment-kit.webp" alt="" aria-hidden="true" />
                <strong>{tr('Список пока пуст', 'Ro‘yxat hozircha bo‘sh')}</strong>
                <span>{tr('Нажмите на нужную модель в каталоге.', 'Katalogdagi kerakli modelni bosing.')}</span>
              </div>
            )}
            {resolvedSelection.map(({ item, group, label }, index) => (
              <article className="quick-selection-item" key={item.key}>
                <div className="quick-selection-item__main">
                  <span className="equipment-row-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                  <div className="quick-selection-item__copy">
                    <strong>{label.brand} {label.model}</strong>
                    <small>{translateEquipmentTaxonomy(label.subtype, language)} · {group
                      ? `${tr('на складе', 'omborda')} ${group.availableCount}`
                      : tr('нет в каталоге', 'katalogda yo‘q')}{item.serialIds.length > 0
                        ? tr(` · S/N ${item.serialIds.length} из ${item.count}`, ` · S/N ${item.serialIds.length} / ${item.count}`)
                        : ''}</small>
                  </div>
                  <div className="quantity-stepper">
                    <button onClick={() => changeCount(item.key, -1)} aria-label={tr('Уменьшить', 'Kamaytirish')}><Minus size={14} /></button>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      aria-label={tr('Количество', 'Miqdor')}
                      value={countDraft?.key === item.key ? countDraft.text : String(item.count)}
                      onFocus={(event) => event.currentTarget.select()}
                      onChange={(event) => setCountDraft({ key: item.key, text: event.target.value.replace(/\D+/g, '').slice(0, 3) })}
                      onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }}
                      onBlur={() => commitCountDraft(item.key)}
                    />
                    <button onClick={() => changeCount(item.key, 1)} aria-label={tr('Увеличить', 'Ko‘paytirish')}><Plus size={14} /></button>
                  </div>
                  {group && group.serializedItems.length > 0 && (
                    <button
                      className={`icon-button serial-button ${item.serialPickerOpen ? 'is-open' : ''}`}
                      type="button"
                      onClick={() => toggleSerialPicker(item.key)}
                      aria-label={tr('Уточнить серийные номера', 'Seriya raqamlarini aniqlash')}
                      aria-expanded={item.serialPickerOpen}
                    ><ScanBarcode size={16} /></button>
                  )}
                  <button className="icon-button" onClick={() => changeCount(item.key, -item.count)} aria-label={tr('Удалить модель', 'Modelni o‘chirish')}><Trash2 size={16} /></button>
                </div>
                {group && item.count > group.availableCount && <p className="quick-inline-warning"><CircleAlert size={13} /> {tr('Больше текущего остатка — в Excel попадёт указанное количество.', 'Joriy qoldiqdan ko‘p — Excelga ko‘rsatilgan miqdor tushadi.')}</p>}
                {!group && <p className="quick-inline-warning"><CircleAlert size={13} /> {tr('Модели больше нет в каталоге — позиция уйдёт в документ как планируемая.', 'Model katalogda yo‘q — pozitsiya hujjatga rejalashtirilgan sifatida tushadi.')}</p>}
                {group && group.serializedItems.length > 0 && item.serialPickerOpen && (
                  <div className="serial-picker">
                    <p>{tr('Отметьте только те номера, которые точно поедут на мероприятие.', 'Tadbirga aniq olib boriladigan raqamlarni belgilang.')}</p>
                    <div>{group.serializedItems.map((equipmentItem) => {
                      const active = item.serialIds.includes(equipmentItem.id)
                      return <button className={active ? 'active' : ''} onClick={() => toggleSerial(item.key, equipmentItem.id)} key={equipmentItem.id} type="button"><span>{active && <Check size={13} />}</span>{equipmentItem.serialnumber || tr('Без номера', 'Raqamsiz')}</button>
                    })}</div>
                  </div>
                )}
              </article>
            ))}
          </div>

          <footer className="selection-footer">
            <div>
              <span className="selection-footer__total">{tr('Всего единиц', 'Jami birliklar')} <strong>{selectedCount}</strong></span>
              {selected.length > 0 && (
                <button
                  className={`clear-selection ${clearArmed.armed ? 'clear-selection--armed' : ''}`}
                  onClick={() => clearArmed.fire(clearSelection)}
                  onBlur={clearArmed.disarm}
                  type="button"
                ><Trash2 size={14} /> {clearArmed.armed
                  ? tr(`Да, очистить ${selectedCount}`, `Ha, ${selectedCount} ta tozalansin`)
                  : tr('Очистить список', 'Ro‘yxatni tozalash')}</button>
              )}
            </div>
            {/* Дубль действий для телефона: на десктопе он скрыт CSS, там кнопки живут в
                липкой шапке. Сообщение о результате держим рядом с нажатой кнопкой. */}
            <div className="selection-footer__mobile">
              {actionButtons}
              {statusTone !== '' && <p className={`editor-status editor-status--${statusTone} editor-status--inline`}>{statusBody}</p>}
            </div>
          </footer>
        </section>
      </div>

      {selectedCount > 0 && mobilePanel === 'catalog' && (
        <button className="mobile-selection-bar" type="button" onClick={() => moveToMobilePanel('selection')}>
          <span><ListChecks size={18} /> {tr('Добавлено в список', 'Ro‘yxatga qo‘shildi')} <strong>{selectedCount}</strong></span>
          <span>{tr('Открыть', 'Ochish')} <ArrowDown size={16} /></span>
        </button>
      )}

      {previewGroup && <CatalogPreviewDrawer group={previewGroup} onClose={() => setPreviewGroup(null)} onAdd={() => { addGroup(previewGroup); setPreviewGroup(null) }} />}
    </>
  )
}
