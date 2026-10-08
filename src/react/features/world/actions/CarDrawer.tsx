// Карточка машины поверх сцены (план world-game-s59.md, Э4): тот же VehicleDrawer, что
// открывает реестр машин. Своих запросов строки нет — её даёт мир из выдачи машин; здесь
// только главное фото, как у строки реестра: путь из того же кэша, что у VehiclesPage
// (ключ — у vehicles/api), ссылка подписывается на час и нигде не хранится. Грузится
// только ленивым чанком из WorldActions.
import { useEffect, useState } from 'react'
import { reportAppError } from '../../../lib/reportAppError'
import { fetchVehiclePhotoPaths, getSignedUrl } from '../../vehicles/api'
import type { VehicleWithDrivers } from '../../vehicles/types'
import { VehicleDrawer } from '../../vehicles/VehicleDrawer'

export function CarDrawer({ vehicle, onClose, onEdit }: {
  vehicle: VehicleWithDrivers
  onClose: () => void
  // «Редактировать»: мир уходит в форму машины интерьером с возвратом
  onEdit: () => void
}) {
  const [photoUrl, setPhotoUrl] = useState<string>()

  useEffect(() => {
    let isCurrent = true
    fetchVehiclePhotoPaths()
      .then((paths) => {
        const path = paths.get(vehicle.id)
        return path ? getSignedUrl(path) : undefined
      })
      .then((url) => { if (isCurrent) setPhotoUrl(url) })
      // Фото — украшение шапки: без него стоит плейсхолдер, карточка работает
      .catch((error: unknown) => reportAppError(error, { scope: 'loader', route: window.location.pathname, detail: { source: 'world-car-photo', vehicle: vehicle.id } }))
    return () => { isCurrent = false }
  }, [vehicle.id])

  return <VehicleDrawer vehicle={vehicle} photoUrl={photoUrl} onClose={onClose} onEdit={onEdit} />
}
