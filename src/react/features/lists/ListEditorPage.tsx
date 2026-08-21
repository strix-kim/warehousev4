import {
  ArrowDown,
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronDown,
  CircleAlert,
  FileSpreadsheet,
  Hash,
  Info,
  ListChecks,
  Minus,
  Plus,
  Save,
  Trash2,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppDatePicker } from '../../components/AppDatePicker'
import { AppSelect } from '../../components/AppSelect'
import { preloadEquipmentImages } from '../../components/EquipmentVisual'
import { todayDateValue } from '../../lib/date'
import { translateEquipmentTaxonomy } from '../../lib/equipmentTaxonomy'
import { useLanguage } from '../../lib/i18n'
import { fetchAllEquipment, readCachedAllEquipment } from '../equipment/api'
import type { Equipment } from '../equipment/types'
import {
  clearListDraft,
  createEquipmentList,
  fetchEquipmentList,
  readCachedEquipmentList,
  readListDraft,
  updateEquipmentList,
  type EquipmentList,
  type EquipmentListItem,
} from './api'
import { buildCatalogGroups, groupKey, type CatalogGroup } from './catalogGroups'
import { listDocumentDefaults } from './documentDefaults'
import { CatalogPanel, CatalogPreviewDrawer } from './ListEditorCatalog'
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
type OpenErrorCode = '' | 'not-draft' | 'failed'

function selectDefaultInputValue(input: HTMLInputElement, defaultValue: string) {
  if (input.value === defaultValue) input.select()
}

function selectionLabel(group: CatalogGroup): SelectionLabel {
  return { brand: group.brand, model: group.model, type: group.type, subtype: group.subtype }
}

export function ListEditorPage() {
  const navigate = useNavigate()
  const { listId } = useParams<{ listId: string }>()
  const { tr, language, locale } = useLanguage()
  const defaults = listDocumentDefaults[language]
  // Черновик восстанавливается ТОЛЬКО в режиме создания: у открытого списка
  // источник правды — строка в базе. Шапка документа поднимается прямо в
  // начальном стейте, поэтому эффект языковых дефолтов её уже не перетирает.
  const [restoredDraft] = useState(() => listId ? null : readListDraft())
  const [name, setName] = useState<string>(() => restoredDraft?.name ?? listDocumentDefaults[language].name)
  const [clientName, setClientName] = useState<string>(() => restoredDraft?.clientName ?? listDocumentDefaults[language].clientName)
  const [venue, setVenue] = useState<string>(() => restoredDraft?.venue ?? listDocumentDefaults[language].venue)
  const [description, setDescription] = useState(() => restoredDraft?.description ?? '')
  const [documentMode, setDocumentMode] = useState<'working' | 'approval'>(() => restoredDraft?.documentMode ?? 'working')
  const [eventDate, setEventDate] = useState(() => restoredDraft?.eventDate ?? todayDateValue())
  const [cachedEquipment] = useState(readCachedAllEquipment)
  const [cachedList] = useState(() => listId ? readCachedEquipmentList(listId) : null)
  const [equipment, setEquipment] = useState<Equipment[]>(() => cachedEquipment ?? [])
  const [selected, setSelected] = useState<SelectedGroup[]>([])
  const [isLoading, setIsLoading] = useState(() => !cachedEquipment)
  const [isSaving, setIsSaving] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  // Каталог: тоже только флаг — текст ошибки собирается на рендере.
  const [hasLoadError, setHasLoadError] = useState(false)
  const [openError, setOpenError] = useState<OpenErrorCode>('')
  const [isOpening, setIsOpening] = useState(Boolean(listId && !cachedList))
  const [listToEdit, setListToEdit] = useState<EquipmentList | null>(() => cachedList?.reservation_status === 'draft' ? cachedList : null)
  const [saveError, setSaveError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [previewGroup, setPreviewGroup] = useState<CatalogGroup | null>(null)
  const [mobilePanel, setMobilePanel] = useState<'catalog' | 'selection'>('catalog')
  const catalogRef = useRef<HTMLElement>(null)
  const selectionRef = useRef<HTMLElement>(null)
  // Сколько позиций черновика не нашлось в живом каталоге. null — плашки нет.
  const [draftNotice, setDraftNotice] = useState<{ missingGroups: number } | null>(null)
  // Гидратация разведена на две: шапка документа заполняется сразу из строки
  // списка, состав — только когда приехал каталог.
  const hydratedMetaRef = useRef('')
  const hydratedSelectionRef = useRef('')
  // Автосейв заблокирован, пока восстановление не закончилось: стартовый пустой
  // стейт затёр бы сохранённый черновик раньше, чем тот успеет подняться.
  // Восстанавливать нечего — снят сразу.
  const draftRestoredRef = useRef(!restoredDraft)

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
    if (cached?.reservation_status === 'draft') setListToEdit(cached)
    setIsOpening(!cached)
    setOpenError('')
    fetchEquipmentList(listId, { bypassCache: Boolean(cached) })
      .then((list) => {
        if (!current) return
        if (list.reservation_status !== 'draft') throw new Error('not-draft')
        setListToEdit(list)
      })
      .catch((error) => {
        if (!current) return
        if (error instanceof Error && error.message === 'not-draft') {
          setListToEdit(null)
          setOpenError('not-draft')
          return
        }
        if (cached?.reservation_status === 'draft') return
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
    setClientName(listToEdit.client_name ?? defaults.clientName)
    setVenue(listToEdit.venue ?? defaults.venue)
    setDescription(listToEdit.description ?? '')
    setEventDate(listToEdit.reservation_start ?? todayDateValue())
    hydratedMetaRef.current = listToEdit.id
  }, [defaults.clientName, defaults.venue, listToEdit])

  useEffect(() => {
    const allDefaults = Object.values(listDocumentDefaults)
    setName((current) => allDefaults.some((item) => item.name === current) ? defaults.name : current)
    setClientName((current) => allDefaults.some((item) => item.clientName === current) ? defaults.clientName : current)
    setVenue((current) => allDefaults.some((item) => item.venue === current) ? defaults.venue : current)
  }, [defaults])

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

    setSelected([...restored.values()])
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
    setDraftNotice({ missingGroups })
    draftRestoredRef.current = true
  }, [groupsByKey, hasLoadError, isLoading, restoredDraft])

  const draftItems = useMemo(() => selected.map((item) => ({
    key: item.key,
    count: item.count,
    serialIds: item.serialIds,
  })), [selected])

  useListDraftAutosave({ listId, restoredRef: draftRestoredRef, name, clientName, venue, description, eventDate, documentMode, items: draftItems })

  // «Начать заново»: черновик стирается, форма возвращается к дефолтам.
  function discardDraft() {
    clearListDraft()
    setDraftNotice(null)
    setSelected([])
    setName(defaults.name)
    setClientName(defaults.clientName)
    setVenue(defaults.venue)
    setDescription('')
    setEventDate(todayDateValue())
    setDocumentMode('working')
    setSuccessMessage('')
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
    setMobilePanel(panel)
    window.requestAnimationFrame(() => {
      const target = panel === 'catalog' ? catalogRef.current : selectionRef.current
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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

  async function persistList() {
    const items = buildItems()
    const listMode: 'specific' | 'abstract' = items.every((item) => item.tracking_mode !== 'planned') ? 'specific' : 'abstract'
    const input = {
      name: name.trim() || defaults.name,
      description,
      clientName: clientName.trim() || defaults.clientName,
      venue: venue.trim() || defaults.venue,
      listMode,
      reservationStart: eventDate || null,
      reservationEnd: eventDate || null,
      equipmentItems: items,
    }
    return listId ? await updateEquipmentList(listId, input) : await createEquipmentList(input)
  }

  async function saveList() {
    if (!canSubmit) return
    const isCreating = !listId
    setIsSaving(true)
    setSaveError('')
    setSuccessMessage('')
    try {
      const id = await persistList()
      setSuccessMessage(isCreating ? tr('Список сохранён в системе.', 'Ro‘yxat tizimda saqlandi.') : tr('Изменения сохранены.', 'O‘zgarishlar saqlandi.'))
      // После создания источник правды — listId из URL: следующее «Сохранить» обновит эту же запись, а не заведёт вторую.
      if (isCreating) {
        // Черновик своё отработал: дальше запись живёт в базе.
        clearListDraft()
        setDraftNotice(null)
        navigate(`/lists/${id}/edit`, { replace: true })
      }
    } catch {
      setSaveError(tr('Не удалось сохранить список. Файл всё ещё можно скачать.', 'Ro‘yxatni saqlab bo‘lmadi. Faylni baribir yuklab olish mumkin.'))
    } finally {
      setIsSaving(false)
    }
  }

  function exportList() {
    if (!canSubmit) return
    setIsExporting(true)
    setSaveError('')
    setSuccessMessage('')
    try {
      downloadEquipmentListXlsx({
        name: name.trim() || defaults.name,
        clientName: clientName.trim() || defaults.clientName,
        venue: venue.trim() || defaults.venue,
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
      setIsExporting(false)
    }
  }

  return (
    <>
      <header className="editor-header editor-header--quick">
        <button className="icon-button icon-button--bordered" onClick={() => navigate('/lists')} aria-label={tr('Назад к спискам', 'Ro‘yxatlarga qaytish')}>
          <ArrowLeft size={18} />
        </button>
        <div>
          <p className="eyebrow">{listId ? tr('Редактирование черновика', 'Qoralamani tahrirlash') : tr('Быстрый рабочий документ', 'Tezkor ish hujjati')}</p>
          <h1>{listId ? tr('Открытый список', 'Ochiq ro‘yxat') : tr('Список оборудования', 'Uskunalar ro‘yxati')}</h1>
        </div>
        <div className="editor-header__actions">
          <button className="button button--secondary" onClick={() => void saveList()} disabled={!canSubmit || isSaving || isExporting}>
            <Save size={17} /> {isSaving ? tr('Сохраняем…', 'Saqlanmoqda…') : tr('Сохранить', 'Saqlash')}
          </button>
          <button className="button button--primary" onClick={() => void exportList()} disabled={!canSubmit || isSaving || isExporting}>
            <FileSpreadsheet size={18} /> {isExporting ? tr('Готовим Excel…', 'Excel tayyorlanmoqda…') : tr('Скачать Excel', 'Excel yuklash')}
          </button>
        </div>
      </header>

      {openError && <div className="state-block state-block--error editor-open-error"><CircleAlert size={23} /><strong>{tr('Список не открыт', 'Ro‘yxat ochilmadi')}</strong><span>{openError === 'not-draft'
        ? tr('Изменять можно только черновики. Подтверждённый или выданный список доступен в режиме просмотра.', 'Faqat qoralamalarni o‘zgartirish mumkin. Tasdiqlangan yoki berilgan ro‘yxat faqat ko‘rish rejimida mavjud.')
        : tr('Не удалось открыть сохранённый список.', 'Saqlangan ro‘yxatni ochib bo‘lmadi.')}</span><button className="button button--secondary" onClick={() => navigate('/lists')}>{tr('Вернуться к спискам', 'Ro‘yxatlarga qaytish')}</button></div>}

      {draftNotice && (
        <div className="editor-draft-notice">
          <Info size={18} />
          <span>
            <strong>{tr('Черновик восстановлен', 'Qoralama tiklandi')}</strong>
            {draftNotice.missingGroups > 0 && <small>{tr(
              `позиций больше нет в каталоге: ${draftNotice.missingGroups}`,
              `katalogda qolmagan pozitsiyalar: ${draftNotice.missingGroups}`,
            )}</small>}
          </span>
          <button className="button button--secondary" type="button" onClick={discardDraft}>{tr('Начать заново', 'Yangidan boshlash')}</button>
        </div>
      )}

      <section className="quick-list-meta data-panel">
        <label className="field quick-list-meta__name">
          <span>{tr('Проект или мероприятие', 'Loyiha yoki tadbir')} <small>{tr('можно не менять', 'o‘zgartirish shart emas')}</small></span>
          <input
            value={name}
            onFocus={(event) => selectDefaultInputValue(event.currentTarget, defaults.name)}
            onPointerDown={(event) => {
              if (event.currentTarget.value !== defaults.name) return
              event.preventDefault()
              event.currentTarget.focus()
              event.currentTarget.select()
            }}
            onBlur={(event) => {
              if (event.currentTarget.value.trim()) return
              setName(defaults.name)
            }}
            onChange={(event) => setName(event.target.value)}
            placeholder={tr('Например, Форум в Hyatt', 'Masalan, Hyatt forumi')}
          />
        </label>
        <div className="field">
          <span><CalendarDays size={13} /> {tr('Дата', 'Sana')} <small>{tr('сегодня по умолчанию', 'standart — bugun')}</small></span>
          <AppDatePicker
            value={eventDate}
            onChange={setEventDate}
            locale={locale}
            placeholder={tr('Выберите дату', 'Sanani tanlang')}
            ariaLabel={tr('Дата мероприятия', 'Tadbir sanasi')}
            todayLabel={tr('Сегодня', 'Bugun')}
            clearLabel={tr('Очистить', 'Tozalash')}
            previousMonthLabel={tr('Предыдущий месяц', 'Oldingi oy')}
            nextMonthLabel={tr('Следующий месяц', 'Keyingi oy')}
          />
        </div>
        <label className="field quick-list-meta__client">
          <span>{tr('Заказчик / организатор', 'Buyurtmachi / tashkilotchi')} <small>{tr('можно уточнить', 'aniqlashtirish mumkin')}</small></span>
          <input
            value={clientName}
            onFocus={(event) => selectDefaultInputValue(event.currentTarget, defaults.clientName)}
            onPointerDown={(event) => {
              if (event.currentTarget.value !== defaults.clientName) return
              event.preventDefault()
              event.currentTarget.focus()
              event.currentTarget.select()
            }}
            onBlur={(event) => {
              if (event.currentTarget.value.trim()) return
              setClientName(defaults.clientName)
            }}
            onChange={(event) => setClientName(event.target.value)}
            placeholder={tr('Например, ARGO Media', 'Masalan, ARGO Media')}
          />
        </label>
        <label className="field quick-list-meta__venue">
          <span>{tr('Площадка / локация', 'Maydon / joylashuv')} <small>{tr('можно уточнить', 'aniqlashtirish mumkin')}</small></span>
          <input
            value={venue}
            onFocus={(event) => selectDefaultInputValue(event.currentTarget, defaults.venue)}
            onPointerDown={(event) => {
              if (event.currentTarget.value !== defaults.venue) return
              event.preventDefault()
              event.currentTarget.focus()
              event.currentTarget.select()
            }}
            onBlur={(event) => {
              if (event.currentTarget.value.trim()) return
              setVenue(defaults.venue)
            }}
            onChange={(event) => setVenue(event.target.value)}
            placeholder={tr('Например, Hyatt Regency', 'Masalan, Hyatt Regency')}
          />
        </label>
        <label className="field quick-list-meta__notes">
          <span>{tr('Комментарий к документу', 'Hujjatga izoh')}</span>
          <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder={tr('Необязательно: зал, время, особенности комплекта', 'Ixtiyoriy: zal, vaqt, jamlanma xususiyatlari')} />
        </label>
        <div className="field quick-list-meta__document">
          <span>{tr('Формат Excel', 'Excel formati')}</span>
          <AppSelect
            value={documentMode}
            options={[
              { value: 'working', label: tr('Рабочий список', 'Ish ro‘yxati') },
              { value: 'approval', label: tr('На согласование + реквизиты', 'Tasdiqlash + rekvizitlar') },
            ]}
            onChange={setDocumentMode}
            ariaLabel={tr('Формат Excel-документа', 'Excel hujjati formati')}
          />
        </div>
        <div className="quick-list-hint"><Hash size={17} /><span>{tr('Добавляйте модели и количество. Серийные номера можно указать позже только там, где это нужно.', 'Modellar va miqdorni qo‘shing. Seriya raqamlarini keyin faqat kerak bo‘lgan joyda ko‘rsatish mumkin.')}</span></div>
        <div className="quick-list-next">
          <button className="button button--primary" type="button" onClick={() => moveToMobilePanel('catalog')}>
            {tr('Перейти к оборудованию', 'Uskunalarga o‘tish')} <ArrowDown size={17} />
          </button>
        </div>
      </section>

      <div className="mobile-editor-tabs" role="tablist" aria-label={tr('Раздел редактора', 'Tahrirchi bo‘limi')}>
        <button className={mobilePanel === 'catalog' ? 'active' : ''} onClick={() => moveToMobilePanel('catalog')} role="tab" aria-selected={mobilePanel === 'catalog'}>{tr('Каталог', 'Katalog')}</button>
        <button className={mobilePanel === 'selection' ? 'active' : ''} onClick={() => moveToMobilePanel('selection')} role="tab" aria-selected={mobilePanel === 'selection'}>{tr('В списке', 'Ro‘yxatda')} <strong>{selectedCount}</strong></button>
      </div>

      <div className="editor-grid editor-grid--quick">
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
                      : tr('нет в каталоге', 'katalogda yo‘q')}</small>
                  </div>
                  <div className="quantity-stepper">
                    <button onClick={() => changeCount(item.key, -1)} aria-label={tr('Уменьшить', 'Kamaytirish')}><Minus size={14} /></button>
                    <strong>{item.count}</strong>
                    <button onClick={() => changeCount(item.key, 1)} aria-label={tr('Увеличить', 'Ko‘paytirish')}><Plus size={14} /></button>
                  </div>
                  <button className="icon-button" onClick={() => changeCount(item.key, -item.count)} aria-label={tr('Удалить модель', 'Modelni o‘chirish')}><Trash2 size={16} /></button>
                </div>
                {group && item.count > group.availableCount && <p className="quick-inline-warning"><CircleAlert size={13} /> {tr('Больше текущего остатка — в Excel попадёт указанное количество.', 'Joriy qoldiqdan ko‘p — Excelga ko‘rsatilgan miqdor tushadi.')}</p>}
                {!group && <p className="quick-inline-warning"><CircleAlert size={13} /> {tr('Модели больше нет в каталоге — позиция уйдёт в документ как планируемая.', 'Model katalogda yo‘q — pozitsiya hujjatga rejalashtirilgan sifatida tushadi.')}</p>}
                {group && group.serializedItems.length > 0 && (
                  <>
                    <button className="serial-toggle" onClick={() => toggleSerialPicker(item.key)} type="button">
                      <span>{item.serialIds.length
                        ? tr(`Выбрано S/N: ${item.serialIds.length} из ${item.count}`, `S/N tanlandi: ${item.serialIds.length} / ${item.count}`)
                        : tr('Серийные номера не указывать', 'Seriya raqamlarini ko‘rsatmaslik')}</span>
                      <span>{item.serialPickerOpen ? tr('Скрыть', 'Yashirish') : tr('Уточнить S/N', 'S/N aniqlash')} <ChevronDown size={14} /></span>
                    </button>
                    {item.serialPickerOpen && (
                      <div className="serial-picker">
                        <p>{tr('Отметьте только те номера, которые точно поедут на мероприятие.', 'Tadbirga aniq olib boriladigan raqamlarni belgilang.')}</p>
                        <div>{group.serializedItems.map((equipmentItem) => {
                          const active = item.serialIds.includes(equipmentItem.id)
                          return <button className={active ? 'active' : ''} onClick={() => toggleSerial(item.key, equipmentItem.id)} key={equipmentItem.id} type="button"><span>{active && <Check size={13} />}</span>{equipmentItem.serialnumber || tr('Без номера', 'Raqamsiz')}</button>
                        })}</div>
                      </div>
                    )}
                  </>
                )}
              </article>
            ))}
          </div>

          <footer className="selection-footer">
            <div><span>{tr('Всего единиц', 'Jami birliklar')}</span><strong>{selectedCount}</strong></div>
            {selected.length > 0 && <button className="clear-selection" onClick={clearSelection} type="button"><Trash2 size={14} /> {tr('Очистить список', 'Ro‘yxatni tozalash')}</button>}
            <div className="quick-list-actions">
              <button className="button button--secondary" onClick={() => void saveList()} disabled={!canSubmit || isSaving || isExporting}><Save size={16} /> {isSaving ? tr('Сохраняем…', 'Saqlanmoqda…') : tr('Сохранить', 'Saqlash')}</button>
              <button className="button button--primary" onClick={() => void exportList()} disabled={!canSubmit || isSaving || isExporting}><FileSpreadsheet size={17} /> {isExporting ? tr('Готовим…', 'Tayyorlanmoqda…') : tr('Скачать Excel', 'Excel yuklash')}</button>
            </div>
            {successMessage && <p className="form-success"><Check size={14} /> {successMessage}</p>}
            {saveError && <p className="form-error"><CircleAlert size={14} /> {saveError}</p>}
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
