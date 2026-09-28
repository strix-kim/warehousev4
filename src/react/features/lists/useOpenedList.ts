import { useEffect, useState } from 'react'
import { fetchEquipmentList, readCachedEquipmentList, type EquipmentList } from './api'

// Причина отказа при открытии сохранённого списка. Держим кодом, а не готовой
// строкой: строка потянула бы tr в зависимости эффекта, и смена языка
// перезапрашивала бы список из базы.
type OpenErrorCode = '' | 'failed'

// Строка открытого списка: сначала из кэша, затем свежая из базы.
export function useOpenedList(listId: string | undefined) {
  const [cachedList] = useState(() => listId ? readCachedEquipmentList(listId) : null)
  const [openError, setOpenError] = useState<OpenErrorCode>('')
  const [isOpening, setIsOpening] = useState(Boolean(listId && !cachedList))
  const [listToEdit, setListToEdit] = useState<EquipmentList | null>(() => cachedList ?? null)

  useEffect(() => {
    if (!listId) {
      setIsOpening(false)
      setListToEdit(null)
      setOpenError('')
      return
    }
    let current = true
    const cached = readCachedEquipmentList(listId)
    if (cached) setListToEdit(cached)
    setIsOpening(!cached)
    setOpenError('')
    fetchEquipmentList(listId, { bypassCache: Boolean(cached) })
      .then((list) => {
        if (!current) return
        setListToEdit(list)
      })
      .catch(() => {
        if (!current) return
        // Живой кэш уже показан — сбой обновления не повод рушить открытый редактор.
        if (cached) return
        setOpenError('failed')
      })
      .finally(() => { if (current) setIsOpening(false) })
    return () => { current = false }
  }, [listId])

  return { listToEdit, isOpening, openError }
}
