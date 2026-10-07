import { formatTime, parseDateValue } from '../../lib/date'
import type { Equipment } from '../equipment/types'
import type { ProjectBrief } from '../projects/types'
import type { EquipmentList, EquipmentListItem, ListProjectDraft } from './api'
import { groupKey, type CatalogGroup } from './catalogGroups'
import { selectionLabel, type SelectedGroup, type SelectionLabel } from './listSelection'
import type { ExportListRow } from './xlsxExport'

// Мероприятие из базы → форма редактора. Одна функция на все входы (строка
// списка, пикер, ссылка ?project=): разъедься они, одно и то же мероприятие
// давало бы разные снимки, и «есть несохранённые правки» загоралось бы само.
export function projectDraftFrom(project: ProjectBrief): ListProjectDraft {
  return {
    id: project.id,
    name: project.name,
    clientName: project.client_name ?? '',
    dateFrom: project.date_from ?? '',
    dateTo: project.date_to ?? '',
    venue: project.venue,
    edited: false,
  }
}

// Снимок документа одной строкой — по нему считается «есть несохранённые
// правки». Серийники сортируются, порядок ключей фиксирован: иначе одна и та же
// правка давала бы разные строки, и предупреждение загоралось бы на ровном месте.
// У мероприятия в снимок идут только id и реквизиты: флаг edited и подпись места
// — служебные, документ от них не меняется.
export function serializeDocument(input: {
  name: string
  description: string
  project: ListProjectDraft | null
  items: { key: string; count: number; serialIds: string[] }[]
}) {
  return JSON.stringify({
    name: input.name.trim(),
    description: input.description.trim(),
    project: input.project && {
      id: input.project.id,
      name: input.project.name.trim(),
      clientName: input.project.clientName.trim(),
      dateFrom: input.project.dateFrom,
      dateTo: input.project.dateTo,
      venueId: input.project.venue?.id ?? null,
    },
    items: input.items.map(({ key, count, serialIds }) => ({ key, count, serialIds: [...serialIds].sort() })),
  })
}

// Шапка документа (Excel) из мероприятия. Одна на редактор и на реестр — раньше
// каждый собирал её сам из колонок списка.
//   name      — название мероприятия; подпись списка добавляется через « · »,
//               только когда отличается от него («Форум · Свет»): у мероприятия
//               бывает несколько списков, и их файлы должны различаться. У списка
//               без мероприятия — его собственное название.
//   venue     — название места без города: ровно то, что раньше набирали руками.
//   eventDate — начало периода, eventDateTo — окончание (null — один день).
export function documentHeader({ listName, project }: { listName: string; project: ListProjectDraft | null }) {
  const label = listName.trim()
  const projectName = project?.name.trim() ?? ''
  const sameName = label.toLocaleLowerCase('ru') === projectName.toLocaleLowerCase('ru')
  return {
    name: projectName ? (label && !sameName ? `${projectName} · ${label}` : projectName) : label,
    clientName: project?.clientName.trim() ?? '',
    venue: project?.venue?.name ?? '',
    eventDate: project?.dateFrom || null,
    eventDateTo: project?.dateTo || null,
  }
}

export type ResolvedSelection = { item: SelectedGroup; group: CatalogGroup | null; label: SelectionLabel }[]

// Выборка, склеенная со свежим каталогом. group === null означает, что модели
// в каталоге больше нет: позицию не выбрасываем, рисуем по снимку подписи.
export function resolveSelection(selected: SelectedGroup[], groupsByKey: Map<string, CatalogGroup>): ResolvedSelection {
  return selected.map((item) => ({
    item,
    group: groupsByKey.get(item.key) ?? null,
    label: groupsByKey.get(item.key) ?? item.label,
  }))
}

// Состав документа собирается по АКТУАЛЬНОМУ каталогу: конкретные единицы
// берутся только из живой группы. Группы уже нет — вся позиция уходит
// планируемой строкой по снимку подписи, как и раньше.
export function buildListItems(resolved: ResolvedSelection): EquipmentListItem[] {
  return resolved.flatMap(({ item: selectedItem, group, label }) => {
    const concrete = selectedItem.serialIds.flatMap((id) => {
      const item = group?.serializedItems.find((candidate) => candidate.id === id)
      return item ? [{
        equipment_id: item.id,
        brand: item.brand,
        model: item.model,
        type: item.type,
        subtype: item.subtype,
        count: 1,
        tracking_mode: 'serialized' as const,
      }] : []
    })
    let remaining = selectedItem.count - concrete.length
    const quantityItems: EquipmentListItem[] = []
    for (const item of group?.quantityItems ?? []) {
      if (remaining <= 0) break
      const allocated = Math.min(remaining, Math.max(0, item.count))
      if (allocated <= 0) continue
      quantityItems.push({
        equipment_id: item.id,
        brand: item.brand,
        model: item.model,
        type: item.type,
        subtype: item.subtype,
        count: allocated,
        tracking_mode: 'quantity',
      })
      remaining -= allocated
    }
    const planned: EquipmentListItem[] = remaining > 0 ? [{
      brand: label.brand,
      model: label.model,
      type: label.type,
      subtype: label.subtype,
      count: remaining,
      tracking_mode: 'planned',
    }] : []
    return [...concrete, ...quantityItems, ...planned]
  })
}

export function buildExportRows(resolved: ResolvedSelection): ExportListRow[] {
  return resolved.map(({ item, group, label }) => ({
    category: label.type,
    equipment: `${label.brand} ${label.model}`.trim(),
    subtype: label.subtype,
    count: item.count,
    serialNumbers: item.serialIds.flatMap((id) => {
      const equipmentItem = group?.serializedItems.find((candidate) => candidate.id === id)
      return equipmentItem?.serialnumber ? [equipmentItem.serialnumber] : []
    }),
  }))
}

// Имя списка собирается в момент действия и только если поле пустое. Есть
// мероприятие — список зовётся как оно: это и есть его подпись по умолчанию.
// Нет — дата отвечает на «что искать в реестре», время — на «который из
// сегодняшних»; своей даты у списка без мероприятия нет, поэтому сегодняшняя.
// Само поле не трогаем — пустое поле законно, и подставлять в него нечего.
export function resolveListName({ name, project, locale, tr }: {
  name: string
  project: ListProjectDraft | null
  locale: string
  tr: (ru: string, uz: string) => string
}) {
  const trimmed = name.trim()
  if (trimmed) return trimmed
  const projectName = project?.name.trim()
  if (projectName) return projectName
  const date = new Intl.DateTimeFormat(locale).format(parseDateValue(project?.dateFrom ?? '') ?? new Date())
  const time = formatTime(Date.now(), locale)
  return tr(`Список ${date} · ${time}`, `Ro‘yxat ${date} · ${time}`)
}

// Состав сохранённого списка, поднятый по живому каталогу. Гварды гидратации
// (каталог приехал, список ещё не поднимали) — на странице, здесь только сборка.
export function selectionFromList(list: EquipmentList, equipment: Equipment[], groupsByKey: Map<string, CatalogGroup>): SelectedGroup[] {
  const equipmentById = new Map(equipment.map((item) => [item.id, item]))
  const restored = new Map<string, SelectedGroup>()
  const addRestored = (group: CatalogGroup, count: number, serialId?: string) => {
    const current = restored.get(group.key) ?? { key: group.key, label: selectionLabel(group), count: 0, serialIds: [], serialPickerOpen: false }
    current.count += count
    if (serialId && group.serializedItems.some((item) => item.id === serialId)) current.serialIds.push(serialId)
    restored.set(group.key, current)
  }

  for (const equipmentId of list.equipment_ids ?? []) {
    const item = equipmentById.get(equipmentId)
    const group = item ? groupsByKey.get(groupKey(item)) : undefined
    if (group) addRestored(group, 1, equipmentId)
  }
  for (const item of list.equipment_items ?? []) {
    // В jsonb лежит СНИМОК бренда и модели на момент сохранения. После
    // переименования модели поиск по тексту промахивался, позиция молча
    // пропадала из редактора, а следующее «Сохранить» стирала её из списка.
    // equipment_id авторитетнее текста (то же правило, что в
    // loadSavedListComposition); снимок — фолбэк для planned-позиций и
    // оборудования, которого в каталоге больше нет.
    const unit = item.equipment_id ? equipmentById.get(item.equipment_id) : undefined
    const group = groupsByKey.get(groupKey(unit ?? item))
    if (group) addRestored(group, Math.max(1, Number(item.count) || 1), item.tracking_mode === 'serialized' ? item.equipment_id : undefined)
  }

  return [...restored.values()]
}
