import { useEffect, useState } from 'react'
import { preloadEquipmentImages } from '../../components/EquipmentVisual'
import { fetchAllEquipment, readCachedAllEquipment } from '../equipment/api'
import type { Equipment } from '../equipment/types'

// Каталог редактора: стартует с кэша, если он есть, и тихо освежается из базы.
export function useEditorCatalog() {
  const [cachedEquipment] = useState(readCachedAllEquipment)
  const [equipment, setEquipment] = useState<Equipment[]>(() => cachedEquipment ?? [])
  const [isLoading, setIsLoading] = useState(() => !cachedEquipment)
  // Каталог: тоже только флаг — текст ошибки собирается на рендере.
  const [hasLoadError, setHasLoadError] = useState(false)

  useEffect(() => {
    let current = true
    setIsLoading(!cachedEquipment)
    setHasLoadError(false)
    fetchAllEquipment({ bypassCache: Boolean(cachedEquipment) })
      .then((result) => {
        if (!current) return
        setEquipment(result)
        preloadEquipmentImages(result, 32)
      })
      .catch(() => { if (current && !cachedEquipment) setHasLoadError(true) })
      .finally(() => { if (current) setIsLoading(false) })
    return () => { current = false }
  }, [])

  return { equipment, isLoading, hasLoadError }
}
