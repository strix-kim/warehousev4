import { useEffect, useRef, useState } from 'react'
import type { CatalogGroup } from './catalogGroups'
import { readListDraft, readListDraftMeta, type ListDraft, type ListDraftItem } from './api'
import { selectionLabel, type SelectedGroup } from './listSelection'

// kind различает две плашки: у нового списка восстановлен ВЕСЬ черновик, у
// открытого — только несохранённые правки поверх строки из базы. Тексты у них
// разные, и путать их нельзя: «Черновик восстановлен» на сохранённом списке
// читалось бы как «список не сохранён».
export type DraftNotice = {
  kind: 'draft' | 'edits'
  missingGroups: number
  units: number
  touchedAt: number | null
}

// Выборка поднимается ТОЛЬКО по живому каталогу: позицию ищем по ключу группы,
// серийники оставляем те, что ещё существуют. Общая для обеих веток — иначе
// правило «пропавшую группу считаем, а не выбрасываем молча» пришлось бы
// держать в двух местах.
export function rebuildSelection(items: ListDraftItem[], groupsByKey: Map<string, CatalogGroup>) {
  const restored: SelectedGroup[] = []
  let missingGroups = 0

  for (const item of items) {
    const group = groupsByKey.get(item.key)
    if (!group) {
      missingGroups += 1
      continue
    }
    const serialIds = item.serialIds.filter((id) => group.serializedItems.some((unit) => unit.id === id))
    restored.push({ key: group.key, label: selectionLabel(group), count: Math.max(1, item.count), serialIds, serialPickerOpen: false })
  }

  // Единицы, а не строки: то же число, что и «Всего единиц» в подвале выборки, —
  // иначе плашка и подвал спорят друг с другом на одном экране.
  return { restored, missingGroups, units: restored.reduce((sum, item) => sum + item.count, 0) }
}

/**
 * Восстановление несохранённой работы — обе ветки.
 *
 * `/lists/new`: поднимается весь черновик, включая шапку документа (её поля
 * инициализируются на странице, здесь — только выборка).
 *
 * `/lists/:id/edit` (U3-M, с13): поверх строки из базы накладываются
 * несохранённые правки. Порядок критичен — накладывать МОЖНО только после того,
 * как гидратация из базы закончилась и выставила точку отсчёта `savedSnapshot`;
 * иначе приехавшая строка затрёт правки, а `isDirty` посчитается от неверной
 * базы и черновик сотрётся сам.
 */
export function useListDraftRestore({ listId, isLoading, hasLoadError, hydratedListId, groupsByKey, setSelected, applyDocument }: {
  listId: string | undefined
  isLoading: boolean
  hasLoadError: boolean
  /** id списка, чья гидратация из базы уже завершилась. */
  hydratedListId: string | null
  groupsByKey: Map<string, CatalogGroup>
  setSelected: (items: SelectedGroup[]) => void
  /** Накладывает шапку документа из черновика. Зовётся только для открытого списка. */
  applyDocument: (draft: ListDraft) => void
}) {
  const [restoredDraft] = useState(() => listId ? null : readListDraft())
  // Момент последней записи. Спрашиваем только про живой черновик: у меты нет
  // гейта по TTL, и для протухшей записи она отдала бы время суточной давности.
  const [restoredDraftAt] = useState(() => restoredDraft ? readListDraftMeta()?.touchedAt ?? null : null)
  const [openDraft] = useState(() => listId ? readListDraft(listId) : null)
  const [openDraftAt] = useState(() => openDraft ? readListDraftMeta(listId)?.touchedAt ?? null : null)
  const [draftNotice, setDraftNotice] = useState<DraftNotice | null>(null)
  // Автосейв заблокирован, пока восстановление не закончилось: стартовый стейт
  // затёр бы сохранённое раньше, чем оно успеет подняться. У открытого списка
  // ждать нечего, когда правок нет.
  const draftRestoredRef = useRef(!restoredDraft && !openDraft)
  const appliedRef = useRef(false)

  // Ветка /lists/new. Пока каталог грузится или не загрузился вовсе,
  // восстановление не запускается — иначе «ничего не нашлось» стёрло бы черновик
  // вместо того, чтобы его вернуть.
  useEffect(() => {
    if (!restoredDraft || appliedRef.current || isLoading || hasLoadError) return
    const { restored, missingGroups, units } = rebuildSelection(restoredDraft.items, groupsByKey)
    setSelected(restored)
    setDraftNotice({ kind: 'draft', missingGroups, units, touchedAt: restoredDraftAt })
    appliedRef.current = true
    draftRestoredRef.current = true
  }, [groupsByKey, hasLoadError, isLoading, restoredDraft, restoredDraftAt, setSelected])

  // Ветка /lists/:id/edit. Ждём не только каталог, но и гидратацию из базы:
  // именно она ставит точку отсчёта, относительно которой считается «есть
  // несохранённые правки».
  useEffect(() => {
    if (!openDraft || appliedRef.current || isLoading || hasLoadError) return
    if (!listId || hydratedListId !== listId) return
    const { restored, missingGroups, units } = rebuildSelection(openDraft.items, groupsByKey)
    setSelected(restored)
    applyDocument(openDraft)
    setDraftNotice({ kind: 'edits', missingGroups, units, touchedAt: openDraftAt })
    appliedRef.current = true
    draftRestoredRef.current = true
  }, [applyDocument, groupsByKey, hasLoadError, hydratedListId, isLoading, listId, openDraft, openDraftAt, setSelected])

  // Открытый список без черновика: ждать нечего, автосейв можно пускать сразу
  // после гидратации. Без этого он молчал бы всю сессию.
  useEffect(() => {
    if (openDraft || !listId || hydratedListId !== listId) return
    draftRestoredRef.current = true
  }, [hydratedListId, listId, openDraft])

  return { draftNotice, setDraftNotice, draftRestoredRef }
}
