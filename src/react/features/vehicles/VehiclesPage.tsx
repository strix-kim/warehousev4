import { CarFront, CircleAlert, Plus, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { fetchVehiclePhotoPaths, fetchVehicles, getSignedUrls } from './api'
import { VehicleDrawer } from './VehicleDrawer'
import { driverShortName, plateForSearch, vehicleTitle, type VehicleWithDrivers } from './types'
import { useLanguage } from '../../lib/i18n'
import { reportAppError } from '../../lib/reportAppError'

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

  // Выдача полная (машин десятки), поэтому карточку из адреса ищем в ней же —
  // отдельного запроса по id не нужно. Ищем по ПОЛНОМУ списку, а не по
  // отфильтрованному: набранный поиск не должен закрывать открытую карточку.
  const selected = vehicleId ? vehicles.find((vehicle) => vehicle.id === vehicleId) ?? null : null

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
            <table className="data-table">
              <thead>
                <tr>
                  <th>{tr('Машина', 'Mashina')}</th>
                  <th>{tr('Госномер', 'Davlat raqami')}</th>
                  <th>{tr('Водители', 'Haydovchilar')}</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && vehicles.length === 0
                  ? Array.from({ length: 6 }, (_, index) => (
                      <tr key={index} className="skeleton-row">
                        <td colSpan={3}><span /></td>
                      </tr>
                    ))
                  : visible.map((vehicle) => {
                      const photo = photoUrls.get(vehicle.id)
                      return (
                        <tr
                          key={vehicle.id}
                          onClick={() => openVehicle(vehicle)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              openVehicle(vehicle)
                            }
                          }}
                          tabIndex={0}
                        >
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
                            {vehicle.drivers.length > 0 ? vehicle.drivers.map(driverShortName).join(', ') : '—'}
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

      {selected && <VehicleDrawer vehicle={selected} onClose={closeVehicle} />}
    </>
  )
}
