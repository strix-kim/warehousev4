import { CarFront, CircleAlert, FileSpreadsheet, Plus, Search, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AppSelect } from '../../components/AppSelect'
import { DataAge } from '../../components/DataAge'
import { PhotoThumb } from '../../components/PhotoThumb'
import { fetchVehiclePhotoPaths, fetchVehicles, getSignedUrls, readCachedVehicles, readCachedVehiclesMeta } from './api'
import { downloadVehicleEventXlsx } from './eventExport'
import { VehicleDrawer } from './VehicleDrawer'
import { VehicleEventExportDrawer } from './VehicleEventExportDrawer'
import { plateForSearch, vehicleTitle, type VehicleWithDrivers } from './types'
import { fetchEmployeesByIds } from '../employees/api'
import { employeeShortName, type Employee } from '../employees/types'
import { useDocumentTitle, useLanguage } from '../../lib/i18n'
import { reportAppError } from '../../lib/reportAppError'
import type { EventDocumentMeta } from '../../lib/xlsx/eventDocument'

export function VehiclesPage() {
  const navigate = useNavigate()
  const { tr, locale } = useLanguage()
  useDocumentTitle(tr('Автомобили', 'Avtomobillar'))
  // Открытая карточка живёт в АДРЕСЕ: заход в «Добавить машину» и обратно
  // размонтирует страницу, а на телефоне жест «назад» обязан закрывать карточку,
  // а не выкидывать из раздела.
  const [params, setParams] = useSearchParams()
  const vehicleId = params.get('vehicle') ?? ''
  // Первый кадр берём из кэша: выдача машин лежит и на диске (паспортных данных
  // в ней нет, api.ts), поэтому раздел открывается с данными и после F5.
  const [cachedVehicles] = useState(() => readCachedVehicles())
  const [vehicles, setVehicles] = useState<VehicleWithDrivers[]>(() => cachedVehicles ?? [])
  // Поиск здесь клиентский и в адрес не едет: выдача полная, фильтр мгновенный,
  // а запоминать его в истории незачем — в отличие от открытой карточки.
  const [search, setSearch] = useState('')
  const [brand, setBrand] = useState('')
  // Состав будущего документа — черновик действия, а не состояние экрана:
  // ни в адресе, ни в хранилище его нет, уход со страницы сбрасывает выбор.
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isExportOpen, setIsExportOpen] = useState(false)
  // Подписанные ссылки на первое фото каждой машины — только память страницы:
  // URL живёт час, и в persistentCache ему не место.
  const [photoUrls, setPhotoUrls] = useState<Map<string, string>>(new Map())
  const [isLoading, setIsLoading] = useState(() => !cachedVehicles)
  // Флаг, а не текст: строка в стейте потянула бы tr в зависимости эффекта, и
  // смена языка перезагружала бы список.
  const [hasError, setHasError] = useState(false)
  // Момент записи показанной выдачи. Значение принадлежит persistentCache —
  // здесь только перечитывается, ничего производного не храним.
  const [dataAt, setDataAt] = useState<number | null>(null)
  // Отдельный флаг от isLoading: isLoading означает «показывать нечего, рисуем
  // скелет» и при живом кэше всегда false, а кнопке «Обновить» нужен признак
  // «запрос в полёте».
  const [isFetching, setIsFetching] = useState(false)
  // Исход ПОСЛЕДНЕГО запроса: бейдж обязан отличать «данные старые» от
  // «обновиться не удалось».
  const [lastFetchFailed, setLastFetchFailed] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let isCurrent = true
    // Показали кэш — обязаны перепроверить у сервера; «Обновить» обходит кэш
    // всегда, потому что её жмут именно от недоверия к показанному.
    const bypassCache = reloadKey > 0 || Boolean(cachedVehicles)
    // Метка ДО запроса: при живой записи cachedQuery подменяет провал последним
    // значением и промис РЕЗОЛВИТСЯ, поэтому единственный честный признак
    // «ответа не было» — несдвинувшаяся метка (gotchas §11).
    const ageBefore = readCachedVehiclesMeta()?.touchedAt ?? null
    setIsLoading(!cachedVehicles)
    setIsFetching(true)
    setHasError(false)
    setDataAt(null)

    // Фото стартуют ВМЕСТЕ со списком: они спрашивают другую таблицу и выдачи
    // машин не ждут. Миниатюры — украшение строки, их отказ не роняет список,
    // поэтому у них своя ветка и свой отчёт.
    void fetchVehiclePhotoPaths({ bypassCache })
      .then((paths) => getSignedUrls([...paths.values()]).then((urls) => ({ paths, urls })))
      .then(({ paths, urls }) => {
        if (!isCurrent) return
        const byVehicle = new Map<string, string>()
        for (const [id, path] of paths) {
          const url = urls.get(path)
          if (url) byVehicle.set(id, url)
        }
        setPhotoUrls(byVehicle)
      })
      .catch((error: unknown) => reportAppError(error, { scope: 'loader', route: '/vehicles', detail: { source: 'photos' } }))

    fetchVehicles({ bypassCache })
      .then((rows) => {
        if (!isCurrent) return
        setVehicles(rows)
        const ageAfter = readCachedVehiclesMeta()?.touchedAt ?? null
        setLastFetchFailed(ageAfter !== null && ageAfter === ageBefore)
        setDataAt(ageAfter)
      })
      .catch((error: unknown) => {
        if (!isCurrent) return
        setLastFetchFailed(true)
        setDataAt(readCachedVehiclesMeta()?.touchedAt ?? null)
        // Кэш уже на экране — сбой обновления не повод рушить показанный список.
        if (!cachedVehicles) setHasError(true)
        reportAppError(error, { scope: 'loader', route: '/vehicles' })
      })
      .finally(() => {
        if (!isCurrent) return
        setIsLoading(false)
        setIsFetching(false)
      })
    return () => { isCurrent = false }
  }, [reloadKey])

  // Три поля на одну строку поиска: номер сверяем без пробелов и регистра
  // (в базе он с пробелами, в голове у человека — слитно), марку с моделью и
  // фамилию водителя — обычной подстрокой.
  const query = search.trim()
  // Фильтр складывается с поиском, а не отменяет его: марку выбирают, чтобы
  // сузить уже найденное, а не чтобы начать сначала.
  const isFiltered = Boolean(query) || Boolean(brand)
  const visible = useMemo(() => {
    if (!isFiltered) return vehicles
    const plateQuery = plateForSearch(query)
    const lowered = query.toLowerCase()
    return vehicles.filter((vehicle) => {
      if (brand && vehicle.brand !== brand) return false
      if (!query) return true
      return plateForSearch(vehicle.plate_number).includes(plateQuery)
        || vehicleTitle(vehicle.brand, vehicle.model).toLowerCase().includes(lowered)
        || vehicle.drivers.some((driver) => driver.last_name.toLowerCase().includes(lowered))
    })
  }, [vehicles, query, brand, isFiltered])

  // Марки собираются из фактической выдачи: справочника марок у сущности нет,
  // и заводить его ради фильтра — это вторая правда о том же значении.
  const brandOptions = useMemo(() => {
    const values = [...new Set(vehicles.map((vehicle) => vehicle.brand).filter((value): value is string => Boolean(value)))]
    return values.sort((a, b) => a.localeCompare(b))
  }, [vehicles])

  function resetFilters() {
    setSearch('')
    setBrand('')
  }

  // Карточка — тоже адрес. Открытие пушит запись, поэтому «назад» её закрывает;
  // закрытие ЗАМЕНЯЕТ текущую запись, иначе «назад» открыло бы её снова (§7).
  function openVehicle(vehicle: VehicleWithDrivers) {
    const next = new URLSearchParams(params)
    next.set('vehicle', vehicle.id)
    setParams(next)
  }

  function closeVehicle() {
    const next = new URLSearchParams(params)
    next.delete('vehicle')
    setParams(next, { replace: true })
  }

  function toggleSelected(id: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // «Показанные» — это результат поиска, а не вся база: галка в тулбаре обещает
  // ровно то, что человек видит перед собой.
  const allShownSelected = visible.length > 0 && visible.every((vehicle) => selected.has(vehicle.id))

  function toggleAllShown() {
    setSelected((current) => {
      const next = new Set(current)
      for (const vehicle of visible) {
        if (allShownSelected) next.delete(vehicle.id)
        else next.add(vehicle.id)
      }
      return next
    })
  }

  // Выдача полная (машин десятки), поэтому карточку из адреса ищем в ней же —
  // отдельного запроса по id не нужно. Ищем по ПОЛНОМУ списку, а не по
  // отфильтрованному: набранный поиск не должен закрывать открытую карточку.
  const openCard = vehicleId ? vehicles.find((vehicle) => vehicle.id === vehicleId) ?? null : null
  const chosen = vehicles.filter((vehicle) => selected.has(vehicle.id))

  // Сборка документа: паспорт, адрес и дата рождения водителя лежат в его ПОЛНОЙ
  // карточке, а во встроенном в машину водителе этих колонок нет — тянем
  // сотрудников одним запросом и раскладываем по id. Отменённый прогон файл НЕ
  // отдаёт: человек уже закрыл дровер, и загрузка «сама собой» его бы озадачила.
  async function exportEventList(meta: EventDocumentMeta, options: { signal: AbortSignal }) {
    // Раньше сюда приезжали ВСЕ сотрудники целиком, чтобы выбрать из них
    // водителей выбранных машин. Спрашиваем сразу нужных: паспортные данные
    // посторонних людей не должны оказываться в памяти вкладки ради документа
    // на три машины.
    const driverIds = [...new Set(chosen.flatMap((vehicle) => vehicle.drivers.map((driver) => driver.id)))]
    const rows = await fetchEmployeesByIds(driverIds)
    const employeesById = new Map<string, Employee>()
    for (const row of rows) {
      employeesById.set(row.id, row)
    }
    if (!options.signal.aborted) downloadVehicleEventXlsx({ vehicles: chosen, employeesById, meta })
  }

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">{tr('Транспорт', 'Transport')}</p>
          <h1>{tr('Автомобили', 'Avtomobillar')}</h1>
          <p className="page-description">{tr('Машины компании: госномера, водители и фото.', 'Kompaniya mashinalari: davlat raqamlari, haydovchilar va fotolar.')}</p>
        </div>
        <button className="button button--primary" onClick={() => navigate('/vehicles/new')}>
          <Plus size={18} /> {tr('Добавить машину', 'Mashina qo‘shish')}
        </button>
      </header>

      <section className="data-panel">
        <div className="toolbar">
          <label className="search-field">
            <Search size={18} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={tr('Госномер, марка или водитель…', 'Davlat raqami, marka yoki haydovchi…')}
              aria-label={tr('Поиск машин', 'Mashinalarni qidirish')}
            />
            {search && (
              <button className="icon-button" onClick={() => setSearch('')} aria-label={tr('Очистить поиск', 'Qidiruvni tozalash')}>
                <X size={16} />
              </button>
            )}
          </label>
          <AppSelect
            value={brand}
            options={[{ value: '', label: tr('Все марки', 'Barcha markalar') }, ...brandOptions.map((value) => ({ value, label: value }))]}
            icon={<CarFront size={17} />}
            onChange={setBrand}
            ariaLabel={tr('Фильтр по марке', 'Marka bo‘yicha filtr')}
          />
          <label className="select-all">
            <input type="checkbox" checked={allShownSelected} disabled={visible.length === 0} onChange={toggleAllShown} />
            {/* Числа в подписи нет намеренно: сколько сейчас показано, печатает
                один toolbar__count — два счётчика рядом расходились бы в глазах. */}
            <span>{tr('Выбрать всех показанных', 'Ko‘rsatilganlarning barchasini tanlash')}</span>
          </label>
          {/* Счётчик отвечает на один вопрос: без фильтра — сколько машин всего,
              с фильтром — сколько нашлось из скольких. Прежняя строка печатала
              visible в обоих случаях, и общее число просто пропадало. */}
          <span className="toolbar__count">
            {isFiltered
              ? tr(`Найдено: ${visible.length.toLocaleString(locale)} из ${vehicles.length.toLocaleString(locale)}`, `Topildi: ${vehicles.length.toLocaleString(locale)} tadan ${visible.length.toLocaleString(locale)} tasi`)
              : `${tr('Машин', 'Mashinalar')}: ${vehicles.length.toLocaleString(locale)}`}
          </span>
          {/* Рядом с блоком «Ошибка загрузки» бейдж не рисуем: на экране оказались
              бы два разных предложения обновиться. */}
          {!hasError && <DataAge touchedAt={dataAt} isRefreshing={isFetching} failed={lastFetchFailed} onRefresh={() => setReloadKey((value) => value + 1)} />}
        </div>

        {hasError ? (
          <div className="state-block state-block--error">
            <CircleAlert size={24} />
            <strong>{tr('Ошибка загрузки', 'Yuklash xatosi')}</strong>
            <span>{tr('Не удалось загрузить машины. Повторите попытку.', 'Mashinalarni yuklab bo‘lmadi. Qayta urinib ko‘ring.')}</span>
            <button className="button button--secondary" onClick={() => setReloadKey((value) => value + 1)}>{tr('Повторить', 'Qayta urinish')}</button>
          </div>
        ) : (
          <div className="table-scroll" aria-busy={isLoading}>
            <table className="data-table data-table--selectable">
              <thead>
                <tr>
                  <th className="select-cell" aria-label={tr('Выбор', 'Tanlash')} />
                  <th>{tr('Машина', 'Mashina')}</th>
                  <th>{tr('Госномер', 'Davlat raqami')}</th>
                  <th>{tr('Водители', 'Haydovchilar')}</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && vehicles.length === 0
                  ? Array.from({ length: 6 }, (_, index) => (
                      <tr key={index} className="skeleton-row">
                        <td colSpan={4}><span /></td>
                      </tr>
                    ))
                  : visible.map((vehicle) => {
                      const photo = photoUrls.get(vehicle.id)
                      return (
                        <tr
                          key={vehicle.id}
                          className={selected.has(vehicle.id) ? 'is-selected' : undefined}
                          onClick={() => openVehicle(vehicle)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              openVehicle(vehicle)
                            }
                          }}
                          tabIndex={0}
                        >
                          {/* Ячейка выбора гасит всплытие: иначе галка заодно
                              открывала бы карточку. Остальная строка — открывает. */}
                          <td className="select-cell" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selected.has(vehicle.id)}
                              onChange={() => toggleSelected(vehicle.id)}
                              aria-label={vehicleTitle(vehicle.brand, vehicle.model)}
                            />
                          </td>
                          <td>
                            <div className="equipment-cell">
                              <PhotoThumb className="employee-avatar" url={photo} placeholder={<CarFront size={18} />} />
                              <span>
                                <strong>{vehicleTitle(vehicle.brand, vehicle.model)}</strong>
                                <small>{vehicle.color || tr('Цвет не указан', 'Rang ko‘rsatilmagan')}</small>
                              </span>
                            </div>
                          </td>
                          <td data-label={tr('Госномер', 'Davlat raqami')}><span className="plate-badge">{vehicle.plate_number}</span></td>
                          <td data-label={tr('Водители', 'Haydovchilar')}>
                            {vehicle.drivers.length > 0 ? vehicle.drivers.map(employeeShortName).join(', ') : '—'}
                          </td>
                        </tr>
                      )
                    })}
              </tbody>
            </table>

            {!isLoading && vehicles.length === 0 && (
              <div className="state-block">
                <CarFront size={27} />
                <strong>{tr('Машин пока нет', 'Hozircha mashinalar yo‘q')}</strong>
                <span>{tr('Заведите первую карточку — данные можно добить позже.', 'Birinchi kartani yarating — ma’lumotlarni keyinroq to‘ldirish mumkin.')}</span>
                <button className="button button--primary" onClick={() => navigate('/vehicles/new')}>
                  <Plus size={18} /> {tr('Добавить машину', 'Mashina qo‘shish')}
                </button>
              </div>
            )}

            {!isLoading && vehicles.length > 0 && visible.length === 0 && (
              <div className="state-block">
                <Search size={27} />
                <strong>{query
                  ? tr(`Ничего не найдено по «${query}»`, `«${query}» bo‘yicha hech narsa topilmadi`)
                  : tr('Ничего не найдено', 'Hech narsa topilmadi')}</strong>
                <span>{tr('Проверьте написание номера или снимите фильтр по марке — пробелы в номере не важны.', 'Raqam yozilishini tekshiring yoki marka filtrini oling — raqamdagi bo‘shliqlar muhim emas.')}</span>
                <button className="button button--secondary" onClick={resetFilters}>{tr('Сбросить фильтры', 'Filtrlarni tozalash')}</button>
              </div>
            )}
          </div>
        )}
      </section>

      {selected.size > 0 && (
        <div className="bulk-bar">
          <span>{tr('Выбрано', 'Tanlangan')}: <strong>{selected.size.toLocaleString(locale)}</strong></span>
          <button className="button button--secondary" onClick={() => setSelected(new Set())}>{tr('Снять выбор', 'Tanlovni bekor qilish')}</button>
          <button className="button button--primary" onClick={() => setIsExportOpen(true)}>
            <FileSpreadsheet size={17} /> {tr('Список на мероприятие', 'Tadbir uchun ro‘yxat')}
          </button>
        </div>
      )}

      {openCard && <VehicleDrawer vehicle={openCard} onClose={closeVehicle} />}
      {isExportOpen && <VehicleEventExportDrawer vehicles={chosen} onClose={() => setIsExportOpen(false)} onExport={exportEventList} />}
    </>
  )
}
