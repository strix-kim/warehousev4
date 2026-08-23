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
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AppSelect } from '../../components/AppSelect'
import { DataAge } from '../../components/DataAge'
import { EquipmentVisual, preloadEquipmentImages } from '../../components/EquipmentVisual'
import {
  emptyEquipmentTaxonomy,
  fetchEquipment,
  fetchEquipmentByIds,
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
  // Состояние каталога живёт в АДРЕСЕ, а не в компоненте: заход в «Добавить
  // оборудование» и обратно размонтирует страницу, F5 обнуляет её же, а на телефоне
  // жест «назад» обязан закрывать карточку, а не выкидывать из раздела. Всё, что
  // человек выбрал руками, — параметр запроса.
  const [params, setParams] = useSearchParams()
  const search = params.get('q') ?? ''
  const type = params.get('type') ?? ''
  const subtype = params.get('subtype') ?? ''
  const availability = params.get('status') ?? ''
  const itemId = params.get('item') ?? ''
  const pageParam = Math.max(1, Number(params.get('page')) || 1)
  const [pageSize, setPageSize] = useState(preferredEquipmentPageSize)
  // Мобильная раскладка нужна не только стилям: на телефоне таблица становится
  // карточками, и ячейки-константы убираются ИЗ DOM, а не прячутся `display: none`
  // — спрятанный элемент остаётся в :last-child и nth-child и ломает чётность
  // грида. Граница та же, что у CSS-карточек (820, lib/breakpoints).
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_MEDIA_QUERY).matches)
  // Прогретый первый кадр берём только для НЕТРОНУТОГО каталога. Раньше фильтров в
  // адресе не было и брать было нечего иное; теперь ссылка `?q=…` рисовала бы кадр
  // из кэша БЕЗ фильтра — первый экран отвечал бы не на тот вопрос, который задан
  // в адресе. Под фильтром честнее скелет.
  const [initialResult] = useState(() => pageParam === 1 && !search && !availability && !type && !subtype
    ? readCachedEquipment({ page: 1, search: '', availability: '', pageSize })
    : null)
  const [rows, setRows] = useState<Equipment[]>(() => initialResult?.rows ?? [])
  const [total, setTotal] = useState(() => initialResult?.total ?? 0)
  // Поле ввода остаётся локальным: в адрес запрос уезжает через паузу, иначе
  // каждая буква оставляла бы запись в истории браузера.
  const [searchInput, setSearchInput] = useState(search)
  // Последнее значение, которое в адрес записали МЫ. Нужно, чтобы отличить свою
  // запись от чужой: на «назад» поле обязано догнать адрес, а на собственном
  // дебаунсе — не затереть буквы, набранные, пока запись летела.
  const pushedSearchRef = useRef(search)
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

  // Единственный вход для правки фильтров. Смена любого сбрасывает страницу:
  // «страница 5» осталась бы за пределами новой выборки. replace — для записей,
  // которые не должны копиться в истории (набор в поиске).
  function updateParams(patch: Record<string, string>, options: { replace?: boolean } = {}) {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    next.delete('page')
    setParams(next, { replace: options.replace ?? false })
  }

  // Страница правится отдельно от фильтров: на десктопе переход обычным push —
  // «назад» возвращает на предыдущую страницу; на телефоне «показать ещё» пишет
  // replace, иначе каждое нажатие оставляет шаг накопления в истории.
  function goToPage(next: number) {
    const nextParams = new URLSearchParams(params)
    if (next <= 1) nextParams.delete('page')
    else nextParams.set('page', String(next))
    setParams(nextParams, { replace: isMobile })
  }

  // Карточка — тоже адрес. Открытие пушит запись, поэтому жест «назад» на телефоне
  // закрывает её, а не уносит из каталога. Закрытие крестиком ЗАМЕНЯЕТ текущую
  // запись: без replace «назад» открыл бы карточку заново вместо возврата.
  function openItem(item: Equipment) {
    setSelected(item)
    const next = new URLSearchParams(params)
    next.set('item', item.id)
    setParams(next)
  }

  function closeItem() {
    setSelected(null)
    const next = new URLSearchParams(params)
    next.delete('item')
    setParams(next, { replace: true })
  }

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
  const currentPage = Math.min(pageParam, pageCount)
  // На телефоне постраничности нет: 186 страниц с двумя стрелками не дают
  // посмотреть «что у нас вообще есть». Там номер означает не «какую страницу
  // показываем», а «сколько накопили», и строки — ЧИСТАЯ функция от фильтров и
  // этого числа: страницы 1…N тянутся вместе и склеиваются. Инкрементальный
  // append дешевле на вид, но даёт двойную вставку в StrictMode и хвост от
  // прошлого фильтра, если тот сменился, пока запрос летел.
  const pagesToLoad = useMemo(
    () => isMobile ? Array.from({ length: currentPage }, (_, index) => index + 1) : [currentPage],
    [currentPage, isMobile],
  )

  useEffect(() => {
    const media = window.matchMedia(MOBILE_MEDIA_QUERY)
    const handleChange = () => {
      setIsMobile(media.matches)
      setPageSize(preferredEquipmentPageSize())
      // Смена раскладки меняет и размер страницы, и смысл её номера: накопленные
      // «три страницы» телефона на десктопе означали бы совсем другое место выдачи.
      setParams((current) => {
        const next = new URLSearchParams(current)
        next.delete('page')
        return next
      }, { replace: true })
    }
    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [setParams])

  useEffect(() => {
    if (searchInput === search) return
    const timer = window.setTimeout(() => {
      pushedSearchRef.current = searchInput
      updateParams({ q: searchInput }, { replace: true })
    }, 350)
    return () => window.clearTimeout(timer)
  }, [search, searchInput])

  // Адрес сменился не нами («назад», ссылка) — поле догоняет его. Своя запись сюда
  // не попадает: её значение уже лежит в pushedSearchRef, и буквы, набранные пока
  // запись летела, не затираются.
  useEffect(() => {
    if (search === pushedSearchRef.current) return
    pushedSearchRef.current = search
    setSearchInput(search)
  }, [search])

  // Справочник категорий грузится один раз на заход: он живёт в кэше сутки и
  // прогревается в App.tsx вместе с данными редактора.
  useEffect(() => {
    fetchEquipmentTaxonomy()
      .then(setTaxonomy)
      .catch((error: unknown) => reportAppError(error, { scope: 'prefetch', route: '/equipment', detail: { source: 'taxonomy' } }))
  }, [])

  useEffect(() => {
    let isCurrent = true
    // Первый кадр рисуется из кэша целиком или не рисуется вовсе: на телефоне
    // накоплено N страниц, и склейка «две из кэша, третья пусто» показала бы
    // обрезанный список как полный.
    const cachedPages = pagesToLoad.map((pageNumber) => readCachedEquipment({ page: pageNumber, search, availability, type, subtype, pageSize }))
    const cached = cachedPages.every(Boolean)
      ? { rows: cachedPages.flatMap((entry) => entry?.rows ?? []), total: cachedPages[cachedPages.length - 1]?.total ?? 0 }
      : null
    // Возраст спрашиваем у кэша, а не считаем от момента ответа: запись обновляется
    // только на УСПЕШНОМ ответе, поэтому после сбоя сети здесь остаётся старая метка —
    // ровно то, что бейдж и должен показать.
    // Возраст — по ПОСЛЕДНЕЙ запрошенной странице: бейдж отвечает на «когда пришло
    // то, что видно», а накопленный хвост телефона моложе своего начала не бывает.
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

    // Перепроверять у сервера имеет смысл только последнюю страницу — накопленные
    // ранее уже проверялись на своём заходе. «Обновить» (reloadKey) обходит кэш
    // у всех: человек нажал её именно потому, что не верит показанному.
    Promise.all(pagesToLoad.map((pageNumber) => fetchEquipment({
      page: pageNumber,
      search,
      availability,
      type,
      subtype,
      pageSize,
      bypassCache: reloadKey > 0 || (pageNumber === currentPage && Boolean(cached)),
    })))
      .then((results) => {
        if (!isCurrent) return
        // total одинаков у всех страниц выборки — берём у последней пришедшей.
        const result = { rows: results.flatMap((entry) => entry.rows), total: results.at(-1)?.total ?? 0 }
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
  }, [availability, currentPage, pageSize, pagesToLoad, reloadKey, search, subtype, type])

  // Карточка, названная в адресе. Строку берём из уже загруженной выдачи; для
  // ссылки, открытой напрямую, дотягиваем по id — иначе `?item=…` из закладки
  // открывал бы каталог с пустым дровером.
  useEffect(() => {
    if (!itemId) {
      setSelected(null)
      return
    }
    if (selected?.id === itemId) return
    const known = rows.find((row) => row.id === itemId)
    if (known) {
      setSelected(known)
      return
    }
    let isCurrent = true
    fetchEquipmentByIds([itemId])
      .then((found) => {
        if (isCurrent && found[0]) setSelected(found[0])
      })
      .catch((error: unknown) => reportAppError(error, { scope: 'loader', route: '/equipment', detail: { item: itemId } }))
    return () => { isCurrent = false }
  }, [itemId, rows, selected])

  // На телефоне показанное — это накопленное с начала выдачи, а не окно страницы.
  const range = useMemo(() => {
    if (!total) return '0'
    if (isMobile) return `1–${rows.length}`
    const from = (currentPage - 1) * pageSize + 1
    const to = Math.min(currentPage * pageSize, total)
    return `${from}–${to}`
  }, [currentPage, isMobile, pageSize, rows.length, total])

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">{tr('Складской учёт', 'Ombor hisobi')}</p>
          <h1>{tr('Оборудование', 'Uskunalar')}</h1>
          <p className="page-description">{tr('Единый каталог техники, комплектующих и расходных материалов.', 'Texnika, butlovchi qismlar va sarf materiallarining yagona katalogi.')}</p>
        </div>
        {/* Адрес каталога уезжает в state перехода: экран заведения возвращает
            человека ровно в ту выборку, из которой он ушёл. Через state, а не
            navigate(-1) на той стороне: по прямой ссылке на /equipment/new
            истории нет, и шаг назад увёл бы из приложения. */}
        <button className="button button--primary" onClick={() => navigate('/equipment/new', { state: { catalogSearch: params.toString() } })}>
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
              // Подкатегория принадлежит категории: оставленная от прошлой
              // категории, она дала бы заведомо пустую выборку.
              updateParams({ type: value, subtype: '' })
            }}
            ariaLabel={tr('Фильтр по категории', 'Toifa bo‘yicha filtr')}
          />
          <AppSelect
            value={subtype}
            options={subtypeOptions}
            onChange={(value) => updateParams({ subtype: value })}
            ariaLabel={tr('Фильтр по подкатегории', 'Quyi toifa bo‘yicha filtr')}
          />
          <AppSelect
            value={availability}
            options={availabilityOptions}
            icon={<SlidersHorizontal size={17} />}
            onChange={(value) => updateParams({ status: value })}
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
                          onClick={() => openItem(item)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              openItem(item)
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
          {isMobile ? (
            // Кнопка вместо двух стрелок: 186 страниц пролистать нельзя, а «ещё 8»
            // — можно. Следующая страница уже прогрета префетчем ниже по эффекту,
            // поэтому нажатие отрабатывает без ожидания сети.
            currentPage < pageCount && (
              <button className="button button--secondary catalog-more" disabled={isFetching} onClick={() => goToPage(currentPage + 1)}>
                {isFetching
                  ? tr('Загружаем…', 'Yuklanmoqda…')
                  : tr(`Показать ещё ${Math.min(pageSize, total - rows.length)}`, `Yana ${Math.min(pageSize, total - rows.length)} ta ko‘rsatish`)}
              </button>
            )
          ) : (
            <div className="pagination__controls">
              <button className="icon-button icon-button--bordered" disabled={currentPage <= 1 || isLoading} onClick={() => goToPage(currentPage - 1)} aria-label={tr('Предыдущая страница', 'Oldingi sahifa')}>
                <ChevronLeft size={18} />
              </button>
              <span>{tr('Страница', 'Sahifa')} <strong>{currentPage}</strong> {tr('из', 'dan')} {pageCount}</span>
              <button className="icon-button icon-button--bordered" disabled={currentPage >= pageCount || isLoading} onClick={() => goToPage(currentPage + 1)} aria-label={tr('Следующая страница', 'Keyingi sahifa')}>
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </footer>
      </section>

      {selected && (
        <EquipmentDrawer
          item={selected}
          onClose={closeItem}
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
