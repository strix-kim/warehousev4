import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  PackageOpen,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppSelect } from '../../components/AppSelect'
import { EquipmentVisual, preloadEquipmentImages } from '../../components/EquipmentVisual'
import {
  fetchEquipment,
  MOBILE_EQUIPMENT_PAGE_SIZE,
  preferredEquipmentPageSize,
  readCachedEquipment,
} from './api'
import { equipmentAvailabilityOptions, equipmentAvailabilityView } from './availability'
import { EquipmentDrawer } from './EquipmentDrawer'
import { equipmentCode, equipmentIdentifier } from './format'
import type { Equipment } from './types'
import { MOBILE_MEDIA_QUERY } from '../../lib/breakpoints'
import { translateEquipmentTaxonomy } from '../../lib/equipmentTaxonomy'
import { useLanguage } from '../../lib/i18n'

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
          onRefreshed={(fresh) => {
            // Перечитанная карточка обновляет только саму запись и её строку в
            // таблице: гонять весь каталог заново из-за открытия drawer'а незачем.
            setSelected(fresh)
            setRows((current) => current.map((row) => row.id === fresh.id ? fresh : row))
          }}
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
