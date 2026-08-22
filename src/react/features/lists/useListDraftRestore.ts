import { useEffect, useRef, useState } from 'react'
import type { CatalogGroup } from './catalogGroups'
import { readListDraft, readListDraftMeta } from './api'
import { selectionLabel, type SelectedGroup } from './listSelection'

export type DraftNotice = { missingGroups: number; units: number }

/**
 * Восстановление несохранённого черновика `/lists/new`.
 *
 * Чистый перенос из ListEditorPage (с13): страница перевалила порог ~800 строк,
 * а этот кластер связный и наружу отдаёт ровно четыре значения.
 */
export function useListDraftRestore({ listId, isLoading, hasLoadError, groupsByKey, setSelected }: {
  listId: string | undefined
  isLoading: boolean
  hasLoadError: boolean
  groupsByKey: Map<string, CatalogGroup>
  setSelected: (items: SelectedGroup[]) => void
}) {
  // Черновик восстанавливается ТОЛЬКО в режиме создания: у открытого списка
  // источник правды — строка в базе.
  const [restoredDraft] = useState(() => listId ? null : readListDraft())
  // Момент последней записи черновика — «изменён 21.08, 18:40» в плашке. Спрашиваем
  // только про живой черновик: у меты нет гейта по TTL, и для протухшей записи она
  // отдала бы время суточной давности.
  const [restoredDraftAt] = useState(() => restoredDraft ? readListDraftMeta()?.touchedAt ?? null : null)
  const [draftNotice, setDraftNotice] = useState<DraftNotice | null>(null)
  // Автосейв заблокирован, пока восстановление не закончилось: стартовый пустой
  // стейт затёр бы сохранённое раньше, чем оно успеет подняться.
  const draftRestoredRef = useRef(!restoredDraft)

  // Выборка черновика поднимается только по живому каталогу: позицию ищем по
  // ключу группы, серийники оставляем те, что ещё существуют. Пока каталог
  // грузится или не загрузился вовсе, восстановление не запускается — иначе
  // «ничего не нашлось» стёрло бы черновик вместо того, чтобы его вернуть.
  useEffect(() => {
    if (!restoredDraft || draftRestoredRef.current || isLoading || hasLoadError) return
    const restored: SelectedGroup[] = []
    let missingGroups = 0

    for (const item of restoredDraft.items) {
      const group = groupsByKey.get(item.key)
      if (!group) {
        missingGroups += 1
        continue
      }
      const serialIds = item.serialIds.filter((id) => group.serializedItems.some((unit) => unit.id === id))
      restored.push({ key: group.key, label: selectionLabel(group), count: Math.max(1, item.count), serialIds, serialPickerOpen: false })
    }

    setSelected(restored)
    // Единицы, а не строки: то же число, что и «Всего единиц» в подвале выборки, —
    // иначе плашка и подвал спорят друг с другом на одном экране.
    setDraftNotice({ missingGroups, units: restored.reduce((sum, item) => sum + item.count, 0) })
    draftRestoredRef.current = true
  }, [groupsByKey, hasLoadError, isLoading, restoredDraft, setSelected])

  return { restoredDraft, restoredDraftAt, draftNotice, setDraftNotice, draftRestoredRef }
}
