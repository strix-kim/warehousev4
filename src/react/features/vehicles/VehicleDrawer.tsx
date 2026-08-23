import { CircleAlert, Pencil, UserRound, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { fetchVehicleFiles, getSignedUrls } from './api'
import { VehicleFilesList } from './VehicleFilesList'
import { driverFullName, vehicleTitle, type Tr, type VehicleFile, type VehicleWithDrivers } from './types'
import { useLanguage } from '../../lib/i18n'
import { reportAppError } from '../../lib/reportAppError'
import { useModalLayer } from '../../lib/useModalLayer'

type DetailRow = { key: string; label: string; value: string | null }

// Строки карточки: показываем ТОЛЬКО заполненные — обязательных полей у машины
// два (марка и номер), остальное добивается позже, и половина «—» превращала бы
// карточку в бланк.
function detailRows(vehicle: VehicleWithDrivers, tr: Tr): DetailRow[] {
  return [
    { key: 'brand', label: tr('Марка', 'Marka'), value: vehicle.brand },
    { key: 'model', label: tr('Модель', 'Model'), value: vehicle.model },
    { key: 'color', label: tr('Цвет', 'Rang'), value: vehicle.color },
  ].filter((row) => Boolean(row.value))
}

export function VehicleDrawer({ vehicle, onClose }: { vehicle: VehicleWithDrivers; onClose: () => void }) {
  const { tr } = useLanguage()
  const navigate = useNavigate()
  useModalLayer(onClose)
  const [files, setFiles] = useState<VehicleFile[]>([])
  // Подписанные ссылки живут час и в персистентный кэш не кладутся — только
  // память страницы, ключ — путь в бакете.
  const [urls, setUrls] = useState<Map<string, string>>(new Map())
  const [isLoading, setIsLoading] = useState(true)
  // Флаг вместо текста: строка в стейте потянула бы tr в зависимости эффекта,
  // и смена языка перезапрашивала бы файлы.
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    let isCurrent = true
    setIsLoading(true)
    setHasError(false)
    fetchVehicleFiles(vehicle.id)
      .then(async (rows) => {
        if (!isCurrent) return
        setFiles(rows)
        // Ссылки подписываем пачкой: по запросу на файл дало бы десяток
        // обращений на одну карточку.
        const signed = await getSignedUrls(rows.map((row) => row.storage_path))
        if (isCurrent) setUrls(signed)
      })
      .catch((error: unknown) => {
        if (!isCurrent) return
        setHasError(true)
        reportAppError(error, { scope: 'loader', route: '/vehicles', detail: { vehicle: vehicle.id } })
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false)
      })
    return () => { isCurrent = false }
  }, [vehicle.id])

  const rows = detailRows(vehicle, tr)
  const title = vehicleTitle(vehicle.brand, vehicle.model)
  // Марка с моделью и цветом уходят в надзаголовок, а крупно стоит госномер:
  // машину на площадке опознают по номеру, а не по названию модели.
  const eyebrow = [title, vehicle.color].filter(Boolean).join(' · ')

  return (
    <div className="drawer-layer" role="dialog" aria-modal="true" aria-label={tr('Карточка машины', 'Mashina kartasi')} onMouseDown={onClose}>
      <aside className="drawer" onMouseDown={(event) => event.stopPropagation()}>
        <div className="drawer__header">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h2><span className="plate-badge plate-badge--lg">{vehicle.plate_number}</span></h2>
          </div>
          <div className="drawer__header-actions">
            <button className="button button--secondary" onClick={() => navigate(`/vehicles/${vehicle.id}/edit`)}><Pencil size={16} /> {tr('Редактировать', 'Tahrirlash')}</button>
            <button autoFocus className="icon-button icon-button--bordered" onClick={onClose} aria-label={tr('Закрыть', 'Yopish')}><X size={19} /></button>
          </div>
        </div>

        {/* Фото стоит ВЫШЕ реквизитов: у машины это главный опознавательный
            признак — по нему человек понимает, ту ли карточку открыл. */}
        <section className="unit-lists">
          <div className="panel-heading"><div><h3>{tr('Фото', 'Fotolar')}</h3><p>{tr('Открываются по временной ссылке — она действует час.', 'Vaqtinchalik havola orqali ochiladi — u bir soat amal qiladi.')}</p></div></div>
          {hasError
            ? <p className="form-error"><CircleAlert size={15} /> {tr('Не удалось загрузить фото машины.', 'Mashina fotolarini yuklab bo‘lmadi.')}</p>
            : isLoading
              ? <p className="muted">{tr('Загружаем фото…', 'Fotolar yuklanmoqda…')}</p>
              : files.length === 0
                ? <p className="muted">{tr('Фото пока нет.', 'Hozircha fotolar yo‘q.')}</p>
                : <VehicleFilesList files={files} urls={urls} photoAlt={title} />}
        </section>

        <dl className="detail-list">
          {rows.map((row) => (
            <div key={row.key}>
              <dt>{row.label}</dt><dd>{row.value}</dd>
            </div>
          ))}
        </dl>

        <section className="unit-lists">
          <div className="panel-heading"><div><h3>{tr('Водители', 'Haydovchilar')}</h3><p>{tr('Карточка сотрудника открывается в разделе «Сотрудники».', 'Xodim kartasi «Xodimlar» bo‘limida ochiladi.')}</p></div></div>
          {vehicle.drivers.length === 0
            ? <p className="muted">{tr('Водители не назначены.', 'Haydovchilar tayinlanmagan.')}</p>
            : <ul className="unit-lists__items">
              {vehicle.drivers.map((driver) => (
                <li key={driver.id}>
                  <Link to={`/employees?employee=${driver.id}`}>
                    <UserRound size={17} />
                    <span>
                      <strong>{driverFullName(driver)}</strong>
                      <small>{driver.phone || driver.position || tr('Телефон не указан', 'Telefon ko‘rsatilmagan')}</small>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>}
        </section>
      </aside>
    </div>
  )
}
