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
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppDatePicker } from '../../components/AppDatePicker'
import { AppSelect } from '../../components/AppSelect'
import { EquipmentVisual, preloadEquipmentImages } from '../../components/EquipmentVisual'
import { todayDateValue } from '../../lib/date'
import { translateEquipmentTaxonomy } from '../../lib/equipmentTaxonomy'
import { useLanguage } from '../../lib/i18n'
import { useModalLayer } from '../../lib/useModalLayer'
import { fetchAllEquipment, readCachedAllEquipment } from '../equipment/api'
import type { Equipment } from '../equipment/types'
import { createEquipmentList, fetchEquipmentList, readCachedEquipmentList, updateEquipmentList, type EquipmentList, type EquipmentListItem } from './api'
import { listDocumentDefaults } from './documentDefaults'
import { downloadEquipmentListXlsx } from './xlsxExport'

type CatalogGroup = {
  key: string
  brand: string
  model: string
  type: string
  subtype: string
  allItems: Equipment[]
  serializedItems: Equipment[]
  quantityItems: Equipment[]
  quantityAvailable: number
  availableCount: number
  totalCount: number
}

type SelectedGroup = {
  group: CatalogGroup
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

function groupKey(item: Pick<Equipment, 'brand' | 'model' | 'type' | 'subtype'>) {
  return [item.brand, item.model, item.type, item.subtype].map((value) => value.trim().toLocaleLowerCase('ru')).join('::')
}

function isAvailable(item: Equipment) {
  const status = item.availability.toLocaleLowerCase('ru')
  if (status.startsWith('не ') || status.includes('диагност') || status === 'issued' || status === 'unavailable') return false
  return status === 'available' || status.startsWith('в н')
}

export function ListEditorPage() {
  const navigate = useNavigate()
  const { listId } = useParams<{ listId: string }>()
  const { tr, language, locale } = useLanguage()
  const defaults = listDocumentDefaults[language]
  const [name, setName] = useState<string>(() => listDocumentDefaults[language].name)
  const [clientName, setClientName] = useState<string>(() => listDocumentDefaults[language].clientName)
  const [venue, setVenue] = useState<string>(() => listDocumentDefaults[language].venue)
  const [description, setDescription] = useState('')
  const [documentMode, setDocumentMode] = useState<'working' | 'approval'>('working')
  const [eventDate, setEventDate] = useState(todayDateValue)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [subcategory, setSubcategory] = useState('')
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
  const [catalogLimit, setCatalogLimit] = useState(60)
  const catalogRef = useRef<HTMLElement>(null)
  const selectionRef = useRef<HTMLElement>(null)
  // Гидратация разведена на две: шапка документа заполняется сразу из строки
  // списка, состав — только когда приехал каталог.
  const hydratedMetaRef = useRef('')
  const hydratedSelectionRef = useRef('')

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

  const groups = useMemo(() => {
    const map = new Map<string, CatalogGroup>()
    for (const item of equipment) {
      const key = groupKey(item)
      const group = map.get(key) ?? {
        key,
        brand: item.brand,
        model: item.model,
        type: item.type,
        subtype: item.subtype,
        allItems: [],
        serializedItems: [],
        quantityItems: [],
        quantityAvailable: 0,
        availableCount: 0,
        totalCount: 0,
      }
      const units = item.tracking_mode === 'serialized' ? 1 : Math.max(0, item.count)
      group.allItems.push(item)
      group.totalCount += units
      if (isAvailable(item)) {
        if (item.tracking_mode === 'serialized') group.serializedItems.push(item)
        else {
          group.quantityItems.push(item)
          group.quantityAvailable += units
        }
        group.availableCount += units
      }
      map.set(key, group)
    }
    return [...map.values()]
      .map((group) => ({ ...group, serializedItems: group.serializedItems.sort((a, b) => (a.serialnumber ?? '').localeCompare(b.serialnumber ?? '')) }))
      .sort((a, b) => `${a.type} ${a.brand} ${a.model}`.localeCompare(`${b.type} ${b.brand} ${b.model}`, 'ru'))
  }, [equipment])

  const categories = useMemo(() => [...new Set(groups.map((group) => group.type))]
    .sort((a, b) => translateEquipmentTaxonomy(a, language).localeCompare(translateEquipmentTaxonomy(b, language), locale)), [groups, language, locale])
  const subcategories = useMemo(() => category
    ? [...new Set(groups.filter((group) => group.type === category).map((group) => group.subtype))]
      .sort((a, b) => translateEquipmentTaxonomy(a, language).localeCompare(translateEquipmentTaxonomy(b, language), locale))
    : [], [category, groups, language, locale])
  const filteredGroups = useMemo(() => {
    const terms = search.trim().toLocaleLowerCase(locale).split(/\s+/).filter(Boolean)
    return groups.filter((group) => {
      if (category && group.type !== category) return false
      if (subcategory && group.subtype !== subcategory) return false
      const haystack = `${group.brand} ${group.model} ${group.type} ${group.subtype} ${translateEquipmentTaxonomy(group.type, language)} ${translateEquipmentTaxonomy(group.subtype, language)}`.toLocaleLowerCase(locale)
      return terms.every((term) => haystack.includes(term))
    })
  }, [category, groups, language, locale, search, subcategory])
  const visibleGroups = filteredGroups.slice(0, catalogLimit)

  useEffect(() => {
    if (!listToEdit || groups.length === 0 || hydratedSelectionRef.current === listToEdit.id) return
    const groupsByKey = new Map(groups.map((group) => [group.key, group]))
    const equipmentById = new Map(equipment.map((item) => [item.id, item]))
    const restored = new Map<string, SelectedGroup>()
    const addRestored = (group: CatalogGroup, count: number, serialId?: string) => {
      const current = restored.get(group.key) ?? { group, count: 0, serialIds: [], serialPickerOpen: false }
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
  }, [equipment, groups, listToEdit])

  useEffect(() => { setSubcategory(''); setCatalogLimit(60) }, [category])
  useEffect(() => setCatalogLimit(60), [search, subcategory])

  const selectedCount = selected.reduce((sum, item) => sum + item.count, 0)
  const selectedKeys = useMemo(() => new Set(selected.map((item) => item.group.key)), [selected])
  const selectedByKey = useMemo(() => new Map(selected.map((item) => [item.group.key, item])), [selected])
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
      const existing = current.find((item) => item.group.key === group.key)
      if (existing) return current.map((item) => item.group.key === group.key ? { ...item, count: item.count + 1 } : item)
      return [...current, { group, count: 1, serialIds: [], serialPickerOpen: false }]
    })
  }

  function changeCount(key: string, delta: number) {
    setSelected((current) => current
      .map((item) => {
        if (item.group.key !== key) return item
        const count = Math.max(0, item.count + delta)
        return { ...item, count, serialIds: item.serialIds.slice(0, count) }
      })
      .filter((item) => item.count > 0))
  }

  function toggleSerialPicker(key: string) {
    setSelected((current) => current.map((item) => item.group.key === key ? { ...item, serialPickerOpen: !item.serialPickerOpen } : item))
  }

  function toggleSerial(key: string, equipmentId: string) {
    setSelected((current) => current.map((item) => {
      if (item.group.key !== key) return item
      const exists = item.serialIds.includes(equipmentId)
      const serialIds = exists ? item.serialIds.filter((id) => id !== equipmentId) : [...item.serialIds, equipmentId]
      return { ...item, serialIds, count: Math.max(item.count, serialIds.length) }
    }))
  }

  function clearSelection() {
    setSuccessMessage('')
    setSelected([])
  }

  function buildItems(): EquipmentListItem[] {
    return selected.flatMap((selectedItem) => {
      const concrete = selectedItem.serialIds.flatMap((id) => {
        const item = selectedItem.group.serializedItems.find((candidate) => candidate.id === id)
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
      for (const item of selectedItem.group.quantityItems) {
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
        brand: selectedItem.group.brand,
        model: selectedItem.group.model,
        type: selectedItem.group.type,
        subtype: selectedItem.group.subtype,
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
      if (isCreating) navigate(`/lists/${id}/edit`, { replace: true })
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
        rows: selected.map((item) => ({
          category: item.group.type,
          equipment: `${item.group.brand} ${item.group.model}`.trim(),
          subtype: item.group.subtype,
          count: item.count,
          serialNumbers: item.serialIds.flatMap((id) => {
            const equipmentItem = item.group.serializedItems.find((candidate) => candidate.id === id)
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
        <section ref={catalogRef} className={`data-panel catalog-picker ${mobilePanel === 'catalog' ? 'mobile-active' : ''}`}>
          <div className="panel-heading">
            <div><h2>{tr('Каталог по моделям', 'Modellar katalogi')}</h2><p>{tr('Одна модель — одна строка, независимо от количества серийных единиц.', 'Seriyali birliklar sonidan qat’i nazar, bir model — bir qator.')}</p></div>
            <span className="read-only-label">{isLoading && groups.length === 0 ? tr('Загружаем каталог…', 'Katalog yuklanmoqda…') : `${groups.length} ${tr('моделей', 'model')}`}</span>
          </div>
          <div className="quick-catalog-toolbar">
            <label className="search-field">
              <Search size={18} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={tr('Модель, бренд или категория…', 'Model, brend yoki toifa…')} aria-label={tr('Поиск оборудования', 'Uskunalarni qidirish')} />
            </label>
            <AppSelect
              value={category}
              options={[{ value: '', label: tr('Все категории', 'Barcha toifalar') }, ...categories.map((value) => ({ value, label: translateEquipmentTaxonomy(value, language) }))]}
              onChange={setCategory}
              ariaLabel={tr('Категория', 'Toifa')}
            />
            {category && subcategories.length > 1 && (
              <AppSelect
                value={subcategory}
                options={[{ value: '', label: tr('Все подкатегории', 'Barcha quyi toifalar') }, ...subcategories.map((value) => ({ value, label: translateEquipmentTaxonomy(value, language) }))]}
                onChange={setSubcategory}
                ariaLabel={tr('Подкатегория', 'Quyi toifa')}
              />
            )}
          </div>
          <div className="picker-results">
            {hasLoadError && <div className="state-block state-block--error"><CircleAlert size={23} /><span>{tr('Не удалось загрузить каталог.', 'Katalogni yuklab bo‘lmadi.')}</span></div>}
            {isLoading && equipment.length === 0 && Array.from({ length: 8 }, (_, index) => <div className="picker-skeleton" key={index} />)}
            {!hasLoadError && visibleGroups.map((group) => {
              const selectedAlready = selectedKeys.has(group.key)
              const selectedItem = selectedByKey.get(group.key)
              const serialCount = group.serializedItems.length
              const tracking = serialCount && group.quantityAvailable
                ? tr('смешанный учёт', 'aralash hisob')
                : serialCount ? tr('есть S/N', 'S/N mavjud') : tr('без S/N', 'S/N siz')
              return (
                <div className={`picker-item picker-item--grouped ${selectedAlready ? 'picker-item--selected' : ''}`} key={group.key}>
                  <button className="picker-item__preview" type="button" onClick={() => setPreviewGroup(group)} aria-label={tr(`Открыть описание ${group.brand} ${group.model}`, `${group.brand} ${group.model} tavsifini ochish`)}>
                    <EquipmentVisual item={group} />
                    <span className="picker-item__copy">
                      <strong>{group.brand} {group.model}</strong>
                      <small>{translateEquipmentTaxonomy(group.subtype, language)} · {tracking}</small>
                    </span>
                    <span className={`picker-item__count ${group.availableCount === 0 ? 'picker-item__count--empty' : ''}`}>{group.availableCount > 0 ? `${tr('доступно', 'mavjud')} ${group.availableCount}` : tr('нет на складе', 'omborda yo‘q')}</span>
                  </button>
                  <button className="picker-item__action" type="button" onClick={() => addGroup(group)} aria-label={tr(`Добавить ещё ${group.brand} ${group.model}`, `${group.brand} ${group.model} yana qo‘shish`)}>
                    <Plus size={17} />
                    {selectedItem && <span>{selectedItem.count}</span>}
                  </button>
                </div>
              )
            })}
            {!hasLoadError && filteredGroups.length > visibleGroups.length && (
              <div className="picker-load-more">
                <button className="button button--secondary" type="button" onClick={() => setCatalogLimit((current) => current + 60)}>
                  {tr('Показать ещё', 'Yana ko‘rsatish')} · {filteredGroups.length - visibleGroups.length}
                </button>
              </div>
            )}
            {!isLoading && !hasLoadError && filteredGroups.length === 0 && <div className="state-block"><Search size={25} /><strong>{tr('Ничего не найдено', 'Hech narsa topilmadi')}</strong><span>{tr('Измените поиск или категорию.', 'Qidiruv yoki toifani o‘zgartiring.')}</span></div>}
          </div>
        </section>

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
            {selected.map((item, index) => (
              <article className="quick-selection-item" key={item.group.key}>
                <div className="quick-selection-item__main">
                  <span className="equipment-row-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                  <div className="quick-selection-item__copy">
                    <strong>{item.group.brand} {item.group.model}</strong>
                    <small>{translateEquipmentTaxonomy(item.group.subtype, language)} · {tr('на складе', 'omborda')} {item.group.availableCount}</small>
                  </div>
                  <div className="quantity-stepper">
                    <button onClick={() => changeCount(item.group.key, -1)} aria-label={tr('Уменьшить', 'Kamaytirish')}><Minus size={14} /></button>
                    <strong>{item.count}</strong>
                    <button onClick={() => changeCount(item.group.key, 1)} aria-label={tr('Увеличить', 'Ko‘paytirish')}><Plus size={14} /></button>
                  </div>
                  <button className="icon-button" onClick={() => changeCount(item.group.key, -item.count)} aria-label={tr('Удалить модель', 'Modelni o‘chirish')}><Trash2 size={16} /></button>
                </div>
                {item.count > item.group.availableCount && <p className="quick-inline-warning"><CircleAlert size={13} /> {tr('Больше текущего остатка — в Excel попадёт указанное количество.', 'Joriy qoldiqdan ko‘p — Excelga ko‘rsatilgan miqdor tushadi.')}</p>}
                {item.group.serializedItems.length > 0 && (
                  <>
                    <button className="serial-toggle" onClick={() => toggleSerialPicker(item.group.key)} type="button">
                      <span>{item.serialIds.length
                        ? tr(`Выбрано S/N: ${item.serialIds.length} из ${item.count}`, `S/N tanlandi: ${item.serialIds.length} / ${item.count}`)
                        : tr('Серийные номера не указывать', 'Seriya raqamlarini ko‘rsatmaslik')}</span>
                      <span>{item.serialPickerOpen ? tr('Скрыть', 'Yashirish') : tr('Уточнить S/N', 'S/N aniqlash')} <ChevronDown size={14} /></span>
                    </button>
                    {item.serialPickerOpen && (
                      <div className="serial-picker">
                        <p>{tr('Отметьте только те номера, которые точно поедут на мероприятие.', 'Tadbirga aniq olib boriladigan raqamlarni belgilang.')}</p>
                        <div>{item.group.serializedItems.map((equipmentItem) => {
                          const active = item.serialIds.includes(equipmentItem.id)
                          return <button className={active ? 'active' : ''} onClick={() => toggleSerial(item.group.key, equipmentItem.id)} key={equipmentItem.id} type="button"><span>{active && <Check size={13} />}</span>{equipmentItem.serialnumber || tr('Без номера', 'Raqamsiz')}</button>
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

function CatalogPreviewDrawer({ group, onClose, onAdd }: { group: CatalogGroup; onClose: () => void; onAdd: () => void }) {
  const { tr, language } = useLanguage()
  useModalLayer(onClose)
  const representative = group.allItems[0]
  const hasSerialized = group.allItems.some((item) => item.tracking_mode === 'serialized')
  const hasQuantity = group.allItems.some((item) => item.tracking_mode === 'quantity')
  const tracking = hasSerialized && hasQuantity
    ? tr('Смешанный учёт', 'Aralash hisob')
    : hasSerialized ? tr('По серийным номерам', 'Seriya raqamlari bo‘yicha') : tr('По количеству', 'Miqdor bo‘yicha')

  return (
    <div className="drawer-layer" role="dialog" aria-modal="true" aria-label={tr('Описание модели', 'Model tavsifi')} onMouseDown={onClose}>
      <aside className="drawer catalog-preview-drawer" onMouseDown={(event) => event.stopPropagation()}>
        <div className="drawer__header">
          <div><p className="eyebrow">{translateEquipmentTaxonomy(group.type, language)}</p><h2>{group.brand} {group.model}</h2></div>
          <button autoFocus className="icon-button icon-button--bordered" onClick={onClose} aria-label={tr('Закрыть', 'Yopish')}><X size={19} /></button>
        </div>
        <span className={`badge badge--${group.availableCount > 0 ? 'success' : 'neutral'}`}><i />{group.availableCount > 0 ? tr(`На складе: ${group.availableCount}`, `Omborda: ${group.availableCount}`) : tr('Сейчас нет на складе', 'Hozir omborda yo‘q')}</span>
        <EquipmentVisual item={group} size="large" alt={`${group.brand} ${group.model}`} />
        <dl className="detail-list">
          <div><dt>{tr('Категория', 'Toifa')}</dt><dd>{translateEquipmentTaxonomy(group.type, language)}</dd></div>
          <div><dt>{tr('Подкатегория', 'Quyi toifa')}</dt><dd>{translateEquipmentTaxonomy(group.subtype, language)}</dd></div>
          <div><dt>{tr('Способ учёта', 'Hisob turi')}</dt><dd>{tracking}</dd></div>
          <div><dt>{tr('Всего заведено', 'Jami kiritilgan')}</dt><dd>{group.totalCount} {tr('шт.', 'dona')}</dd></div>
          <div className="detail-list__wide"><dt>{tr('Характеристики', 'Xususiyatlar')}</dt><dd>{representative?.technicalspecification || tr('Не указаны', 'Ko‘rsatilmagan')}</dd></div>
          <div className="detail-list__wide"><dt>{tr('Описание', 'Tavsif')}</dt><dd>{representative?.description || tr('Описание пока не заполнено', 'Tavsif hali kiritilmagan')}</dd></div>
        </dl>
        {group.availableCount === 0 && <p className="availability-warning"><Info size={15} />{tr('Модель можно добавить в документ: нехватка будет отмечена предупреждением.', 'Modelni hujjatga qo‘shish mumkin: yetishmovchilik ogohlantirish bilan ko‘rsatiladi.')}</p>}
        <button className="button button--primary catalog-preview-drawer__add" onClick={onAdd}><Plus size={17} /> {tr('Добавить в список', 'Ro‘yxatga qo‘shish')}</button>
      </aside>
    </div>
  )
}
