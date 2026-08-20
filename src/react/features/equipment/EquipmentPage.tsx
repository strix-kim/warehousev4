import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  PackageOpen,
  Pencil,
  Plus,
  Save,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppSelect } from '../../components/AppSelect'
import { EquipmentVisual, preloadEquipmentImages } from '../../components/EquipmentVisual'
import {
  countEquipmentModelUnits,
  fetchEquipment,
  fetchEquipmentMovements,
  MOBILE_EQUIPMENT_PAGE_SIZE,
  preferredEquipmentPageSize,
  readCachedEquipment,
  readCachedEquipmentMovements,
  updateEquipmentModelAndUnit,
  type EquipmentMovement,
} from './api'
import { equipmentAvailabilityOptions, equipmentAvailabilityView } from './availability'
import type { Equipment } from './types'
import { MOBILE_MEDIA_QUERY } from '../../lib/breakpoints'
import { translateEquipmentTaxonomy } from '../../lib/equipmentTaxonomy'
import { useLanguage } from '../../lib/i18n'
import { useModalLayer } from '../../lib/useModalLayer'

function equipmentCode(id: string) {
  return `EQ-${id.slice(0, 6).toUpperCase()}`
}

function equipmentIdentifier(item: Equipment, tr: (ru: string, uz: string) => string) {
  if (item.tracking_mode === 'quantity') return item.inventory_code || tr('Без серийного номера', 'Seriya raqamisiz')
  return item.serialnumber || tr('Без серийного номера', 'Seriya raqamisiz')
}

// Черновик формы в drawer'е: одним объектом, чтобы сброс к записи был одной
// операцией, а не десятью setState в двух местах.
type EquipmentEditDraft = {
  brand: string
  model: string
  type: string
  subtype: string
  specification: string
  length: string
  description: string
  availability: string
  location: string
  count: number
}

function toEditDraft(item: Equipment): EquipmentEditDraft {
  return {
    brand: item.brand,
    model: item.model,
    type: item.type,
    subtype: item.subtype,
    specification: item.technicalspecification ?? '',
    // 'N/A' — способ базы сказать «длина не применима»; в поле это пусто.
    length: item.lengthinmeters === 'N/A' ? '' : item.lengthinmeters ?? '',
    description: item.description ?? '',
    availability: item.availability,
    location: item.location,
    count: item.count,
  }
}

export function EquipmentPage() {
  const navigate = useNavigate()
  const { tr, locale, language } = useLanguage()
  const availabilityOptions = [
    { value: '', label: tr('Все статусы', 'Barcha holatlar') },
    ...equipmentAvailabilityOptions(tr),
  ]
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(preferredEquipmentPageSize)
  const [initialResult] = useState(() => readCachedEquipment({ page: 1, search: '', availability: '', pageSize }))
  const [rows, setRows] = useState<Equipment[]>(() => initialResult?.rows ?? [])
  const [total, setTotal] = useState(() => initialResult?.total ?? 0)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [availability, setAvailability] = useState('')
  const [selected, setSelected] = useState<Equipment | null>(null)
  const [isLoading, setIsLoading] = useState(() => !initialResult)
  // Только флаг: текст ошибки собирается на рендере. Строка в стейте потянула бы
  // tr в зависимости эффекта загрузки, и смена языка перезагружала бы каталог.
  const [hasLoadError, setHasLoadError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  // Номер страницы зажимается на рендере: каталог мог сократиться (удалили
  // позиции, сузился фильтр), и page остался за пределами — без зажима выходила
  // «Страница 3 из 1» с пустой таблицей. Зажатое значение и рисуется, и грузится.
  const currentPage = Math.min(page, pageCount)

  useEffect(() => {
    const media = window.matchMedia(MOBILE_MEDIA_QUERY)
    const handleChange = () => {
      setPageSize(preferredEquipmentPageSize())
      setPage(1)
    }
    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 350)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    let isCurrent = true
    const cached = readCachedEquipment({ page: currentPage, search, availability, pageSize })
    if (cached) {
      setRows(cached.rows)
      setTotal(cached.total)
      preloadEquipmentImages(cached.rows, pageSize <= MOBILE_EQUIPMENT_PAGE_SIZE ? pageSize : 24)
    }
    setIsLoading(!cached)
    setHasLoadError(false)

    fetchEquipment({ page: currentPage, search, availability, pageSize, bypassCache: reloadKey > 0 || Boolean(cached) })
      .then((result) => {
        if (!isCurrent) return
        setRows(result.rows)
        setTotal(result.total)
        preloadEquipmentImages(result.rows, pageSize <= MOBILE_EQUIPMENT_PAGE_SIZE ? pageSize : 24)
        const nextPage = currentPage + 1
        if (nextPage <= Math.ceil(result.total / pageSize)) {
          void fetchEquipment({ page: nextPage, search, availability, pageSize })
            .then((nextResult) => preloadEquipmentImages(nextResult.rows, pageSize <= MOBILE_EQUIPMENT_PAGE_SIZE ? pageSize : 16))
            .catch(() => undefined)
        }
      })
      .catch(() => {
        if (isCurrent && !cached) setHasLoadError(true)
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false)
      })

    return () => {
      isCurrent = false
    }
  }, [availability, currentPage, pageSize, reloadKey, search])

  const range = useMemo(() => {
    if (!total) return '0'
    const from = (currentPage - 1) * pageSize + 1
    const to = Math.min(currentPage * pageSize, total)
    return `${from}–${to}`
  }, [currentPage, pageSize, total])

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">{tr('Складской учёт', 'Ombor hisobi')}</p>
          <h1>{tr('Оборудование', 'Uskunalar')}</h1>
          <p className="page-description">{tr('Единый каталог техники, комплектующих и расходных материалов.', 'Texnika, butlovchi qismlar va sarf materiallarining yagona katalogi.')}</p>
        </div>
        <button className="button button--primary" onClick={() => navigate('/equipment/new')}>
          <Plus size={18} /> {tr('Добавить оборудование', 'Uskuna qo‘shish')}
        </button>
      </header>

      <section className="metric-strip" aria-label={tr('Сводка каталога', 'Katalog xulosasi')}>
        <div className="metric">
          <span className="metric__label">{tr('Позиций в базе', 'Bazadagi pozitsiyalar')}</span>
          <strong>{total.toLocaleString(locale)}</strong>
        </div>
        <div className="metric metric--context">
          <span className="status-dot status-dot--success" />
          <span>{tr('Подключены реальные данные Supabase', 'Supabase haqiqiy ma’lumotlari ulangan')}</span>
        </div>
        <div className="metric metric--notice">
          <CircleAlert size={17} />
          <span>{tr('Общие данные модели и состояние каждой единицы можно редактировать отдельно', 'Modelning umumiy ma’lumotlari va har bir birlik holatini alohida tahrirlash mumkin')}</span>
        </div>
      </section>

      <section className="data-panel">
        <div className="toolbar">
          <label className="search-field">
            <Search size={18} />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={tr('Модель, бренд, серийный номер…', 'Model, brend, seriya raqami…')}
              aria-label={tr('Поиск оборудования', 'Uskunalarni qidirish')}
            />
            {searchInput && (
              <button className="icon-button" onClick={() => setSearchInput('')} aria-label={tr('Очистить поиск', 'Qidiruvni tozalash')}>
                <X size={16} />
              </button>
            )}
          </label>
          <AppSelect
            value={availability}
            options={availabilityOptions}
            icon={<SlidersHorizontal size={17} />}
            onChange={(value) => {
                setAvailability(value)
                setPage(1)
            }}
            ariaLabel={tr('Фильтр по статусу', 'Holat bo‘yicha filtr')}
          />
        </div>

        {hasLoadError ? (
          <div className="state-block state-block--error">
            <CircleAlert size={24} />
            <strong>{tr('Ошибка загрузки', 'Yuklash xatosi')}</strong>
            <span>{tr('Не удалось загрузить оборудование. Повторите попытку.', 'Uskunalarni yuklab bo‘lmadi. Qayta urinib ko‘ring.')}</span>
            <button className="button button--secondary" onClick={() => setReloadKey((value) => value + 1)}>{tr('Повторить', 'Qayta urinish')}</button>
          </div>
        ) : (
          <div className={`table-scroll ${isLoading && rows.length ? 'table-scroll--refreshing' : ''}`} aria-busy={isLoading}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{tr('Оборудование', 'Uskuna')}</th>
                  <th>{tr('Категория', 'Toifa')}</th>
                  <th>{tr('Номер / учёт', 'Raqam / hisob')}</th>
                  <th>{tr('Кол-во', 'Soni')}</th>
                  <th>{tr('Статус', 'Holat')}</th>
                  <th>{tr('Локация', 'Joylashuv')}</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && rows.length === 0
                  ? Array.from({ length: 8 }, (_, index) => (
                      <tr key={index} className="skeleton-row">
                        <td colSpan={6}><span /></td>
                      </tr>
                    ))
                  : rows.map((item) => {
                      const status = equipmentAvailabilityView(item.availability, tr)
                      return (
                        <tr
                          key={item.id}
                          onClick={() => setSelected(item)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              setSelected(item)
                            }
                          }}
                          tabIndex={0}
                        >
                          <td>
                            <div className="equipment-cell">
                              <EquipmentVisual item={item} />
                              <span>
                                <strong>{item.brand} {item.model}</strong>
                                <small>{equipmentCode(item.id)} · {translateEquipmentTaxonomy(item.subtype, language)}</small>
                              </span>
                            </div>
                          </td>
                          <td data-label={tr('Категория', 'Toifa')}>{translateEquipmentTaxonomy(item.type, language)}</td>
                          <td data-label={item.tracking_mode === 'quantity' ? tr('Количественный учёт', 'Miqdor bo‘yicha hisob') : tr('Серийный номер', 'Seriya raqami')} className="mono">{equipmentIdentifier(item, tr)}</td>
                          <td data-label={tr('Количество', 'Miqdor')}><strong>{item.count}</strong> {tr('шт.', 'dona')}</td>
                          <td data-label={tr('Статус', 'Holat')}><span className={`badge badge--${status.tone}`}><i />{status.label}</span></td>
                          <td data-label={tr('Локация', 'Joylashuv')}>{item.location || '—'}</td>
                        </tr>
                      )
                    })}
              </tbody>
            </table>

            {!isLoading && !rows.length && (
              <div className="state-block">
                <PackageOpen size={27} />
                <strong>{tr('Ничего не найдено', 'Hech narsa topilmadi')}</strong>
                <span>{tr('Измените запрос или сбросьте фильтры.', 'So‘rovni o‘zgartiring yoki filtrlarni tozalang.')}</span>
              </div>
            )}
          </div>
        )}

        <footer className="pagination">
          <span>{tr('Показано', 'Ko‘rsatildi')} {range} {tr('из', 'dan')} {total.toLocaleString(locale)}</span>
          <div className="pagination__controls">
            <button className="icon-button icon-button--bordered" disabled={currentPage <= 1 || isLoading} onClick={() => setPage(currentPage - 1)} aria-label={tr('Предыдущая страница', 'Oldingi sahifa')}>
              <ChevronLeft size={18} />
            </button>
            <span>{tr('Страница', 'Sahifa')} <strong>{currentPage}</strong> {tr('из', 'dan')} {pageCount}</span>
            <button className="icon-button icon-button--bordered" disabled={currentPage >= pageCount || isLoading} onClick={() => setPage(currentPage + 1)} aria-label={tr('Следующая страница', 'Keyingi sahifa')}>
              <ChevronRight size={18} />
            </button>
          </div>
        </footer>
      </section>

      {selected && (
        <EquipmentDrawer
          item={selected}
          onClose={() => setSelected(null)}
          onUpdated={(updated) => {
            setSelected(updated)
            setRows((current) => current.map((row) => row.id === updated.id ? updated : row))
            setReloadKey((value) => value + 1)
          }}
        />
      )}
    </>
  )
}

function EquipmentDrawer({ item, onClose, onUpdated }: { item: Equipment; onClose: () => void; onUpdated: (item: Equipment) => void }) {
  const { tr, locale, language } = useLanguage()
  useModalLayer(onClose)
  const status = equipmentAvailabilityView(item.availability, tr)
  const [movements, setMovements] = useState<EquipmentMovement[]>(() => readCachedEquipmentMovements(item.id) ?? [])
  // Флаг вместо текста: иначе tr попадает в зависимости эффекта и смена языка
  // перезапрашивает историю движения.
  const [hasHistoryError, setHasHistoryError] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [editSuccess, setEditSuccess] = useState('')
  const [modelUnitCount, setModelUnitCount] = useState(1)
  const [draft, setDraft] = useState(() => toEditDraft(item))
  const { brand, model, type, subtype, specification, length, description, availability, location, count } = draft
  const canSave = Boolean(brand.trim() && model.trim() && type.trim() && subtype.trim() && count >= 0)

  function changeDraft<K extends keyof EquipmentEditDraft>(field: K, value: EquipmentEditDraft[K]) {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  useEffect(() => {
    setDraft(toEditDraft(item))
  }, [item])

  useEffect(() => {
    let current = true
    countEquipmentModelUnits(item.brand, item.model)
      .then((value) => { if (current) setModelUnitCount(Math.max(1, value)) })
      .catch(() => { if (current) setModelUnitCount(1) })
    return () => { current = false }
  }, [item.brand, item.model])

  useEffect(() => {
    let current = true
    const cached = readCachedEquipmentMovements(item.id)
    if (cached) {
      setMovements(cached)
      setHasHistoryError(false)
    } else {
      setMovements([])
    }
    fetchEquipmentMovements(item.id, { bypassCache: Boolean(cached) })
      .then((data) => {
        if (!current) return
        setMovements(data)
        setHasHistoryError(false)
      })
      .catch(() => {
        if (current && !cached) setHasHistoryError(true)
      })
    return () => { current = false }
  }, [item.id])

  function cancelEditing() {
    setDraft(toEditDraft(item))
    setEditError('')
    setIsEditing(false)
  }

  async function saveChanges() {
    if (!canSave) return
    // Локация в базе NOT NULL: пустое поле называем сами, иначе пользователь получит безымянный отказ RPC.
    if (!location.trim()) {
      setEditError(tr('Укажите локацию — без неё сохранить нельзя.', 'Joylashuvni ko‘rsating — usiz saqlab bo‘lmaydi.'))
      return
    }
    setIsSaving(true)
    setEditError('')
    setEditSuccess('')
    try {
      const { item: updated, updatedModelUnits } = await updateEquipmentModelAndUnit({
        id: item.id,
        brand,
        model,
        type,
        subtype,
        technicalspecification: specification,
        lengthinmeters: length,
        description,
        availability,
        location,
        count: item.tracking_mode === 'serialized' ? 1 : count,
      })
      onUpdated(updated)
      setIsEditing(false)
      setEditSuccess(updatedModelUnits === null
        ? tr('Изменения сохранены.', 'O‘zgarishlar saqlandi.')
        : tr(
          `Изменения сохранены. Данные модели обновлены у ${updatedModelUnits} единиц.`,
          `O‘zgarishlar saqlandi. Model ma’lumotlari ${updatedModelUnits} ta birlikda yangilandi.`,
        ))
    } catch {
      setEditError(tr('Не удалось сохранить изменения. Данные не изменены.', 'O‘zgarishlarni saqlab bo‘lmadi. Ma’lumotlar o‘zgarmadi.'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="drawer-layer" role="dialog" aria-modal="true" aria-label={tr('Карточка оборудования', 'Uskuna kartasi')} onMouseDown={onClose}>
      <aside className="drawer" onMouseDown={(event) => event.stopPropagation()}>
        <div className="drawer__header">
          <div>
            <p className="eyebrow">{equipmentCode(item.id)}</p>
            <h2>{item.brand} {item.model}</h2>
          </div>
          <div className="drawer__header-actions">
            {!isEditing && <button className="button button--secondary" onClick={() => { setIsEditing(true); setEditSuccess('') }}><Pencil size={16} /> {tr('Редактировать', 'Tahrirlash')}</button>}
            <button autoFocus className="icon-button icon-button--bordered" onClick={onClose} aria-label={tr('Закрыть', 'Yopish')}><X size={19} /></button>
          </div>
        </div>
        <span className={`badge badge--${status.tone}`}><i />{status.label}</span>
        <EquipmentVisual item={isEditing ? { brand, model, type, subtype } : item} size="large" alt={`${brand} ${model}`} />
        {editSuccess && <p className="form-success"><Save size={15} /> {editSuccess}</p>}
        {isEditing ? (
          <div className="equipment-edit-panel">
            <section className="equipment-edit-section">
              <div className="equipment-edit-section__heading">
                <div><h3>{tr('Данные модели', 'Model ma’lumotlari')}</h3><p>{tr('Изменятся у всех экземпляров с тем же брендом и моделью.', 'Xuddi shu brend va modeldagi barcha nusxalarda o‘zgaradi.')}</p></div>
                <span className="read-only-label">{modelUnitCount} {tr('единиц', 'birlik')}</span>
              </div>
              <div className="equipment-edit-grid">
                <label className="field"><span>{tr('Бренд', 'Brend')} *</span><input value={brand} onChange={(event) => changeDraft('brand', event.target.value)} /></label>
                <label className="field"><span>{tr('Модель', 'Model')} *</span><input value={model} onChange={(event) => changeDraft('model', event.target.value)} /></label>
                <label className="field"><span>{tr('Категория', 'Toifa')} *</span><input value={type} onChange={(event) => changeDraft('type', event.target.value)} /></label>
                <label className="field"><span>{tr('Подкатегория', 'Quyi toifa')} *</span><input value={subtype} onChange={(event) => changeDraft('subtype', event.target.value)} /></label>
                <label className="field"><span>{tr('Длина, м', 'Uzunlik, m')}</span><input value={length} onChange={(event) => changeDraft('length', event.target.value)} placeholder={tr('Только если применимо', 'Faqat tegishli bo‘lsa')} /></label>
                <label className="field field--wide"><span>{tr('Технические характеристики', 'Texnik xususiyatlar')}</span><textarea value={specification} onChange={(event) => changeDraft('specification', event.target.value)} rows={3} /></label>
                <label className="field field--wide"><span>{tr('Описание', 'Tavsif')}</span><textarea value={description} onChange={(event) => changeDraft('description', event.target.value)} rows={3} /></label>
              </div>
            </section>
            <section className="equipment-edit-section">
              <div className="equipment-edit-section__heading">
                <div><h3>{tr('Конкретная единица', 'Muayyan birlik')}</h3><p>{tr('Статус и локация изменятся только у этой записи. Серийный номер останется прежним.', 'Holat va joylashuv faqat shu yozuvda o‘zgaradi. Seriya raqami o‘zgarmaydi.')}</p></div>
              </div>
              <div className="equipment-edit-grid">
                <div className="field"><span>{tr('Статус', 'Holat')}</span><AppSelect value={availability} onChange={(value) => changeDraft('availability', value)} ariaLabel={tr('Статус оборудования', 'Uskuna holati')} options={equipmentAvailabilityOptions(tr)} /></div>
                <label className="field"><span>{tr('Локация', 'Joylashuv')} *</span><input value={location} onChange={(event) => changeDraft('location', event.target.value)} required /></label>
                <label className="field"><span>{item.tracking_mode === 'quantity' ? tr('Внутренний код', 'Ichki kod') : tr('Серийный номер', 'Seriya raqami')}</span><input value={equipmentIdentifier(item, tr)} readOnly /></label>
                <label className="field"><span>{tr('Количество', 'Miqdor')}</span><input type="number" min="0" max="9999" value={item.tracking_mode === 'serialized' ? 1 : count} onChange={(event) => changeDraft('count', Number(event.target.value))} disabled={item.tracking_mode === 'serialized'} /></label>
              </div>
            </section>
            {editError && <p className="form-error"><CircleAlert size={15} /> {editError}</p>}
            <div className="equipment-edit-actions">
              <button className="button button--secondary" type="button" onClick={cancelEditing} disabled={isSaving}>{tr('Отмена', 'Bekor qilish')}</button>
              <button className="button button--primary" type="button" onClick={() => void saveChanges()} disabled={!canSave || isSaving}><Save size={17} /> {isSaving ? tr('Сохраняем…', 'Saqlanmoqda…') : tr('Сохранить изменения', 'O‘zgarishlarni saqlash')}</button>
            </div>
          </div>
        ) : <><dl className="detail-list">
          <div><dt>{tr('Категория', 'Toifa')}</dt><dd>{translateEquipmentTaxonomy(item.type, language)}</dd></div>
          <div><dt>{tr('Подкатегория', 'Quyi toifa')}</dt><dd>{translateEquipmentTaxonomy(item.subtype, language)}</dd></div>
          <div><dt>{tr('Способ учёта', 'Hisob turi')}</dt><dd>{item.tracking_mode === 'quantity' ? tr('По количеству', 'Miqdor bo‘yicha') : tr('По серийному номеру', 'Seriya raqami bo‘yicha')}</dd></div>
          <div><dt>{item.tracking_mode === 'quantity' ? tr('Внутренний код', 'Ichki kod') : tr('Серийный номер', 'Seriya raqami')}</dt><dd className="mono">{equipmentIdentifier(item, tr)}</dd></div>
          <div><dt>{tr('Количество', 'Miqdor')}</dt><dd>{item.count} {tr('шт.', 'dona')}</dd></div>
          <div><dt>{tr('Локация', 'Joylashuv')}</dt><dd>{item.location || '—'}</dd></div>
          {item.lengthinmeters && item.lengthinmeters !== 'N/A' && <div><dt>{tr('Длина', 'Uzunlik')}</dt><dd>{item.lengthinmeters}</dd></div>}
          <div className="detail-list__wide"><dt>{tr('Характеристики', 'Xususiyatlar')}</dt><dd>{item.technicalspecification || tr('Не указаны', 'Ko‘rsatilmagan')}</dd></div>
          <div className="detail-list__wide"><dt>{tr('Описание', 'Tavsif')}</dt><dd>{item.description || tr('Нет описания', 'Tavsif yo‘q')}</dd></div>
        </dl>
        <section className="history-section">
          <div className="panel-heading"><div><h3>{tr('История движения', 'Harakat tarixi')}</h3><p>{tr('Количество, статус, выдачи и возвраты', 'Miqdor, holat, berish va qaytarish')}</p></div></div>
          <div className="timeline">
            {movements.map((movement) => (
              <div className="timeline__item" key={movement.id}>
                <i />
                <div>
                  <strong>{movementLabel(movement, tr)}</strong>
                  <span>{new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(movement.changed_at))}</span>
                  {(movement.quantity_before !== movement.quantity_after) && <p>{movement.quantity_before ?? '—'} → {movement.quantity_after ?? '—'} {tr('шт.', 'dona')} ({movement.quantity_delta > 0 ? '+' : ''}{movement.quantity_delta})</p>}
                  {movement.note && <p>{movement.note}</p>}
                </div>
              </div>
            ))}
            {!hasHistoryError && movements.length === 0 && <p className="muted">{tr('История пока пуста. После подключения журнала здесь появятся изменения количества, выдачи и возвраты.', 'Tarix hozircha bo‘sh. Jurnal ulangach, bu yerda miqdor o‘zgarishi, berish va qaytarishlar ko‘rinadi.')}</p>}
            {hasHistoryError && <p className="form-error">{tr('История временно недоступна.', 'Tarix vaqtincha mavjud emas.')}</p>}
          </div>
        </section></>}
      </aside>
    </div>
  )
}

function movementLabel(movement: EquipmentMovement, tr: (ru: string, uz: string) => string) {
  switch (movement.movement_type) {
    case 'created': return tr('Добавлено на склад', 'Omborga qo‘shildi')
    case 'issued': return tr('Выдано по списку', 'Ro‘yxat bo‘yicha berildi')
    case 'returned': return tr('Возвращено на склад', 'Omborga qaytarildi')
    case 'status_normalized': return tr('Старый статус нормализован', 'Eski holat me’yorlashtirildi')
    case 'quantity_changed': return tr('Изменено количество', 'Miqdor o‘zgartirildi')
    case 'status_changed': return tr('Изменён статус', 'Holat o‘zgartirildi')
    case 'quantity_and_status_changed': return tr('Изменены количество и статус', 'Miqdor va holat o‘zgartirildi')
  }
}
