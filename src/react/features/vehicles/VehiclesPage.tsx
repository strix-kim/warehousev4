import { CarFront, CircleAlert, FileSpreadsheet, Plus, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { fetchVehiclePhotoPaths, fetchVehicles, getSignedUrls } from './api'
import { downloadVehicleEventXlsx } from './eventExport'
import { VehicleDrawer } from './VehicleDrawer'
import { VehicleEventExportDrawer } from './VehicleEventExportDrawer'
import { plateForSearch, vehicleTitle, type VehicleWithDrivers } from './types'
import { fetchEmployees } from '../employees/api'
import { employeeShortName, type Employee } from '../employees/types'
import { useLanguage } from '../../lib/i18n'
import { reportAppError } from '../../lib/reportAppError'
import type { EventDocumentMeta } from '../../lib/xlsx/eventDocument'

export function VehiclesPage() {
  const navigate = useNavigate()
  const { tr, locale } = useLanguage()
  // Открытая карточка живёт в АДРЕСЕ: заход в «Добавить машину» и обратно
  // размонтирует страницу, а на телефоне жест «назад» обязан закрывать карточку,
  // а не выкидывать из раздела.
  const [params, setParams] = useSearchParams()
  const vehicleId = params.get('vehicle') ?? ''
  const [vehicles, setVehicles] = useState<VehicleWithDrivers[]>([])
  // Поиск здесь клиентский и в адрес не едет: выдача полная, фильтр мгновенный,
  // а запоминать его в истории незачем — в отличие от открытой карточки.
  const [search, setSearch] = useState('')
  // Состав будущего документа — черновик действия, а не состояние экрана:
  // ни в адресе, ни в хранилище его нет, уход со страницы сбрасывает выбор.
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isExportOpen, setIsExportOpen] = useState(false)
  // Подписанные ссылки на первое фото каждой машины — только память страницы:
  // URL живёт час, и в persistentCache ему не место.
  const [photoUrls, setPhotoUrls] = useState<Map<string, string>>(new Map())
  const [isLoading, setIsLoading] = useState(true)
  // Флаг, а не текст: строка в стейте потянула бы tr в зависимости эффекта, и
  // смена языка перезагружала бы список.
  const [hasError, setHasError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let isCurrent = true
    setIsLoading(true)
    setHasError(false)
    fetchVehicles()
      .then((rows) => {
        if (!isCurrent) return
        setVehicles(rows)
        // Миниатюры — украшение строки: их отказ не должен ронять список,
        // поэтому у них своя ветка и свой отчёт.
        void fetchVehiclePhotoPaths()
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
      })
      .catch((error: unknown) => {
        if (!isCurrent) return
        setHasError(true)
        reportAppError(error, { scope: 'loader', route: '/vehicles' })
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false)
      })
    return () => { isCurrent = false }
  }, [reloadKey])

  // Три поля на одну строку поиска: номер сверяем без пробелов и регистра
  // (в базе он с пробелами, в голове у человека — слитно), марку с моделью и
  // фамилию водителя — обычной подстрокой.
  const query = search.trim()
  const visible = useMemo(() => {
    if (!query) return vehicles
    const plateQuery = plateForSearch(query)
    const lowered = query.toLowerCase()
    return vehicles.filter((vehicle) => plateForSearch(vehicle.plate_number).includes(plateQuery)
      || vehicleTitle(vehicle.brand, vehicle.model).toLowerCase().includes(lowered)
      || vehicle.drivers.some((driver) => driver.last_name.toLowerCase().includes(lowered)))
  }, [vehicles, query])

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
    const rows = await fetchEmployees()
    const driverIds = new Set(chosen.flatMap((vehicle) => vehicle.drivers.map((driver) => driver.id)))
    const employeesById = new Map<string, Employee>()
    for (const row of rows) {
      if (driverIds.has(row.id)) employeesById.set(row.id, row)
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
          </label>
          <label className="select-all">
            <input type="checkbox" checked={allShownSelected} disabled={visible.length === 0} onChange={toggleAllShown} />
            <span>{tr('Выбрать всех показанных', 'Ko‘rsatilganlarning barchasini tanlash')} ({visible.length.toLocaleString(locale)})</span>
          </label>
          <span className="toolbar__count">{tr('Машин', 'Mashinalar')}: {visible.length.toLocaleString(locale)}</span>
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
                              <span className="employee-avatar">
                                {photo
                                  ? <img src={photo} alt="" loading="lazy" decoding="async" />
                                  : <CarFront size={18} />}
                              </span>
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
                <strong>{tr(`Ничего не найдено по «${query}»`, `«${query}» bo‘yicha hech narsa topilmadi`)}</strong>
                <span>{tr('Проверьте написание номера или марки — пробелы в номере не важны.', 'Raqam yoki marka yozilishini tekshiring — raqamdagi bo‘shliqlar muhim emas.')}</span>
                <button className="button button--secondary" onClick={() => setSearch('')}>{tr('Сбросить поиск', 'Qidiruvni tozalash')}</button>
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
