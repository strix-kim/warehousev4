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
import { DataAge } from '../../components/DataAge'
import { EquipmentVisual, preloadEquipmentImages } from '../../components/EquipmentVisual'
import {
  emptyEquipmentTaxonomy,
  fetchEquipment,
  fetchEquipmentTaxonomy,
  MOBILE_EQUIPMENT_PAGE_SIZE,
  preferredEquipmentPageSize,
  readCachedEquipment,
  readCachedEquipmentMeta,
} from './api'
import { equipmentAvailabilityOptions, equipmentAvailabilityView, toEquipmentAvailability } from './availability'
import { EquipmentDrawer } from './EquipmentDrawer'
import { equipmentIdentifier } from './format'
import type { Equipment } from './types'
import { MOBILE_MEDIA_QUERY } from '../../lib/breakpoints'
import { translateEquipmentTaxonomy } from '../../lib/equipmentTaxonomy'
import { useLanguage } from '../../lib/i18n'
import { reportAppError } from '../../lib/reportAppError'

export function EquipmentPage() {
  const navigate = useNavigate()
  const { tr, locale, language } = useLanguage()
  const availabilityOptions = [
    { value: '', label: tr('Все статусы', 'Barcha holatlar') },
    ...equipmentAvailabilityOptions(tr),
  ]
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(preferredEquipmentPageSize)
  // Мобильная раскладка нужна не только стилям: на телефоне таблица становится
  // карточками, и ячейки-константы убираются ИЗ DOM, а не прячутся `display: none`
  // — спрятанный элемент остаётся в :last-child и nth-child и ломает чётность
  // грида. Граница та же, что у CSS-карточек (820, lib/breakpoints).
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_MEDIA_QUERY).matches)
  const [initialResult] = useState(() => readCachedEquipment({ page: 1, search: '', availability: '', pageSize }))
  const [rows, setRows] = useState<Equipment[]>(() => initialResult?.rows ?? [])
  const [total, setTotal] = useState(() => initialResult?.total ?? 0)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [availability, setAvailability] = useState('')
  const [type, setType] = useState('')
  const [subtype, setSubtype] = useState('')
  const [taxonomy, setTaxonomy] = useState(emptyEquipmentTaxonomy)
  const [selected, setSelected] = useState<Equipment | null>(null)
  const [isLoading, setIsLoading] = useState(() => !initialResult)
  // Только флаг: текст ошибки собирается на рендере. Строка в стейте потянула бы
  // tr в зависимости эффекта загрузки, и смена языка перезагружала бы каталог.
  const [hasLoadError, setHasLoadError] = useState(false)
  // Момент записи показанной страницы каталога. Ничего производного не храним:
  // значение принадлежит persistentCache, страница только перечитывает его.
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

  // Значения категорий — ДАННЫЕ из базы: в опции они уезжают как есть, а через
  // tr не проходят вовсе; на узбекском их переводит словарь таксономии.
  const typeOptions = [
    { value: '', label: tr('Все категории', 'Barcha toifalar') },
    ...taxonomy.types.map((value) => ({ value, label: translateEquipmentTaxonomy(value, language) })),
  ]
  // При выбранной категории список подкатегорий сужается до её собственных;
  // без категории предлагаются все, какие есть в каталоге.
  const subtypeOptions = [
    { value: '', label: tr('Все подкатегории', 'Barcha quyi toifalar') },
    ...(type ? taxonomy.subtypesByType[type] ?? [] : taxonomy.subtypes).map((value) => ({ value, label: translateEquipmentTaxonomy(value, language) })),
  ]
  // Фильтр и поиск считает база, поэтому total — счётчик ТЕКУЩЕЙ выборки:
  // без фильтров это весь каталог, с фильтрами — найденное.
  const isFiltered = Boolean(search || availability || type || subtype)
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  // Номер страницы зажимается на рендере: каталог мог сократиться (удалили
  // позиции, сузился фильтр), и page остался за пределами — без зажима выходила
  // «Страница 3 из 1» с пустой таблицей. Зажатое значение и рисуется, и грузится.
  const currentPage = Math.min(page, pageCount)

  useEffect(() => {
    const media = window.matchMedia(MOBILE_MEDIA_QUERY)
    const handleChange = () => {
      setIsMobile(media.matches)
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

  // Справочник категорий грузится один раз на заход: он живёт в кэше сутки и
  // прогревается в App.tsx вместе с данными редактора.
  useEffect(() => {
    fetchEquipmentTaxonomy()
      .then(setTaxonomy)
      .catch((error: unknown) => reportAppError(error, { scope: 'prefetch', route: '/equipment', detail: { source: 'taxonomy' } }))
  }, [])

  useEffect(() => {
    let isCurrent = true
    const cached = readCachedEquipment({ page: currentPage, search, availability, type, subtype, pageSize })
    // Возраст спрашиваем у кэша, а не считаем от момента ответа: запись обновляется
    // только на УСПЕШНОМ ответе, поэтому после сбоя сети здесь остаётся старая метка —
    // ровно то, что бейдж и должен показать.
    const readAge = () => readCachedEquipmentMeta({ page: currentPage, search, availability, type, subtype, pageSize })?.touchedAt ?? null
    // Метка ДО запроса. Отказ сети не всегда доходит до .catch: при живой записи
    // в кэше cachedQuery подменяет провал последним значением и промис
    // РЕЗОЛВИТСЯ. Единственный честный признак «ответа с сервера не было» —
    // несдвинувшаяся метка: кэш обновляет её только на успешном ответе.
    const ageBefore = readAge()
    if (cached) {
      setRows(cached.rows)
      setTotal(cached.total)
      preloadEquipmentImages(cached.rows, pageSize <= MOBILE_EQUIPMENT_PAGE_SIZE ? pageSize : 24)
    }
    setIsLoading(!cached)
    setIsFetching(true)
    setHasLoadError(false)
    // Возраст сбрасываем ДО запроса: при живой сети свежий ответ придёт через
    // мгновение, и бейдж успел бы мигнуть на пустом месте. Возраст ставится только
    // там, где исход запроса уже известен, — в .then и в .catch.
    setDataAt(null)

    fetchEquipment({ page: currentPage, search, availability, type, subtype, pageSize, bypassCache: reloadKey > 0 || Boolean(cached) })
      .then((result) => {
        if (!isCurrent) return
        setIsFetching(false)
        setRows(result.rows)
        setTotal(result.total)
        const freshAge = readAge()
        setLastFetchFailed(freshAge !== null && freshAge === ageBefore)
        setDataAt(freshAge)
        preloadEquipmentImages(result.rows, pageSize <= MOBILE_EQUIPMENT_PAGE_SIZE ? pageSize : 24)
        const nextPage = currentPage + 1
        if (nextPage <= Math.ceil(result.total / pageSize)) {
          void fetchEquipment({ page: nextPage, search, availability, type, subtype, pageSize })
            .then((nextResult) => preloadEquipmentImages(nextResult.rows, pageSize <= MOBILE_EQUIPMENT_PAGE_SIZE ? pageSize : 16))
            .catch((error: unknown) => reportAppError(error, { scope: 'prefetch', route: '/equipment', detail: { page: nextPage } }))
        }
      })
      .catch((error: unknown) => {
        // Отчёт — только для живого эффекта: отменённая загрузка (сменили фильтр,
        // ушли со страницы) не отказ приложения, и шуметь ею в канал незачем.
        if (!isCurrent) return
        setIsFetching(false)
        setLastFetchFailed(true)
        reportAppError(error, { scope: 'loader', route: '/equipment', detail: { servedFromCache: Boolean(cached) } })
        setDataAt(readAge())
        if (!cached) setHasLoadError(true)
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false)
      })

    return () => {
      isCurrent = false
    }
  }, [availability, currentPage, pageSize, reloadKey, search, subtype, type])

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

      <section className="data-panel">
        <div className="toolbar toolbar--catalog">
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
            value={type}
            options={typeOptions}
            onChange={(value) => {
              setType(value)
              // Подкатегория принадлежит категории: оставленная от прошлой
              // категории, она дала бы заведомо пустую выборку.
              setSubtype('')
              setPage(1)
            }}
            ariaLabel={tr('Фильтр по категории', 'Toifa bo‘yicha filtr')}
          />
          <AppSelect
            value={subtype}
            options={subtypeOptions}
            onChange={(value) => {
              setSubtype(value)
              setPage(1)
            }}
            ariaLabel={tr('Фильтр по подкатегории', 'Quyi toifa bo‘yicha filtr')}
          />
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
          <span className="toolbar__count">{isFiltered ? tr('Найдено', 'Topildi') : tr('Позиций в базе', 'Bazadagi pozitsiyalar')}: {total.toLocaleString(locale)}</span>
          {/* Рядом с блоком «Ошибка загрузки» бейдж не рисуем: на экране оказались бы
              два разных предложения обновиться и «Обновлено 25 минут назад» под
              заголовком о том, что данных нет. */}
          {!hasLoadError && <DataAge touchedAt={dataAt} isRefreshing={isFetching} failed={lastFetchFailed} onRefresh={() => setReloadKey((value) => value + 1)} />}
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
                </tr>
              </thead>
              <tbody>
                {isLoading && rows.length === 0
                  ? Array.from({ length: 8 }, (_, index) => (
                      <tr key={index} className="skeleton-row">
                        <td colSpan={5}><span /></td>
                      </tr>
                    ))
                  : rows.map((item) => {
                      const status = equipmentAvailabilityView(item.availability, tr)
                      // Ячейка, одинаковая почти у всех карточек подряд, на телефоне
                      // только съедает экран: количество равно 1 у 1 446 строк из
                      // 1 481, «На складе» — у 1 475. Отличающееся значение остаётся
                      // видимым — информация именно в нём. Статус сверяем
                      // нормализатором: в старых записях лежит русский текст.
                      const showCount = !isMobile || item.count !== 1
                      const showStatus = !isMobile || toEquipmentAvailability(item.availability) !== 'available'
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
                                {/* Код EQ-… ушёл: он не написан на технике и не ищется
                                    поиском. В карточке единицы он остаётся. */}
                                <small>{translateEquipmentTaxonomy(item.subtype, language)}</small>
                              </span>
                            </div>
                          </td>
                          <td data-label={tr('Категория', 'Toifa')}>{translateEquipmentTaxonomy(item.type, language)}</td>
                          <td data-label={item.tracking_mode === 'quantity' ? tr('Количественный учёт', 'Miqdor bo‘yicha hisob') : tr('Серийный номер', 'Seriya raqami')} className="mono">{equipmentIdentifier(item, tr)}</td>
                          {showCount && <td data-label={tr('Количество', 'Miqdor')}><strong>{item.count}</strong> {tr('шт.', 'dona')}</td>}
                          {showStatus && <td data-label={tr('Статус', 'Holat')}><span className={`badge badge--${status.tone}`}><i />{status.label}</span></td>}
                        </tr>
                      )
                    })}
              </tbody>
            </table>

            {!isLoading && !rows.length && (
              <div className="state-block">
                <PackageOpen size={27} />
                {/* Пустой ответ БЕЗ запроса и фильтров — это не «ничего не найдено»:
                    у сотрудника без строки в public.users каталог закрыт политикой
                    и приходит пустым. Почту администратора в бандл не кладём. */}
                <strong>{isFiltered ? tr('Ничего не найдено', 'Hech narsa topilmadi') : tr('Каталог пуст или недоступен', 'Katalog bo‘sh yoki mavjud emas')}</strong>
                <span>{isFiltered
                  ? tr('Измените запрос или сбросьте фильтры.', 'So‘rovni o‘zgartiring yoki filtrlarni tozalang.')
                  : tr('Если вы только что получили доступ, обратитесь к администратору склада.', 'Agar siz endigina ruxsat olgan bo‘lsangiz, ombor administratoriga murojaat qiling.')}</span>
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
