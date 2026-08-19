import {
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  FileSpreadsheet,
  FileCheck2,
  ListChecks,
  PackageCheck,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  TriangleAlert,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppSelect } from '../../components/AppSelect'
import { useModalLayer } from '../../lib/useModalLayer'
import { fetchEquipmentByIds } from '../equipment/api'
import {
  fetchEquipmentLists,
  fetchReservationHistory,
  fetchReservationShortages,
  readCachedEquipmentLists,
  transitionEquipmentList,
  type EquipmentList,
  type ReservationHistory,
  type ReservationShortage,
  type ReservationStatus,
} from './api'
import { useLanguage } from '../../lib/i18n'
import { downloadEquipmentListXlsx, type ExportListRow } from './xlsxExport'

type Tr = (ru: string, uz: string) => string

function getStatusView(tr: Tr): Record<ReservationStatus, { label: string; tone: string }> {
  return {
    draft: { label: tr('Черновик', 'Qoralama'), tone: 'neutral' },
    confirmed: { label: tr('Подтверждён', 'Tasdiqlangan'), tone: 'warning' },
    issued: { label: tr('Выдан', 'Berilgan'), tone: 'danger' },
    returned: { label: tr('Возвращён', 'Qaytarilgan'), tone: 'success' },
  }
}

function getTransitionCopy(tr: Tr): Partial<Record<ReservationStatus, { target: ReservationStatus; label: string; description: string }>> {
  return {
    draft: { target: 'confirmed', label: tr('Подтвердить комплект', 'Jamlanmani tasdiqlash'), description: tr('Оборудование будет учтено за этим списком на выбранную дату. Нехватка останется предупреждением.', 'Uskunalar tanlangan sana uchun shu ro‘yxatga biriktiriladi. Yetishmovchilik ogohlantirish bo‘lib qoladi.') },
    confirmed: { target: 'issued', label: tr('Отметить выдачу', 'Berishni belgilash'), description: tr('Остаток на складе уменьшится, а серийные единицы будут отмечены как выданные.', 'Ombordagi qoldiq kamayadi, seriyali birliklar berilgan deb belgilanadi.') },
    issued: { target: 'returned', label: tr('Принять возврат', 'Qaytarishni qabul qilish'), description: tr('Количество вернётся на склад, серийные единицы снова станут доступными.', 'Miqdor omborga qaytadi, seriyali birliklar yana mavjud bo‘ladi.') },
  }
}

function preferredPageSize() {
  return window.matchMedia('(max-width: 820px)').matches ? 6 : 12
}

function listSize(list: EquipmentList) {
  const quantity = list.equipment_items?.reduce((sum, item) => sum + (Number(item.count) || 0), 0) ?? 0
  return list.list_mode === 'abstract'
    ? quantity
    : (list.equipment_ids?.length ?? 0) + quantity
}

function formatDate(value: string | null, locale: string, tr: Tr) {
  return value ? new Intl.DateTimeFormat(locale).format(new Date(`${value}T12:00:00`)) : tr('дата не указана', 'sana ko‘rsatilmagan')
}

export function ListsPage() {
  const navigate = useNavigate()
  const { tr, locale, language } = useLanguage()
  const statusView = getStatusView(tr)
  const [initialResult] = useState(readCachedEquipmentLists)
  const [rows, setRows] = useState<EquipmentList[]>(() => initialResult?.rows ?? [])
  const [total, setTotal] = useState(() => initialResult?.total ?? 0)
  const [isLoading, setIsLoading] = useState(() => !initialResult)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'all' | ReservationStatus>('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(preferredPageSize)
  const [selected, setSelected] = useState<EquipmentList | null>(null)
  const [exporting, setExporting] = useState<{ id: string; mode: 'working' | 'approval' } | null>(null)
  const [exportError, setExportError] = useState('')

  async function loadLists(bypassCache = false) {
    setIsLoading(true)
    setError('')
    try {
      const result = await fetchEquipmentLists({ bypassCache })
      setRows(result.rows)
      setTotal(result.total)
      if (selected) setSelected(result.rows.find((item) => item.id === selected.id) ?? null)
    } catch {
      setError(tr('Не удалось загрузить сохранённые списки.', 'Saqlangan ro‘yxatlarni yuklab bo‘lmadi.'))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const media = window.matchMedia('(max-width: 820px)')
    const handleChange = () => {
      setPageSize(preferredPageSize())
      setPage(1)
    }
    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [])

  useEffect(() => { void loadLists() }, [])

  const filteredRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('ru')
    return rows.filter((list) => {
      const matchesSearch = !query || `${list.name} ${list.description ?? ''}`.toLocaleLowerCase('ru').includes(query)
      return matchesSearch && (status === 'all' || list.reservation_status === status)
    })
  }, [rows, search, status])
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const visibleRows = filteredRows.slice((page - 1) * pageSize, page * pageSize)

  useEffect(() => setPage(1), [search, status])

  async function exportSavedList(list: EquipmentList, documentMode: 'working' | 'approval') {
    setExporting({ id: list.id, mode: documentMode })
    setExportError('')
    try {
      const serialized = await fetchEquipmentByIds(list.equipment_ids ?? [])
      const grouped = new Map<string, ExportListRow>()
      const addRow = (row: ExportListRow) => {
        const key = `${row.category}::${row.equipment}::${row.subtype}`.toLocaleLowerCase('ru')
        const current = grouped.get(key)
        if (current) {
          current.count += row.count
          current.serialNumbers.push(...row.serialNumbers)
        } else grouped.set(key, { ...row, serialNumbers: [...row.serialNumbers] })
      }
      for (const item of serialized) addRow({
        category: item.type,
        equipment: `${item.brand} ${item.model}`.trim(),
        subtype: item.subtype,
        count: 1,
        serialNumbers: item.serialnumber ? [item.serialnumber] : [],
      })
      for (const item of list.equipment_items ?? []) addRow({
        category: item.type,
        equipment: `${item.brand} ${item.model}`.trim(),
        subtype: item.subtype,
        count: item.count,
        serialNumbers: [],
      })
      downloadEquipmentListXlsx({
        name: list.name,
        clientName: list.client_name ?? '',
        venue: list.venue ?? '',
        description: list.description ?? '',
        eventDate: list.reservation_start,
        locale,
        language,
        documentMode,
        rows: [...grouped.values()],
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

      <section className="metric-strip">
        <div className="metric"><span className="metric__label">{tr('Всего списков', 'Jami ro‘yxatlar')}</span><strong>{total}</strong></div>
        <div className="metric metric--notice"><CircleAlert size={17} /><span>{tr('Excel скачивается без сохранения; нехватка остаётся предупреждением и не блокирует работу', 'Excel saqlamasdan yuklanadi; yetishmovchilik ogohlantirish bo‘lib qoladi va ishni to‘xtatmaydi')}</span></div>
      </section>

      <section className="data-panel">
        <div className="panel-heading">
          <div><h2>{tr('Сохранённые списки', 'Saqlangan ro‘yxatlar')}</h2><p>{tr('Необязательный архив: до 50 последних списков из базы.', 'Ixtiyoriy arxiv: bazadagi so‘nggi 50 tagacha ro‘yxat.')}</p></div>
          <span className="read-only-label">{tr('Расширенный учёт', 'Kengaytirilgan hisob')}</span>
        </div>

        <div className="toolbar">
          <label className="search-field">
            <Search size={18} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={tr('Название или описание…', 'Nomi yoki tavsifi…')} aria-label={tr('Поиск списков', 'Ro‘yxatlarni qidirish')} />
          </label>
          <AppSelect
            value={status}
            onChange={setStatus}
            icon={<SlidersHorizontal size={17} />}
            ariaLabel={tr('Статус списка', 'Ro‘yxat holati')}
            options={[
              { value: 'all', label: tr('Все этапы', 'Barcha bosqichlar') },
              { value: 'draft', label: tr('Черновики', 'Qoralamalar') },
              { value: 'confirmed', label: tr('Подтверждённые', 'Tasdiqlanganlar') },
              { value: 'issued', label: tr('Выданные', 'Berilganlar') },
              { value: 'returned', label: tr('Возвращённые', 'Qaytarilganlar') },
            ]}
          />
        </div>

        {exportError && <p className="form-error list-export-error"><CircleAlert size={14} /> {exportError}</p>}

        {error ? (
          <div className="state-block state-block--error"><CircleAlert size={25} /><strong>{tr('Ошибка загрузки', 'Yuklash xatosi')}</strong><span>{error}</span><button className="button button--secondary" onClick={() => void loadLists(true)}>{tr('Повторить', 'Qayta urinish')}</button></div>
        ) : (
          <div className="list-grid">
            {isLoading && rows.length === 0
              ? Array.from({ length: 6 }, (_, index) => <div className="list-card list-card--loading" key={index} />)
              : visibleRows.map((list) => {
                  const lifecycle = list.advanced_features ? statusView[list.reservation_status] : { label: tr('Сохранён', 'Saqlangan'), tone: 'neutral' }
                  const isExporting = exporting?.id === list.id
                  return (
                    <article className="list-card" key={list.id}>
                      <div className="list-card__top">
                        <span className="list-icon"><ListChecks size={20} /></span>
                        <span className={`badge badge--${lifecycle.tone}`}><i />{lifecycle.label}</span>
                      </div>
                      <div>
                        <p className="eyebrow">{list.list_mode === 'specific' ? tr('Фактический комплект', 'Haqiqiy jamlanma') : tr('План по моделям', 'Modellar bo‘yicha reja')}</p>
                        <h3>{list.name}</h3>
                        <p>{[list.client_name, list.venue, list.description].filter(Boolean).join(' · ') || tr('Без описания', 'Tavsifsiz')}</p>
                      </div>
                      <div className="reservation-window"><CalendarRange size={15} /><span>{formatDate(list.reservation_start, locale, tr)} — {formatDate(list.reservation_end, locale, tr)}</span></div>
                      <div className="list-card__meta">
                        <span><strong>{listSize(list)}</strong> {tr('единиц', 'birlik')}</span>
                        <span>{new Intl.DateTimeFormat(locale).format(new Date(list.created_at))}</span>
                      </div>
                      <div className="list-card__actions">
                        <button className="button button--secondary list-card__details" onClick={() => setSelected(list)}><Clock3 size={16} /> {tr('Открыть детали списка', 'Ro‘yxat tafsilotlarini ochish')}</button>
                        <button className="button button--secondary list-export-button" onClick={() => void exportSavedList(list, 'working')} disabled={isExporting || listSize(list) === 0} title={tr('Только список оборудования — для команды и работы', 'Faqat uskunalar ro‘yxati — jamoa va ish uchun')}><FileSpreadsheet size={17} />{isExporting && exporting?.mode === 'working' ? tr('Готовим…', 'Tayyorlanmoqda…') : tr('Рабочий Excel', 'Ishchi Excel')}</button>
                        <button className="button button--secondary list-export-button" onClick={() => void exportSavedList(list, 'approval')} disabled={isExporting || listSize(list) === 0} title={tr('Документ для заказчика: с реквизитами и подписями', 'Buyurtmachi uchun hujjat: rekvizitlar va imzolar bilan')}><FileCheck2 size={17} />{isExporting && exporting?.mode === 'approval' ? tr('Готовим…', 'Tayyorlanmoqda…') : tr('С реквизитами', 'Rekvizitlar bilan')}</button>
                      </div>
                    </article>
                  )
                })}
          </div>
        )}
        {!isLoading && !error && filteredRows.length === 0 && (
          total === 0 && !search && status === 'all' ? (
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
        {!isLoading && !error && filteredRows.length > 0 && (
          <footer className="pagination">
            <span>{tr('Показано', 'Ko‘rsatildi')} {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filteredRows.length)} {tr('из', 'dan')} {filteredRows.length}</span>
            <div className="pagination__controls">
              <button className="icon-button icon-button--bordered" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} aria-label={tr('Предыдущая страница списков', 'Ro‘yxatlarning oldingi sahifasi')}><ChevronLeft size={18} /></button>
              <span>{tr('Страница', 'Sahifa')} <strong>{page}</strong> {tr('из', 'dan')} {pageCount}</span>
              <button className="icon-button icon-button--bordered" disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)} aria-label={tr('Следующая страница списков', 'Ro‘yxatlarning keyingi sahifasi')}><ChevronRight size={18} /></button>
            </div>
          </footer>
        )}
      </section>

      {selected && <ReservationDrawer list={selected} onClose={() => setSelected(null)} onChanged={() => loadLists(true)} />}
    </>
  )
}

function ReservationDrawer({ list, onClose, onChanged }: { list: EquipmentList; onClose: () => void; onChanged: () => Promise<void> }) {
  const { tr, locale } = useLanguage()
  useModalLayer(onClose)
  const statusView = getStatusView(tr)
  const transitionCopy = getTransitionCopy(tr)
  const [shortages, setShortages] = useState<ReservationShortage[]>([])
  const [history, setHistory] = useState<ReservationHistory[]>([])
  const [note, setNote] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [error, setError] = useState('')
  const action = list.advanced_features ? transitionCopy[list.reservation_status] : undefined
  const lifecycle = statusView[list.reservation_status]
  const cannotIssuePlan = list.reservation_status === 'confirmed' && list.list_mode === 'abstract'
  const missingLegacyDates = list.reservation_status === 'draft' && (!list.reservation_start || !list.reservation_end)

  async function loadDetails() {
    if (!list.advanced_features) {
      setHistory([])
      setShortages([])
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    try {
      const [nextHistory, nextShortages] = await Promise.all([
        fetchReservationHistory(list.id),
        list.reservation_start && list.reservation_end ? fetchReservationShortages(list.id) : Promise.resolve([]),
      ])
      setHistory(nextHistory)
      setShortages(nextShortages)
    } catch {
      setError(tr('Не удалось загрузить проверку доступности или историю.', 'Mavjudlik tekshiruvi yoki tarixni yuklab bo‘lmadi.'))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { void loadDetails() }, [list.id, list.reservation_status, tr])

  async function runTransition() {
    if (!action || cannotIssuePlan || missingLegacyDates) return
    setIsTransitioning(true)
    setError('')
    try {
      await transitionEquipmentList(list.id, action.target, note)
      await onChanged()
    } catch (transitionError) {
      const message = transitionError instanceof Error ? transitionError.message : ''
      setError(message.includes('physically available') || message.includes('shortage')
        ? tr('Фактического оборудования уже недостаточно для выдачи. Резерв сохранён — скорректируйте комплект или остаток.', 'Berish uchun haqiqiy uskuna yetarli emas. Bandlov saqlandi — jamlanma yoki qoldiqni tuzating.')
        : tr('Не удалось изменить этап. Данные не были изменены.', 'Bosqichni o‘zgartirib bo‘lmadi. Ma’lumotlar o‘zgartirilmadi.'))
    } finally {
      setIsTransitioning(false)
    }
  }

  return (
    <div className="drawer-layer" role="dialog" aria-modal="true" aria-label={tr('Детали списка', 'Ro‘yxat tafsilotlari')} onMouseDown={onClose}>
      <aside className="drawer reservation-drawer" onMouseDown={(event) => event.stopPropagation()}>
        <div className="drawer__header">
          <div><p className="eyebrow">{tr('Детали списка', 'Ro‘yxat tafsilotlari')}</p><h2>{list.name}</h2><p className="drawer__lead">{tr('Состав, доступность и необязательный учёт выдачи', 'Tarkib, mavjudlik va ixtiyoriy berish hisobi')}</p></div>
          <button autoFocus className="icon-button icon-button--bordered" onClick={onClose} aria-label={tr('Закрыть', 'Yopish')}><X size={19} /></button>
        </div>
        <span className={`badge badge--${lifecycle.tone}`}><i />{lifecycle.label}</span>
        <div className="reservation-summary">
          <CalendarRange size={19} />
          <div><strong>{formatDate(list.reservation_start, locale, tr)} — {formatDate(list.reservation_end, locale, tr)}</strong><span>{list.list_mode === 'specific' ? tr('Фактический комплект', 'Haqiqiy jamlanma') : tr('План по моделям', 'Modellar bo‘yicha reja')} · {listSize(list)} {tr('единиц', 'birlik')}</span></div>
        </div>

        {list.advanced_features && (
          <div className="optional-tracking-note"><CircleAlert size={18} /><span><strong>{tr('Учёт выдачи — необязательно', 'Berish hisobi — ixtiyoriy')}</strong><small>{tr('Excel уже готов к работе. Меняйте статус ниже только если хотите учитывать подтверждение, выдачу и возврат оборудования в системе.', 'Excel ishlashga tayyor. Tizimda tasdiqlash, berish va qaytarishni hisobga olmoqchi bo‘lsangizgina quyidagi holatni o‘zgartiring.')}</small></span></div>
        )}

        {!list.advanced_features ? (
          <p className="availability-warning"><CircleAlert size={16} />{tr('Этот список сохранён как обычный документ. Учёт подтверждения, выдачи и возврата для него не включён.', 'Bu ro‘yxat oddiy hujjat sifatida saqlangan. Tasdiqlash, berish va qaytarish hisobi yoqilmagan.')}</p>
        ) : isLoading ? <div className="detail-skeleton" /> : shortages.length > 0 ? (
          <section className="shortage-panel">
            <div><TriangleAlert size={19} /><span><strong>{tr('Есть прогнозируемая нехватка', 'Kutilayotgan yetishmovchilik bor')}</strong><small>{tr('Список можно подтвердить. Перед выдачей потребуется фактическое наличие.', 'Ro‘yxatni tasdiqlash mumkin. Berishdan oldin haqiqiy mavjudlik talab qilinadi.')}</small></span></div>
            <ul>{shortages.map((item) => <li key={`${item.brand}-${item.model}-${item.type}-${item.subtype}`}><span>{item.brand} {item.model}</span><strong>−{item.shortage} {tr('шт.', 'dona')}</strong><small>{tr('нужно', 'kerak')} {item.requested}, {tr('доступно на даты', 'sanalarda mavjud')} {item.available}</small></li>)}</ul>
          </section>
        ) : (
          <div className="availability-ok"><PackageCheck size={18} /><span>{tr('По текущим данным комплект доступен на выбранные даты.', 'Joriy ma’lumotlarga ko‘ra jamlanma tanlangan sanalarda mavjud.')}</span></div>
        )}

        {missingLegacyDates && <div className="drawer__notice"><CircleAlert size={18} /><p><strong>{tr('Исторический список без дат', 'Sanasiz tarixiy ro‘yxat')}</strong><br />{tr('Он сохранён без выдуманного периода. Для нового резерва создайте новый список.', 'U taxminiy davrsiz saqlangan. Yangi bandlov uchun yangi ro‘yxat yarating.')}</p></div>}
        {cannotIssuePlan && <div className="drawer__notice"><CircleAlert size={18} /><p><strong>{tr('Сначала назначьте конкретные единицы', 'Avval aniq birliklarni belgilang')}</strong><br />{tr('План по моделям можно подтвердить, но выдавать допустимо только фактический комплект.', 'Modellar bo‘yicha rejani tasdiqlash mumkin, ammo faqat haqiqiy jamlanmani berish mumkin.')}</p></div>}

        {action && !missingLegacyDates && !cannotIssuePlan && (
          <section className="transition-panel">
            <div><strong>{action.label}</strong><p>{action.description}</p></div>
            <label className="field"><span>{tr('Комментарий к смене статуса (необязательно)', 'Holat o‘zgarishiga izoh (ixtiyoriy)')}</span><textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} placeholder={tr('Например: выдал Алексей, комплект проверен', 'Masalan: Aleksey berdi, jamlanma tekshirildi')} /></label>
            <button className="button button--primary button--wide" onClick={() => void runTransition()} disabled={isTransitioning}>
              {action.target === 'returned' ? <RotateCcw size={17} /> : <PackageCheck size={17} />}
              {isTransitioning ? tr('Обновляем…', 'Yangilanmoqda…') : action.label}
            </button>
          </section>
        )}
        {error && <p className="form-error"><CircleAlert size={15} /> {error}</p>}

        {list.advanced_features && <section className="history-section">
          <div className="panel-heading"><div><h3>{tr('История выдачи и возврата', 'Berish va qaytarish tarixi')}</h3><p>{tr('Здесь сохраняются только изменения статуса и комментарии сотрудников', 'Bu yerda faqat holat o‘zgarishlari va xodim izohlari saqlanadi')}</p></div></div>
          <div className="timeline">
            {history.map((entry) => (
              <div className="timeline__item" key={entry.id}>
                <i />
                <div><strong>{statusView[entry.to_status].label}</strong><span>{new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(entry.changed_at))}</span>{entry.note && <p>{entry.note}</p>}</div>
              </div>
            ))}
            {!isLoading && history.length === 0 && <p className="muted">{tr('История пока пуста.', 'Tarix hozircha bo‘sh.')}</p>}
          </div>
        </section>}
      </aside>
    </div>
  )
}
