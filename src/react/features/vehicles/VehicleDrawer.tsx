import { CarFront, CircleAlert, Palette, Pencil, UserRound, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { fetchVehicleFiles, getSignedUrls } from './api'
import { VehicleFilesList, VehicleFilesSkeleton } from './VehicleFilesList'
import { driverFullName, vehicleTitle, type Tr, type VehicleFile, type VehicleWithDrivers } from './types'
import { ProfileHead, ProfileSections, type ProfileSection } from '../../components/ProfileCard'
import { useLanguage } from '../../lib/i18n'
import { reportAppError } from '../../lib/reportAppError'
import { useModalLayer } from '../../lib/useModalLayer'

// Реквизиты карточки: показываем ТОЛЬКО заполненные — обязательных полей у машины
// два (марка и номер), остальное добивается позже, и половина «—» превращала бы
// карточку в бланк. Марки с моделью здесь нет намеренно: они стоят главным фактом
// в шапке, и строкой это был бы второй показ тех же данных.
function detailSections(vehicle: VehicleWithDrivers, tr: Tr): ProfileSection[] {
  return [
    {
      key: 'specs',
      title: tr('Характеристики', 'Xususiyatlar'),
      fields: [
        { key: 'color', label: tr('Цвет', 'Rang'), value: vehicle.color, icon: <Palette size={13} /> },
      ],
    },
  ]
}

export function VehicleDrawer({ vehicle, photoUrl, onClose }: {
  vehicle: VehicleWithDrivers
  // Подписанная ссылка на главное фото — та же, что показывает строка списка:
  // шапка не ждёт круга сети (с26). В проде vehicle_files пуста, поэтому обычное
  // состояние сегодня — плейсхолдер, и он обязан выглядеть намеренным.
  photoUrl?: string
  onClose: () => void
}) {
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

  const sections = detailSections(vehicle, tr)
  const title = vehicleTitle(vehicle.brand, vehicle.model)

  return (
    <div className="drawer-layer" role="dialog" aria-modal="true" aria-label={tr('Карточка машины', 'Mashina kartasi')} onMouseDown={onClose}>
      <aside className="drawer" onMouseDown={(event) => event.stopPropagation()}>
        <div className="drawer__header">
          {/* Надзаголовок называет КЛАСС записи, крупно стоит госномер — машину на
              площадке опознают по номеру, а не по названию модели, — и марка с
              моделью идут главным фактом под ним. */}
          <ProfileHead
            eyebrow={tr('Автомобиль', 'Avtomobil')}
            title={<span className="plate-badge plate-badge--lg">{vehicle.plate_number}</span>}
            copyValue={vehicle.plate_number}
            fact={title}
            photoUrl={photoUrl}
            photoPlaceholder={<CarFront size={24} />}
            photoShape="wide"
          />
          <div className="drawer__header-actions">
            <button className="button button--secondary" onClick={() => navigate(`/vehicles/${vehicle.id}/edit`)}><Pencil size={16} /> {tr('Редактировать', 'Tahrirlash')}</button>
            <button autoFocus className="icon-button icon-button--bordered" onClick={onClose} aria-label={tr('Закрыть', 'Yopish')}><X size={19} /></button>
          </div>
        </div>

        <ProfileSections sections={sections} />

        <section className="unit-lists profile-section">
          <h3 className="profile-section__title">{tr('Водители', 'Haydovchilar')}</h3>
          <p className="profile-section__hint">{tr('Карточка сотрудника открывается в разделе «Сотрудники».', 'Xodim kartasi «Xodimlar» bo‘limida ochiladi.')}</p>
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
        {/* Галерея идёт ПОСЛЕ водителей: опознание уехало в шапку (с27), а в
            проде vehicle_files пуста — «Фото пока нет» стояло бы над единственным
            содержательным блоком карточки. Появятся снимки — порядок останется
            верным: несколько фото это подробность, а не ответ на «ту ли карточку
            открыл». */}
        <section className="unit-lists profile-section">
          <h3 className="profile-section__title">{tr('Фото', 'Fotolar')}</h3>
          <p className="profile-section__hint">{tr('Открываются по временной ссылке — она действует час.', 'Vaqtinchalik havola orqali ochiladi — u bir soat amal qiladi.')}</p>
          {hasError
            ? <p className="form-error"><CircleAlert size={15} /> {tr('Не удалось загрузить фото машины.', 'Mashina fotolarini yuklab bo‘lmadi.')}</p>
            : isLoading
              ? <VehicleFilesSkeleton />
              : files.length === 0
                ? <p className="muted">{tr('Фото пока нет.', 'Hozircha fotolar yo‘q.')}</p>
                : <VehicleFilesList files={files} urls={urls} photoAlt={title} />}
        </section>

      </aside>
    </div>
  )
}
