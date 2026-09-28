import { CarFront, CircleAlert, Pencil } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { fetchVehicleFiles, getSignedUrls } from './api'
import { Plate } from './Plate'
import { VehicleFilesList } from './VehicleFilesList'
import { driverFullName, vehicleTitle, type VehicleFile, type VehicleWithDrivers } from './types'
import { DrawerFrame } from '../../components/DrawerFrame'
import { ProfileHead } from '../../components/ProfileCard'
import { useLanguage } from '../../lib/i18n'
import { reportAppError } from '../../lib/reportAppError'
import { useModalLayer } from '../../lib/useModalLayer'

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

  const title = vehicleTitle(vehicle.brand, vehicle.model)
  // «Марка Модель · Цвет» одной приглушённой строкой под знаком: цвет один
  // факт, отдельной секции «Характеристики» ради него нет.
  const subtitle = [title, vehicle.color].filter(Boolean).join(' · ')
  // Секция фото — только когда есть что показать или что-то сломалось: в проде
  // vehicle_files пуста, и «Фото пока нет» с заголовком стояло бы единственным
  // блоком карточки. Скелета нет намеренно: пока грузится, блока просто нет.
  const hasPhotosBlock = hasError || (!isLoading && files.length > 0)

  return (
    <DrawerFrame
      className="profile"
      ariaLabel={tr('Карточка машины', 'Mashina kartasi')}
      instant={false}
      onRequestClose={onClose}
      head={
        // Надзаголовок называет КЛАСС записи, заголовком служит знак госномера —
        // машину на площадке опознают по номеру, а не по названию модели.
        <ProfileHead
          eyebrow={tr('Автомобиль', 'Avtomobil')}
          photo={{ url: photoUrl, placeholder: <CarFront size={34} />, shape: 'car' }}
          subtitle={subtitle}
          mainFact={{ value: vehicle.plate_number, label: tr('госномер', 'davlat raqami'), display: <Plate value={vehicle.plate_number} size="lg" /> }}
          extra={vehicle.drivers.length === 0
            ? <p className="profile-head__none">{tr('Водитель не назначен', 'Haydovchi tayinlanmagan')}</p>
            : vehicle.drivers.map((driver) => (
              <Link key={driver.id} className="chip" to={`/employees?employee=${driver.id}`} title={driverFullName(driver)}>
                <span>{driverFullName(driver)}</span>
                {(driver.phone || driver.position) && <em>{driver.phone || driver.position}</em>}
              </Link>
            ))}
          onClose={onClose}
        />
      }
      foot={<button className="button button--secondary" onClick={() => navigate(`/vehicles/${vehicle.id}/edit`)}><Pencil size={16} /> {tr('Редактировать', 'Tahrirlash')}</button>}
    >
      {hasPhotosBlock && (
        <section className="profile-section">
          <h3 className="drawer-caps">{tr('Фото', 'Fotolar')}</h3>
          {hasError
            ? <p className="form-error"><CircleAlert size={15} /> {tr('Не удалось загрузить фото машины.', 'Mashina fotolarini yuklab bo‘lmadi.')}</p>
            : <>
              <VehicleFilesList files={files} urls={urls} photoAlt={title} />
              <p className="profile-section__hint">{tr('Открываются по временной ссылке — она действует час.', 'Vaqtinchalik havola orqali ochiladi — u bir soat amal qiladi.')}</p>
            </>}
        </section>
      )}
    </DrawerFrame>
  )
}
