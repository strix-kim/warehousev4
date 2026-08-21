import {
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Download,
  FileSpreadsheet,
  FileCheck2,
  PencilLine,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ActionMenu } from '../../components/ActionMenu'
import { AppSelect } from '../../components/AppSelect'
import { DataAge } from '../../components/DataAge'
import { MOBILE_MEDIA_QUERY } from '../../lib/breakpoints'
import { translateEquipmentTaxonomy } from '../../lib/equipmentTaxonomy'
import { formatEventDate, monthRange, parseDateValue } from '../../lib/date'
import { useModalLayer } from '../../lib/useModalLayer'
import {
  buildSavedListComposition,
  deleteEquipmentList,
  fetchEquipmentLists,
  LIST_DELETE_FORBIDDEN,
  prefetchSavedListDetails,
  preferredListsPageSize,
  readCachedEquipmentLists,
  readCachedEquipmentListsMeta,
  readCachedSavedListComposition,
  type EquipmentList,
  type SavedListComposition,
} from './api'
import { useLanguage } from '../../lib/i18n'
import { reportAppError } from '../../lib/reportAppError'
import { downloadEquipmentListXlsx } from './xlsxExport'

type Tr = (ru: string, uz: string) => string

// Причина отказа в деталях списка. Код, а не готовая строка: строка потянула бы
// tr в зависимости эффекта загрузки, и смена языка перезапрашивала бы состав,
// историю и дефицит.
type DrawerErrorCode = '' | 'composition' | 'delete' | 'delete-forbidden'

const emptyComposition: SavedListComposition = { rows: [], missingUnits: 0 }

function getDrawerErrorMessage(code: DrawerErrorCode, tr: Tr) {
  switch (code) {
    case 'composition': return tr(
      'Не удалось загрузить состав списка. Закройте детали и попробуйте открыть их ещё раз.',
      'Ro‘yxat tarkibini yuklab bo‘lmadi. Tafsilotlarni yoping va yana ochib ko‘ring.',
    )
    // Отказ права и сбой сети разведены: «попробуйте ещё раз» на отказе RLS отправляет
    // человека жать кнопку, которая не сработает ни разу.
    case 'delete-forbidden': return tr(
      'Удалять списки может только администратор склада — попросите его.',
      'Ro‘yxatlarni faqat ombor administratori o‘chira oladi — undan so‘rang.',
    )
    case 'delete': return tr('Не удалось удалить список. Попробуйте ещё раз.', 'Ro‘yxatni o‘chirib bo‘lmadi. Qayta urinib ko‘ring.')
    default: return ''
  }
}

// equipment_ids и equipment_items не пересекаются: RPC кладёт серийные позиции в первый
// массив, все остальные — во второй. Поэтому размер списка — их сумма при любом list_mode.
function listSize(list: EquipmentList) {
  const quantity = list.equipment_items?.reduce((sum, item) => sum + (Number(item.count) || 0), 0) ?? 0
  return (list.equipment_ids?.length ?? 0) + quantity
}

type ListsPeriod = 'all' | 'this-month' | 'last-month' | 'next-month'

// Границы считаются на КАЖДЫЙ рендер, а не один раз при монтировании: вкладка
// живёт на складе сутками, и «этот месяц», посчитанный первого числа в 23:59,
// иначе остался бы прошлым до перезагрузки.
function getPeriodRange(period: ListsPeriod) {
  switch (period) {
    case 'this-month': return monthRange(0)
    case 'last-month': return monthRange(-1)
    case 'next-month': return monthRange(1)
    default: return { from: '', to: '' }
  }
}

function formatDate(value: string | null, locale: string, tr: Tr) {
  return value ? new Intl.DateTimeFormat(locale).format(new Date(`${value}T12:00:00`)) : tr('дата не указана', 'sana ko‘rsatilmagan')
}

// Однодневное мероприятие — одна дата: «21.08.2026 — 21.08.2026» читается как ошибка
// интерфейса, а не как период в один день.
function formatEventRange(start: string | null, end: string | null, locale: string, tr: Tr) {
  if (start && start === end) return formatDate(start, locale, tr)
  return `${formatDate(start, locale, tr)} — ${formatDate(end, locale, tr)}`
}

// Дата мероприятия крупной строкой — первичный идентификатор карточки. Один день
// пишем словами («25 августа 2026»): так человек узнаёт свою работу, а не читает
// номер. Диапазон остаётся числами — «25 августа 2026 — 3 сентября 2026» в две
// строки заголовка не помещается и перестаёт читаться с одного взгляда.
function formatCardDate(start: string | null, end: string | null, locale: string, tr: Tr) {
  if (!start) return tr('Дата не указана', 'Sana ko‘rsatilmagan')
  if (start !== end) return formatEventRange(start, end, locale, tr)
  const parsed = parseDateValue(start)
  return parsed ? formatEventDate(parsed, locale) : formatDate(start, locale, tr)
}

export function ListsPage() {
  const navigate = useNavigate()
  const { tr, locale, language } = useLanguage()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(preferredListsPageSize)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [period, setPeriod] = useState<ListsPeriod>('all')
  const { from: periodFrom, to: periodTo } = getPeriodRange(period)
  const [initialResult] = useState(() => readCachedEquipmentLists({ page: 1, search: '', pageSize }))
  const [rows, setRows] = useState<EquipmentList[]>(() => initialResult?.rows ?? [])
  const [total, setTotal] = useState(() => initialResult?.total ?? 0)
  const [isLoading, setIsLoading] = useState(() => !initialResult)
  // Только флаг: текст ошибки собирается на рендере. Строка в стейте потянула бы
  // tr в зависимости эффекта загрузки, и смена языка перезапрашивала бы списки.
  const [hasLoadError, setHasLoadError] = useState(false)
  // Момент записи показанной страницы списков. Значение принадлежит
  // persistentCache — здесь только перечитывается, ничего производного не храним.
  const [dataAt, setDataAt] = useState<number | null>(null)
  // Отдельный флаг от isLoading: isLoading означает «показывать нечего, рисуем
  // скелет» и при живом кэше всегда false, а кнопке «Обновить» нужен признак
  // «запрос в полёте» — иначе офлайн она не отвечает на нажатие ничем.
  const [isFetching, setIsFetching] = useState(false)
  // Исход ПОСЛЕДНЕГО запроса: бейдж возраста обязан отличать «данные старые» от
  // «обновиться не удалось». Ставится в .then и в .catch, то есть только там,
  // где исход уже известен.
  const [lastFetchFailed, setLastFetchFailed] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [selected, setSelected] = useState<EquipmentList | null>(null)
  const [exporting, setExporting] = useState<{ id: string; mode: 'working' | 'approval' } | null>(null)
  const [exportError, setExportError] = useState('')

  // Поиск и фильтр теперь считает база, поэтому total — это счётчик ТЕКУЩЕЙ
  // выборки: без фильтров «всего», с фильтрами «найдено».
  const isFiltered = Boolean(search) || period !== 'all'
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  // Номер страницы зажимается на рендере: удалили единственный список второй
  // страницы — pageCount стал 1, а page остался 2, и панель показывала
  // «Страница 2 из 1» без единой карточки. Зажатое значение и рисуется, и грузится.
  const currentPage = Math.min(page, pageCount)
  const visibleListIds = rows.map((list) => list.id).join(':')

  useEffect(() => {
    const media = window.matchMedia(MOBILE_MEDIA_QUERY)
    const handleChange = () => {
      setPageSize(preferredListsPageSize())
      setPage(1)
    }
    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [])

  // Запрос уходит не на каждую букву: пауза 300 мс, и любая смена запроса
  // возвращает на первую страницу — иначе «страница 3» осталась бы за пределами
  // новой выборки.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      // Тримим здесь же: api всё равно обрежет строку перед ключом кэша, а
      // пробел, набранный в поле, иначе включал бы подпись «Найдено списков».
      setSearch(searchInput.trim())
      setPage(1)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  useEffect(() => setPage(1), [period])


  useEffect(() => {
    let isCurrent = true
    const cached = readCachedEquipmentLists({ page: currentPage, search, periodFrom, periodTo, pageSize })
    // Возраст спрашиваем у кэша, а не считаем от момента ответа: запись обновляется
    // только на УСПЕШНОМ ответе, поэтому после сбоя сети здесь остаётся старая метка —
    // ровно то, что бейдж и должен показать.
    const readAge = () => readCachedEquipmentListsMeta({ page: currentPage, search, periodFrom, periodTo, pageSize })?.touchedAt ?? null
    // Метка ДО запроса. Отказ сети не всегда доходит до .catch: при живой записи
    // в кэше cachedQuery подменяет провал последним значением и промис
    // РЕЗОЛВИТСЯ. Единственный честный признак «ответа с сервера не было» —
    // несдвинувшаяся метка: кэш обновляет её только на успешном ответе.
    const ageBefore = readAge()
    if (cached) {
      setRows(cached.rows)
      setTotal(cached.total)
    }
    setIsLoading(!cached)
    setIsFetching(true)
    setHasLoadError(false)
    // Возраст сбрасываем ДО запроса: при живой сети свежий ответ придёт через
    // мгновение, и бейдж успел бы мигнуть на пустом месте. Возраст ставится только
    // там, где исход запроса уже известен, — в .then и в .catch.
    setDataAt(null)

    fetchEquipmentLists({ page: currentPage, search, periodFrom, periodTo, pageSize, bypassCache: reloadKey > 0 || Boolean(cached) })
      .then((result) => {
        if (!isCurrent) return
        setIsFetching(false)
        setRows(result.rows)
        setTotal(result.total)
        const freshAge = readAge()
        setLastFetchFailed(freshAge !== null && freshAge === ageBefore)
        setDataAt(freshAge)
        // Открытые детали переезжают на свежую строку: правка и удаление
        // возвращаются сюда через reloadKey. Строка исчезла — дровер закрывается
        // сам, показывать состав удалённого списка нечестно.
        setSelected((current) => current ? result.rows.find((item) => item.id === current.id) ?? null : null)
      })
      .catch((error: unknown) => {
        // Отчёт — только для живого эффекта: отменённая загрузка (сменили фильтр,
        // ушли со страницы) не отказ приложения, и шуметь ею в канал незачем.
        if (!isCurrent) return
        setIsFetching(false)
        setLastFetchFailed(true)
        reportAppError(error, { scope: 'loader', route: '/lists', detail: { servedFromCache: Boolean(cached) } })
        setDataAt(readAge())
        if (!cached) setHasLoadError(true)
      })
      .finally(() => { if (isCurrent) setIsLoading(false) })

    return () => { isCurrent = false }
  }, [currentPage, pageSize, periodFrom, periodTo, reloadKey, search])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      rows.slice(0, 6).forEach((list) => { void prefetchSavedListDetails(list) })
    }, 500)
    return () => window.clearTimeout(timer)
  }, [visibleListIds])

  async function exportSavedList(list: EquipmentList, documentMode: 'working' | 'approval') {
    setExporting({ id: list.id, mode: documentMode })
    setExportError('')
    try {
      const composition = await buildSavedListComposition(list)
      downloadEquipmentListXlsx({
        name: list.name,
        clientName: list.client_name ?? '',
        venue: list.venue ?? '',
        description: list.description ?? '',
        eventDate: list.reservation_start,
        locale,
        language,
        documentMode,
        rows: composition.rows,
      })
    } catch {
      setExportError(tr('Не удалось подготовить Excel для сохранённого списка.', 'Saqlangan ro‘yxat uchun Excelni tayyorlab bo‘lmadi.'))
    } finally {
      setExporting(null)
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">{tr('Рабочие документы', 'Ish hujjatlari')}</p>
          <h1>{tr('Списки оборудования', 'Uskunalar ro‘yxatlari')}</h1>
          <p className="page-description">{tr('Быстро соберите список и скачайте Excel. Сохраняйте в системе только те списки, которые пригодятся позже.', 'Ro‘yxatni tez yig‘ing va Excelni yuklang. Tizimda faqat keyin kerak bo‘ladigan ro‘yxatlarni saqlang.')}</p>
        </div>
        <button className="button button--primary" onClick={() => navigate('/lists/new')}>
          <Plus size={18} /> {tr('Создать список', 'Ro‘yxat yaratish')}
        </button>
      </header>

      <section className="data-panel">
        <div className="toolbar">
          <label className="search-field">
            <Search size={18} />
            <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder={tr('Название, заказчик или площадка…', 'Nomi, buyurtmachi yoki maydon…')} aria-label={tr('Поиск списков по названию, заказчику и площадке', 'Ro‘yxatlarni nomi, buyurtmachisi va maydoni bo‘yicha qidirish')} />
          </label>
          <AppSelect
            value={period}
            onChange={setPeriod}
            icon={<CalendarRange size={17} />}
            ariaLabel={tr('Период мероприятия', 'Tadbir davri')}
            options={[
              { value: 'all', label: tr('Все даты', 'Barcha sanalar') },
              { value: 'this-month', label: tr('Этот месяц', 'Shu oy') },
              { value: 'last-month', label: tr('Прошлый месяц', 'O‘tgan oy') },
              { value: 'next-month', label: tr('Следующий месяц', 'Keyingi oy') },
            ]}
          />
          <span className="toolbar__count">{isFiltered ? tr('Найдено', 'Topildi') : tr('Всего', 'Jami')}: {total}</span>
          {/* Рядом с блоком «Ошибка загрузки» бейдж не рисуем: на экране оказались бы
              два разных предложения обновиться и «Обновлено 25 минут назад» под
              заголовком о том, что данных нет. */}
          {!hasLoadError && <DataAge touchedAt={dataAt} isRefreshing={isFetching} failed={lastFetchFailed} onRefresh={() => setReloadKey((current) => current + 1)} />}
        </div>

        {exportError && <p className="form-error list-export-error"><CircleAlert size={14} /> {exportError}</p>}

        {hasLoadError ? (
          <div className="state-block state-block--error"><CircleAlert size={25} /><strong>{tr('Ошибка загрузки', 'Yuklash xatosi')}</strong><span>{tr('Не удалось загрузить сохранённые списки.', 'Saqlangan ro‘yxatlarni yuklab bo‘lmadi.')}</span><button className="button button--secondary" onClick={() => setReloadKey((current) => current + 1)}>{tr('Повторить', 'Qayta urinish')}</button></div>
        ) : (
          <div className="list-grid">
            {isLoading && rows.length === 0
              ? Array.from({ length: 6 }, (_, index) => <div className="list-card list-card--loading" key={index} />)
              : rows.map((list) => {
                  const isExporting = exporting?.id === list.id
                  // created_at в схеме nullable; поведение прежнее: пустое значение даёт эпоху
                  const createdAt = new Intl.DateTimeFormat(locale).format(new Date(list.created_at ?? 0))
                  const isEmpty = listSize(list) === 0
                  return (
                    <article
                      className="list-card"
                      key={list.id}
                      onPointerEnter={() => { void prefetchSavedListDetails(list) }}
                      onFocusCapture={() => { void prefetchSavedListDetails(list) }}
                    >
                      <div className="list-card__top">
                        <div className="list-card__identity">
                          {/* Дата мероприятия и заказчик — то, чем человек помнит работу.
                              Название у всех дефолтное, поэтому оно ниже и мельче. */}
                          <p className="list-card__date">{formatCardDate(list.reservation_start, list.reservation_end, locale, tr)}</p>
                          <p className="list-card__client">{[list.client_name, list.venue].filter(Boolean).join(' · ') || tr('Заказчик не указан', 'Buyurtmachi ko‘rsatilmagan')}</p>
                        </div>
                      </div>
                      <div>
                        {/* Название — вторичная строка, и одновременно вход в детали:
                            его псевдоэлемент растянут на карточку, поэтому «клик куда
                            угодно» открывает состав документа. */}
                        <h3><button type="button" className="list-card__title" onClick={() => setSelected(list)}>{list.name}</button></h3>
                        {list.description && <p className="list-card__description">{list.description}</p>}
                      </div>
                      <div className="list-card__meta">
                        <span><strong>{listSize(list)}</strong> {tr('единиц', 'birlik')} · {list.list_mode === 'specific' ? tr('с серийными номерами', 'seriya raqamlari bilan') : tr('только модели', 'faqat modellar')}</span>
                        {/* Подпись обязательна: без неё две даты на карточке неразличимы */}
                        <span>{tr(`создан ${createdAt}`, `${createdAt} yaratilgan`)}</span>
                      </div>
                      <div className="list-card__actions">
                        <button className="button button--primary list-card__open" onClick={() => navigate(`/lists/${list.id}/edit`)}>
                          <PencilLine size={16} /> {tr('Изменить', 'O‘zgartirish')}
                        </button>
                        <ActionMenu
                          className="list-card__export"
                          label={isExporting ? tr('Готовим…', 'Tayyorlanmoqda…') : tr('Скачать', 'Yuklab olish')}
                          ariaLabel={tr('Скачать Excel по списку', 'Ro‘yxat bo‘yicha Excelni yuklab olish')}
                          icon={<Download size={16} />}
                          disabled={isExporting || isEmpty}
                          items={[
                            {
                              id: 'working',
                              label: tr('Рабочий список', 'Ishchi ro‘yxat'),
                              hint: tr('Для команды и склада', 'Jamoa va ombor uchun'),
                              icon: <FileSpreadsheet size={16} />,
                              onSelect: () => { void exportSavedList(list, 'working') },
                            },
                            {
                              id: 'approval',
                              label: tr('На согласование', 'Kelishuvga'),
                              hint: tr('С реквизитами и подписями', 'Rekvizitlar va imzolar bilan'),
                              icon: <FileCheck2 size={16} />,
                              onSelect: () => { void exportSavedList(list, 'approval') },
                            },
                          ]}
                        />
                      </div>
                    </article>
                  )
                })}
          </div>
        )}
        {!isLoading && !hasLoadError && rows.length === 0 && (
          total === 0 && !isFiltered ? (
            <div className="state-block state-block--illustrated state-block--roomy">
              <img src="/illustrations/equipment-kit.webp" alt="" aria-hidden="true" />
              <strong>{tr('Сохранённых списков пока нет', 'Saqlangan ro‘yxatlar hozircha yo‘q')}</strong>
              <span>{tr('Соберите первый комплект — его можно сохранить и сразу скачать в Excel.', 'Birinchi jamlanmani tuzing — uni saqlash va darhol Excelga yuklash mumkin.')}</span>
              <button className="button button--primary" onClick={() => navigate('/lists/new')}><Plus size={17} /> {tr('Создать список', 'Ro‘yxat yaratish')}</button>
            </div>
          ) : (
            <div className="state-block"><Search size={25} /><strong>{tr('Списки не найдены', 'Ro‘yxatlar topilmadi')}</strong><span>{tr('Измените запрос или фильтр.', 'So‘rov yoki filtrni o‘zgartiring.')}</span></div>
          )
        )}
        {!isLoading && !hasLoadError && rows.length > 0 && (
          <footer className="pagination">
            <span>{tr('Показано', 'Ko‘rsatildi')} {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, total)} {tr('из', 'dan')} {total}</span>
            <div className="pagination__controls">
              <button className="icon-button icon-button--bordered" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)} aria-label={tr('Предыдущая страница списков', 'Ro‘yxatlarning oldingi sahifasi')}><ChevronLeft size={18} /></button>
              <span>{tr('Страница', 'Sahifa')} <strong>{currentPage}</strong> {tr('из', 'dan')} {pageCount}</span>
              <button className="icon-button icon-button--bordered" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)} aria-label={tr('Следующая страница списков', 'Ro‘yxatlarning keyingi sahifasi')}><ChevronRight size={18} /></button>
            </div>
          </footer>
        )}
      </section>

      {selected && <ReservationDrawer list={selected} onClose={() => setSelected(null)} onChanged={() => setReloadKey((current) => current + 1)} />}
    </>
  )
}

function ReservationDrawer({ list, onClose, onChanged }: { list: EquipmentList; onClose: () => void; onChanged: () => void }) {
  const navigate = useNavigate()
  const { tr, locale, language } = useLanguage()
  useModalLayer(onClose)
  const [composition, setComposition] = useState<SavedListComposition>(() => readCachedSavedListComposition(list.id) ?? emptyComposition)
  const [isLoading, setIsLoading] = useState(() => readCachedSavedListComposition(list.id) === null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<DrawerErrorCode>('')
  const contacts = [list.client_name, list.venue].filter(Boolean).join(' · ')

  async function loadDetails() {
    const cached = readCachedSavedListComposition(list.id)
    if (cached !== null) setComposition(cached)
    setIsLoading(cached === null)
    setError('')
    try {
      setComposition(await buildSavedListComposition(list, { bypassCache: cached !== null }))
    } catch {
      if (cached === null) setComposition(emptyComposition)
      setError('composition')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { void loadDetails() }, [list.id])

  async function runDelete() {
    setIsDeleting(true)
    setError('')
    try {
      await deleteEquipmentList(list.id)
      onChanged()
      onClose()
    } catch (deleteError) {
      setError(deleteError instanceof Error && deleteError.message === LIST_DELETE_FORBIDDEN ? 'delete-forbidden' : 'delete')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="drawer-layer" role="dialog" aria-modal="true" aria-label={tr('Детали списка', 'Ro‘yxat tafsilotlari')} onMouseDown={onClose}>
      <aside className="drawer reservation-drawer" onMouseDown={(event) => event.stopPropagation()}>
        <div className="reservation-drawer__top">
          <div className="drawer__header">
            <div><p className="eyebrow">{tr('Детали списка', 'Ro‘yxat tafsilotlari')}</p><h2>{list.name}</h2><p className="drawer__lead">{tr('Состав списка и реквизиты документа', 'Ro‘yxat tarkibi va hujjat rekvizitlari')}</p></div>
            <button autoFocus className="icon-button icon-button--bordered" onClick={onClose} aria-label={tr('Закрыть', 'Yopish')}><X size={19} /></button>
          </div>
          <div className="reservation-summary">
            <CalendarRange size={19} />
            <div>
              <strong>{formatEventRange(list.reservation_start, list.reservation_end, locale, tr)}</strong>
              <span>{list.list_mode === 'specific' ? tr('С серийными номерами', 'Seriya raqamlari bilan') : tr('Только модели', 'Faqat modellar')} · {listSize(list)} {tr('единиц', 'birlik')}</span>
              {/* Реквизиты показываем только заполненные: у старых списков их нет, и пустая
                  строка-заглушка сообщала бы о них больше, чем их отсутствие */}
              {contacts && <span className="reservation-summary__meta">{contacts}</span>}
              {list.description && <span className="reservation-summary__meta">{list.description}</span>}
            </div>
          </div>
        </div>

        <div className="reservation-drawer__body">
          <section className="saved-list-contents">
            <div className="saved-list-contents__heading"><div><h3>{tr('Оборудование в списке', 'Ro‘yxatdagi uskunalar')}</h3><p>{tr('Полный сохранённый состав документа', 'Hujjatning to‘liq saqlangan tarkibi')}</p></div><strong>{listSize(list)}</strong></div>
            {/* Счётчик в шапке считает по equipment_ids, состав — по строкам склада.
                Расхождение объясняем прямо здесь, иначе «12 единиц» над 11 строками
                выглядит ошибкой интерфейса. */}
            {composition.missingUnits > 0 && (
              <p className="availability-warning"><CircleAlert size={16} />{tr(
                `${composition.missingUnits} единиц из состава не найдены на складе — возможно, удалены`,
                `Tarkibdagi ${composition.missingUnits} birlik omborda topilmadi — o‘chirilgan bo‘lishi mumkin`,
              )}</p>
            )}
            {isLoading ? <div className="detail-skeleton" /> : composition.rows.length > 0 ? (
              <div className="saved-list-items">{composition.rows.map((item, index) => (
                <div className="saved-list-item" key={`${item.category}-${item.equipment}-${item.subtype}`}>
                  <span className="equipment-row-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                  <span className="saved-list-item__copy"><strong>{item.equipment}</strong><small>{translateEquipmentTaxonomy(item.category, language)} · {translateEquipmentTaxonomy(item.subtype, language)}{item.serialNumbers.length > 0 ? ` · S/N ${item.serialNumbers.join(', ')}` : ''}</small></span>
                  <b className="saved-list-item__count">×{item.count}</b>
                </div>
              ))}</div>
            ) : <p className="muted">{tr('В этом списке нет оборудования.', 'Bu ro‘yxatda uskuna yo‘q.')}</p>}
          </section>
          {error && <p className="form-error"><CircleAlert size={15} /> {getDrawerErrorMessage(error, tr)}</p>}
        </div>

        <div className="reservation-drawer__footer">
          <button className="button button--primary button--wide saved-list-edit" onClick={() => navigate(`/lists/${list.id}/edit`)}><PencilLine size={17} />{tr('Открыть и изменить список', 'Ro‘yxatni ochish va o‘zgartirish')}</button>

          <section className={`saved-list-delete ${deleteConfirmOpen ? 'saved-list-delete--open' : ''}`}>
          {!deleteConfirmOpen ? (
            <button className="button button--danger-ghost button--wide" onClick={() => setDeleteConfirmOpen(true)}>
              <Trash2 size={17} />{tr('Удалить список', 'Ro‘yxatni o‘chirish')}
            </button>
          ) : (
            <>
              <div>
                <Trash2 size={19} />
                <span>
                  <strong>{tr('Удалить этот список?', 'Bu ro‘yxat o‘chirilsinmi?')}</strong>
                  <small>{tr('Список будет удалён без возможности восстановления.', 'Ro‘yxat qayta tiklash imkonisiz o‘chiriladi.')}</small>
                </span>
              </div>
              <div className="saved-list-delete__actions">
                <button className="button button--secondary" onClick={() => setDeleteConfirmOpen(false)} disabled={isDeleting}>{tr('Отмена', 'Bekor qilish')}</button>
                <button className="button button--danger" onClick={() => void runDelete()} disabled={isDeleting}>
                  <Trash2 size={16} />{isDeleting ? tr('Удаляем…', 'O‘chirilmoqda…') : tr('Да, удалить', 'Ha, o‘chirish')}
                </button>
              </div>
            </>
          )}
          </section>
        </div>
      </aside>
    </div>
  )
}
